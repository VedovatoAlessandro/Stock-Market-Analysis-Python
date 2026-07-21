import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as _archiver from "archiver";

const archiver = _archiver as any;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with custom User-Agent
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Interface for pricing data point
 */
interface RawPricePoint {
  date: string;
  timestamp: number;
  price: number;
  volume: number;
}

/**
 * Fetches historical data from Yahoo Finance Chart API
 */
async function fetchYahooFinance(ticker: string, startStr: string, endStr: string): Promise<RawPricePoint[]> {
  const startEpoch = Math.floor(new Date(startStr).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endStr).getTime() / 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startEpoch}&period2=${endEpoch}&interval=1d`;
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${ticker} from Yahoo Finance: ${response.statusText}`);
    }

    const json = await response.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) {
      throw new Error(`No data returned for ticker: ${ticker}`);
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const adjclose = result.indicators?.adjclose?.[0]?.adjclose || quote.close || [];
    const volumes = quote.volume || [];

    const dataPoints: RawPricePoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const dateStr = new Date(ts * 1000).toISOString().split("T")[0];
      const p = adjclose[i] ?? quote.close?.[i];
      const v = volumes[i] ?? 0;

      // Filter out invalid/NaN points
      if (p !== undefined && p !== null && !isNaN(p)) {
        dataPoints.push({
          date: dateStr,
          timestamp: ts,
          price: Number(p),
          volume: Number(v),
        });
      }
    }

    return dataPoints;
  } catch (error: any) {
    console.error(`Error in fetchYahooFinance for ticker ${ticker}:`, error.message);
    throw error;
  }
}

/**
 * Financial calculations helper
 */
function calculateMetricsForTicker(ticker: string, prices: RawPricePoint[], riskFreeRate = 0.02) {
  if (prices.length < 2) {
    return {
      metrics: {
        ticker,
        cumulativeReturn: 0,
        annualizedReturn: 0,
        annualizedVolatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      },
      data: []
    };
  }

  const sortedPrices = [...prices].sort((a, b) => a.timestamp - b.timestamp);
  const dataPoints: any[] = [];
  const closeList = sortedPrices.map(p => p.price);

  // Calculate 50 and 200 SMA
  const calculateSMA = (index: number, windowSize: number): number | null => {
    if (index < windowSize - 1) return null;
    let sum = 0;
    for (let i = index - windowSize + 1; i <= index; i++) {
      sum += closeList[i];
    }
    return sum / windowSize;
  };

  let peak = -Infinity;
  let maxDd = 0;

  for (let i = 0; i < sortedPrices.length; i++) {
    const current = sortedPrices[i];
    const prev = i > 0 ? sortedPrices[i - 1] : null;

    // Daily Return
    const dailyReturn = prev ? (current.price - prev.price) / prev.price : 0;

    // SMAs
    const sma50 = calculateSMA(i, 50);
    const sma200 = calculateSMA(i, 200);

    // Running Peak & Drawdown
    if (current.price > peak) peak = current.price;
    const drawdown = (current.price - peak) / peak;
    if (drawdown < maxDd) maxDd = drawdown;

    dataPoints.push({
      date: current.date,
      price: current.price,
      volume: current.volume,
      dailyReturn,
      sma50,
      sma200,
    });
  }

  // Aggregate stats
  const initialPrice = sortedPrices[0].price;
  const finalPrice = sortedPrices[sortedPrices.length - 1].price;
  const cumulativeReturn = (finalPrice - initialPrice) / initialPrice;

  const nTradingDays = sortedPrices.length;
  const nYears = nTradingDays / 252.0;
  const annualizedReturn = nYears > 0 ? Math.pow(finalPrice / initialPrice, 1.0 / nYears) - 1.0 : 0;

  // StdDev daily returns
  const nonZeroReturns = dataPoints.slice(1).map(d => d.dailyReturn);
  const meanReturn = nonZeroReturns.reduce((sum, val) => sum + val, 0) / nonZeroReturns.length;
  const variance = nonZeroReturns.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / (nonZeroReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVolatility = dailyVol * Math.sqrt(252);

  const sharpeRatio = annualizedVolatility > 0 ? (annualizedReturn - riskFreeRate) / annualizedVolatility : 0;

  return {
    metrics: {
      ticker,
      cumulativeReturn,
      annualizedReturn,
      annualizedVolatility,
      sharpeRatio,
      maxDrawdown: maxDd,
    },
    data: dataPoints
  };
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * Fetch Stock Metrics and Historical Datasets
 */
app.post("/api/stock-data", async (req, res) => {
  const { tickers, startDate, endDate } = req.body;

  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: "Tickers array is required" });
  }

  const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const end = endDate || new Date().toISOString().split("T")[0];

  try {
    const promises = tickers.map(async (ticker) => {
      const cleanTicker = ticker.trim().toUpperCase();
      try {
        const rawPoints = await fetchYahooFinance(cleanTicker, start, end);
        return calculateMetricsForTicker(cleanTicker, rawPoints);
      } catch (err: any) {
        console.warn(`Error loading ticker ${cleanTicker}:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(promises);
    const filteredResults = results.filter((r) => r !== null);

    res.json(filteredResults);
  } catch (error: any) {
    console.error("API error fetching stock data:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run Portfolio Simulation
 */
app.post("/api/portfolio-simulate", async (req, res) => {
  const { allocations, investmentAmount, startDate, endDate } = req.body;

  if (!allocations || typeof allocations !== "object") {
    return res.status(400).json({ error: "Allocations mapping is required" });
  }

  const tickers = Object.keys(allocations);
  const weights = Object.values(allocations) as number[];

  // Normalize weights if needed
  const sumWeights = weights.reduce((sum, w) => sum + w, 0);
  const normalizedAllocations: Record<string, number> = {};
  for (const ticker of tickers) {
    normalizedAllocations[ticker] = allocations[ticker] / sumWeights;
  }

  const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const end = endDate || new Date().toISOString().split("T")[0];
  const capital = Number(investmentAmount) || 10000;

  try {
    // 1. Fetch portfolio stocks
    const stockPromises = tickers.map(async (t) => {
      try {
        const raw = await fetchYahooFinance(t.toUpperCase(), start, end);
        return { ticker: t.toUpperCase(), prices: raw };
      } catch {
        return null;
      }
    });

    // 2. Fetch SPY benchmark
    const benchmarkPromise = fetchYahooFinance("SPY", start, end).catch(() => []);

    const [stockResults, benchmarkRaw] = await Promise.all([
      Promise.all(stockPromises),
      benchmarkPromise
    ]);

    const stocks = stockResults.filter((s) => s !== null && s.prices.length > 0) as { ticker: string; prices: RawPricePoint[] }[];

    if (stocks.length === 0) {
      return res.status(404).json({ error: "None of the portfolio tickers could be loaded" });
    }

    // Align dates of all stocks (find intersection of dates)
    const dateSets = stocks.map(s => new Set(s.prices.map(p => p.date)));
    const commonDates = Array.from(dateSets[0]).filter(date => 
      dateSets.every(set => set.has(date))
    ).sort();

    if (commonDates.length === 0) {
      return res.status(400).json({ error: "No overlapping trading dates found across the selected stocks" });
    }

    // Map aligned pricing
    const alignedPrices: Record<string, number[]> = {};
    for (const s of stocks) {
      const priceMap = new Map(s.prices.map(p => [p.date, p.price]));
      alignedPrices[s.ticker] = commonDates.map(d => priceMap.get(d) as number);
    }

    // Simulate Equity Line
    const equityCurve: { date: string; value: number }[] = [];
    const dailyPortfolioReturns: number[] = [];

    // Calculate normalized indices
    const normalizedPrices: Record<string, number[]> = {};
    for (const t of Object.keys(normalizedAllocations)) {
      if (alignedPrices[t]) {
        const firstPrice = alignedPrices[t][0];
        normalizedPrices[t] = alignedPrices[t].map(p => p / firstPrice);
      }
    }

    for (let i = 0; i < commonDates.length; i++) {
      let dailyMultiplier = 0;
      for (const t of Object.keys(normalizedAllocations)) {
        if (normalizedPrices[t]) {
          dailyMultiplier += normalizedPrices[t][i] * normalizedAllocations[t];
        }
      }

      const portfolioValue = dailyMultiplier * capital;
      equityCurve.push({ date: commonDates[i], value: portfolioValue });

      if (i > 0) {
        const prevValue = equityCurve[i - 1].value;
        dailyPortfolioReturns.push((portfolioValue - prevValue) / prevValue);
      }
    }

    // Portfolio metrics
    const finalValue = equityCurve[equityCurve.length - 1].value;
    const totalReturn = (finalValue - capital) / capital;
    const nTradingDays = commonDates.length;
    const nYears = nTradingDays / 252.0;
    const annualizedReturn = nYears > 0 ? Math.pow(finalValue / capital, 1.0 / nYears) - 1.0 : 0;

    // Volatility
    const meanReturn = dailyPortfolioReturns.reduce((sum, v) => sum + v, 0) / dailyPortfolioReturns.length;
    const variance = dailyPortfolioReturns.reduce((sum, v) => sum + Math.pow(v - meanReturn, 2), 0) / (dailyPortfolioReturns.length - 1);
    const annualizedVolatility = Math.sqrt(variance) * Math.sqrt(252);

    const sharpeRatio = annualizedVolatility > 0 ? (annualizedReturn - 0.02) / annualizedVolatility : 0;

    // Max Drawdown
    let pPeak = -Infinity;
    let pMaxDd = 0;
    for (const pt of equityCurve) {
      if (pt.value > pPeak) pPeak = pt.value;
      const dd = (pt.value - pPeak) / pPeak;
      if (dd < pMaxDd) pMaxDd = dd;
    }

    // Benchmark comparison (SPY)
    let benchmarkResults = null;
    if (benchmarkRaw && benchmarkRaw.length > 0) {
      const bMap = new Map<string, number>(benchmarkRaw.map(b => [b.date, b.price] as [string, number]));
      const bAligned = commonDates.map(d => bMap.get(d) ?? null);

      if (bAligned[0] !== null) {
        // Forward fill any aligned gaps
        let lastB = bAligned[0] as number;
        const bFilled: number[] = bAligned.map(val => {
          if (val !== null) lastB = val;
          return lastB;
        });

        const bFirst = bFilled[0];
        const bEquityCurve = bFilled.map((p, idx) => ({
          date: commonDates[idx],
          value: (p / bFirst) * capital,
        }));

        const bFinal = bEquityCurve[bEquityCurve.length - 1].value;
        const bTotalReturn = (bFinal - capital) / capital;
        const bAnnReturn = nYears > 0 ? Math.pow(bFinal / capital, 1.0 / nYears) - 1.0 : 0;

        const bDailyReturns: number[] = [];
        for (let idx = 1; idx < bEquityCurve.length; idx++) {
          bDailyReturns.push((bEquityCurve[idx].value - bEquityCurve[idx - 1].value) / bEquityCurve[idx - 1].value);
        }

        const bMean = bDailyReturns.reduce((sum, v) => sum + v, 0) / bDailyReturns.length;
        const bVar = bDailyReturns.reduce((sum, v) => sum + Math.pow(v - bMean, 2), 0) / (bDailyReturns.length - 1);
        const bAnnVol = Math.sqrt(bVar) * Math.sqrt(252);
        const bSharpe = bAnnVol > 0 ? (bAnnReturn - 0.02) / bAnnVol : 0;

        let bPeak = -Infinity;
        let bMaxDd = 0;
        for (const pt of bEquityCurve) {
          if (pt.value > bPeak) bPeak = pt.value;
          const dd = (pt.value - bPeak) / bPeak;
          if (dd < bMaxDd) bMaxDd = dd;
        }

        benchmarkResults = {
          symbol: "SPY",
          totalReturn: bTotalReturn,
          annualizedReturn: bAnnReturn,
          annualizedVolatility: bAnnVol,
          sharpeRatio: bSharpe,
          maxDrawdown: bMaxDd,
          equityCurve: bEquityCurve,
        };
      }
    }

    res.json({
      initialInvestment: capital,
      finalValue,
      totalReturn,
      annualizedReturn,
      annualizedVolatility,
      sharpeRatio,
      maxDrawdown: pMaxDd,
      equityCurve,
      tickerWeights: normalizedAllocations,
      benchmark: benchmarkResults,
    });
  } catch (error: any) {
    console.error("API error in portfolio simulation:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * File Explorer tree reader for code display
 */
function readDirectoryRecursively(dirPath: string, relativeRoot: string = ""): any {
  const items = fs.readdirSync(dirPath);
  const result: any[] = [];

  for (const item of items) {
    if (item === ".git" || item === "node_modules" || item === "__pycache__") continue;

    const fullPath = path.join(dirPath, item);
    const relPath = path.join(relativeRoot, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      result.push({
        name: item,
        path: relPath,
        type: "directory",
        children: readDirectoryRecursively(fullPath, relPath),
      });
    } else {
      // Read text content
      let content = "";
      try {
        if (item.endsWith(".py") || item.endsWith(".md") || item.endsWith(".txt") || item.endsWith(".json") || item.endsWith(".ipynb")) {
          content = fs.readFileSync(fullPath, "utf-8");
        }
      } catch (err) {
        console.error(`Failed to read file contents for ${item}:`, err);
      }

      result.push({
        name: item,
        path: relPath,
        type: "file",
        content,
      });
    }
  }

  // Sort directories first, then files alphabetically
  return result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

app.get("/api/repo-tree", (req, res) => {
  const repoPath = path.join(process.cwd(), "Stock-Market-Analysis-Python");
  if (!fs.existsSync(repoPath)) {
    return res.status(404).json({ error: "Repository directory does not exist yet." });
  }

  try {
    const tree = readDirectoryRecursively(repoPath);
    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI Qualitative Report Generator & Portfolio Review (Financial Interpretation)
 */
app.post("/api/gemini/analyze", async (req, res) => {
  const { portfolioData, stocksData } = req.body;

  if (!ai) {
    return res.status(503).json({
      error: "Gemini API key is not configured in Secrets. Please configure GEMINI_API_KEY.",
    });
  }

  try {
    let summaryDataText = `=== INDIVIDUAL ASSETS ===\n`;
    if (stocksData && Array.isArray(stocksData)) {
      for (const s of stocksData) {
        summaryDataText += `- ${s.ticker}: Cum Return: ${(s.metrics.cumulativeReturn * 100).toFixed(2)}%, Annualized Return: ${(s.metrics.annualizedReturn * 100).toFixed(2)}%, Volatility: ${(s.metrics.annualizedVolatility * 100).toFixed(2)}%, Sharpe: ${s.metrics.sharpeRatio.toFixed(2)}, Max Drawdown: ${(s.metrics.maxDrawdown * 100).toFixed(2)}%\n`;
      }
    }

    if (portfolioData) {
      summaryDataText += `\n=== CUSTOM PORTFOLIO ===\n`;
      summaryDataText += `- Allocations: ${JSON.stringify(portfolioData.tickerWeights)}\n`;
      summaryDataText += `- Total Return: ${(portfolioData.totalReturn * 100).toFixed(2)}%\n`;
      summaryDataText += `- Annualized Return: ${(portfolioData.annualizedReturn * 100).toFixed(2)}%\n`;
      summaryDataText += `- Volatility: ${(portfolioData.annualizedVolatility * 100).toFixed(2)}%\n`;
      summaryDataText += `- Sharpe Ratio: ${portfolioData.sharpeRatio.toFixed(2)}\n`;
      summaryDataText += `- Max Drawdown: ${(portfolioData.maxDrawdown * 100).toFixed(2)}%\n`;

      if (portfolioData.benchmark) {
        const b = portfolioData.benchmark;
        summaryDataText += `\n=== BENCHMARK (S&P 500) ===\n`;
        summaryDataText += `- Total Return: ${(b.totalReturn * 100).toFixed(2)}%\n`;
        summaryDataText += `- Annualized Return: ${(b.annualizedReturn * 100).toFixed(2)}%\n`;
        summaryDataText += `- Volatility: ${(b.annualizedVolatility * 100).toFixed(2)}%\n`;
        summaryDataText += `- Sharpe Ratio: ${b.sharpeRatio.toFixed(2)}\n`;
        summaryDataText += `- Max Drawdown: ${(b.maxDrawdown * 100).toFixed(2)}%\n`;
      }
    }

    const prompt = `You are a professional Senior Quantitative Portfolio Manager and Financial Analyst reviewing a client's stock market analysis and portfolio simulations.

Based on the quantitative results below, write a comprehensive, highly polished, executive financial interpretation report.
Make the tone professional, objective, insightful, and detailed - suitable for a top-tier investment committee or technology company portfolio presentation.

Quantitative Data:
${summaryDataText}

Structure your response using clean Markdown formatting:
1. **Executive Portfolio Assessment**: Summarize the performance, whether it generated Alpha over S&P 500, and overall efficiency.
2. **Individual Asset Breakdown & Risk Profiles**: Highlight the standout performers, high-volatility liabilities (e.g. TSLA or tech beta), and diversification dynamics.
3. **Core Risk-Adjusted Return Insights**: Explain the Sharpe Ratios, the drawdowns, and what this tells us about the portfolio's safety margin.
4. **Strategic Recommendations**: Provide actionable portfolio optimization tips (rebalancing, diversification, cash/bond buffer, or hedging) in a sophisticated quantitative tone.

Keep it highly technical yet digestible. Avoid generic financial advice cliches. Use real financial terminology (e.g. tracking error, beta exposure, efficient frontier, drawdown duration).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Interactive Conversational Chat with AI Quantitative Analyst
 */
app.post("/api/gemini/chat", async (req, res) => {
  const { messages, context } = req.body;

  if (!ai) {
    return res.status(503).json({
      error: "Gemini API key is not configured in Secrets. Please configure GEMINI_API_KEY.",
    });
  }

  try {
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: `You are an expert Senior Quantitative Analyst, Portfolio Manager, and Financial Python Developer.
Your objective is to provide highly precise, mathematical, and practical investment science and software advice.
Explain finance equations, python script modularity, and optimization insights clearly.
Keep responses concise, technical, and professional. Avoid fluff.
Use the following context of current portfolio simulation and ticker analytics: ${JSON.stringify(context)}`
      }
    });

    res.json({ message: response.text });
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serves zipped repository folder for download
 */
app.get("/api/download-zip", (req, res) => {
  const repoPath = path.join(process.cwd(), "Stock-Market-Analysis-Python");
  if (!fs.existsSync(repoPath)) {
    return res.status(404).send("Repository folder not generated yet.");
  }

  res.attachment("Stock-Market-Analysis-Python.zip");
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    console.error("Zip generation failed:", err);
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);
  archive.directory(repoPath, false);
  archive.finalize();
});

// -------------------------------------------------------------
// Vite Dev Server & Static Production Routing
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
