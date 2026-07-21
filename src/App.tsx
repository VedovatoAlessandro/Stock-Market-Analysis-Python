import { useState, useEffect } from "react";
import {
  TrendingUp,
  Sliders,
  FileText,
  Terminal,
  MessageSquare,
  BookOpen,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Sparkles,
  Download,
  AlertCircle,
  Percent,
  CheckCircle2,
  Layers,
  ArrowRight
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import Markdown from "react-markdown";

import { StockDataset, PortfolioSimulationResult, ProjectFile } from "./types";
import RepositoryExplorer from "./components/RepositoryExplorer";
import NotebookViewer from "./components/NotebookViewer";
import CopilotChat from "./components/CopilotChat";
import {
  PriceVolumeChart,
  ReturnsDistributionChart,
  CorrelationHeatmap,
  RiskReturnScatterPlot
} from "./components/DashboardCharts";

// Default configuration lists
const POPULAR_PRESETS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "NFLX"];

export default function App() {
  // Sidebar parameters
  const [tickers, setTickers] = useState<string[]>(["AAPL", "MSFT", "NVDA", "TSLA"]);
  const [tickerInput, setTickerInput] = useState("");
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const [capital, setCapital] = useState(10000);
  const [weights, setWeights] = useState<Record<string, number>>({
    AAPL: 25,
    MSFT: 25,
    NVDA: 25,
    TSLA: 25,
  });

  // Active tab selection
  const [activeTab, setActiveTab] = useState<"sandbox" | "portfolio" | "report" | "code" | "notebook" | "chat">("sandbox");

  // Visual/Financial datasets from Express endpoints
  const [stocksData, setStocksData] = useState<StockDataset[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioSimulationResult | null>(null);
  const [repoTree, setRepoTree] = useState<ProjectFile[]>([]);
  const [notebookContent, setNotebookContent] = useState<string | null>(null);

  // Focus tickers for Examine Sandbox
  const [selectedTicker, setSelectedTicker] = useState<string>("AAPL");

  // Generated Gemini analyst report
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Loaders & feedback states
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Automatically fetch stock data and repository structure on mount
  useEffect(() => {
    fetchStockData();
    fetchRepositoryTree();
  }, []);

  // Update weights when tickers list changes
  useEffect(() => {
    const updatedWeights: Record<string, number> = {};
    const equalWeight = Math.floor(100 / tickers.length);
    let remainder = 100 - equalWeight * tickers.length;

    tickers.forEach((ticker) => {
      updatedWeights[ticker] = equalWeight + (remainder > 0 ? 1 : 0);
      remainder--;
    });
    setWeights(updatedWeights);

    if (tickers.length > 0 && !tickers.includes(selectedTicker)) {
      setSelectedTicker(tickers[0]);
    }
  }, [tickers]);

  // Fetch stocks prices and calculate indicators
  const fetchStockData = async () => {
    if (tickers.length === 0) return;
    setLoadingStocks(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/stock-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, startDate, endDate }),
      });

      const data = await response.json();
      if (response.ok) {
        setStocksData(data);
        if (data.length > 0) {
          // Trigger initial portfolio simulation as well
          simulatePortfolio(data);
        }
      } else {
        setErrorMessage(data.error || "Failed to load historical stock dataset.");
      }
    } catch (err) {
      setErrorMessage("Network error: Could not establish contact with Express server.");
    } finally {
      setLoadingStocks(false);
    }
  };

  // Run portfolio rebalancing model
  const simulatePortfolio = async (customStocksData?: StockDataset[]) => {
    const activeStocksList = customStocksData || stocksData;
    if (activeStocksList.length === 0) return;

    // Check sum of weights
    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
    if (totalWeight !== 100) {
      setErrorMessage("⚠️ Allocation sum must equal exactly 100% to execute simulations.");
      return;
    }

    setLoadingPortfolio(true);
    setErrorMessage(null);

    // Convert weights percent to ratio
    const allocations: Record<string, number> = {};
    for (const [tick, val] of Object.entries(weights)) {
      allocations[tick] = val / 100.0;
    }

    try {
      const response = await fetch("/api/portfolio-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations,
          investmentAmount: capital,
          startDate,
          endDate,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setPortfolioData(data);
      } else {
        setErrorMessage(data.error || "Simulation error on portfolio calculation.");
      }
    } catch (err) {
      setErrorMessage("Network error during portfolio simulation fetch.");
    } finally {
      setLoadingPortfolio(false);
    }
  };

  // Fetch Repository File Tree
  const fetchRepositoryTree = async () => {
    setLoadingRepo(true);
    try {
      const response = await fetch("/api/repo-tree");
      const data = await response.json();
      if (response.ok) {
        setRepoTree(data);
        
        // Locate notebook content inside the tree
        const notebooksDir = data.find((f: any) => f.name === "notebooks");
        const notebookFile = notebooksDir?.children?.find((f: any) => f.name.endsWith(".ipynb"));
        if (notebookFile?.content) {
          setNotebookContent(notebookFile.content);
        }
      }
    } catch (err) {
      console.error("Failed to read workspace repository structure:", err);
    } finally {
      setLoadingRepo(false);
    }
  };

  // Generate Gemini Quantitative Analyst report
  const generateAnalystReport = async () => {
    if (!portfolioData) {
      setErrorMessage("Please simulate a portfolio first before generating an executive report.");
      return;
    }

    setGeneratingReport(true);
    setErrorMessage(null);
    setAiReport(null);

    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioData,
          stocksData: stocksData.map((s) => ({
            ticker: s.ticker,
            metrics: s.metrics,
          })),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setAiReport(data.report);
        setActiveTab("report");
      } else {
        setErrorMessage(data.error || "Unable to contact Gemini AI. Is GEMINI_API_KEY configured?");
      }
    } catch (err) {
      setErrorMessage("Network connection error while generating AI report.");
    } finally {
      setGeneratingReport(false);
    }
  };

  // Evenly distribute weights among active assets
  const handleEquallyWeight = () => {
    const equalVal = Math.floor(100 / tickers.length);
    let remainder = 100 - equalVal * tickers.length;

    const newWeights: Record<string, number> = {};
    tickers.forEach((t) => {
      newWeights[t] = equalVal + (remainder > 0 ? 1 : 0);
      remainder--;
    });
    setWeights(newWeights);
  };

  // Add a new ticker
  const handleAddTicker = (t: string) => {
    const clean = t.trim().toUpperCase();
    if (!clean) return;
    if (tickers.includes(clean)) return;
    setTickers((prev) => [...prev, clean]);
    setTickerInput("");
  };

  // Remove ticker
  const handleRemoveTicker = (t: string) => {
    if (tickers.length <= 1) {
      setErrorMessage("Your asset list must contain at least one ticker symbol.");
      return;
    }
    setTickers((prev) => prev.filter((item) => item !== t));
  };

  // Active examines dataset
  const activeExamineDataset = stocksData.find((s) => s.ticker === selectedTicker);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Visual background ambient accent */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />

      {/* Main Header */}
      <header className="relative z-10 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-xs">
            📈
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 font-mono">Stock-Market-Analysis-Python</h1>
            <p className="text-xs text-slate-500">Quantitative Finance Analyzer & GitHub Portfolio Showroom</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Yahoo Finance Connected</span>
          </div>

          <button
            onClick={() => {
              window.open("/api/download-zip", "_blank");
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Download size={14} /> Download Python Repository (ZIP)
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 relative z-10">
        
        {/* Left Control Sidebar */}
        <aside className="xl:col-span-1 border-r border-slate-800 bg-slate-900 p-6 space-y-6 text-slate-300 shadow-sm">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders size={14} /> Pipeline Configurator
            </h2>

            {/* Ingest tickers */}
            <div className="space-y-2.5">
              <label className="text-[11px] font-mono font-medium text-slate-400">Target Asset Tickers</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTicker(tickerInput);
                    }
                  }}
                  placeholder="e.g. AMZN"
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleAddTicker(tickerInput)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-800 hover:border-slate-700 p-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Tickers list */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tickers.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-xs font-mono bg-slate-950 border border-slate-800 text-slate-300 pl-2.5 pr-1.5 py-1 rounded-md"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTicker(t)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Presets shortcut */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-500 font-mono block mb-1.5">Quick Presets</span>
                <div className="flex flex-wrap gap-1">
                  {POPULAR_PRESETS.map((p) => {
                    const active = tickers.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => (active ? handleRemoveTicker(p) : handleAddTicker(p))}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer ${
                          active
                            ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                            : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Date settings */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-400" /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-400" /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Ingestion load button */}
            <button
              onClick={fetchStockData}
              disabled={loadingStocks}
              className="w-full py-2.5 rounded-lg font-medium text-xs bg-slate-950 hover:bg-slate-900 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 focus:outline-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loadingStocks ? (
                <>
                  <div className="w-3.5 h-3.5 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>Ingesting Market Data...</span>
                </>
              ) : (
                <>
                  <TrendingUp size={14} />
                  <span>Execute Data Ingestion</span>
                </>
              )}
            </button>
          </div>

          {/* Allocation controls */}
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Percent size={14} /> Weight Allocations
              </h2>
              <button
                onClick={handleEquallyWeight}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono border border-indigo-500/10 hover:border-indigo-500/30 bg-indigo-500/5 px-2 py-0.5 rounded cursor-pointer"
              >
                Equal Weight
              </button>
            </div>

            {/* Weights lists */}
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {tickers.map((ticker) => (
                <div key={ticker} className="flex items-center gap-3 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
                  <span className="font-mono text-xs font-bold text-slate-300 w-10 uppercase">{ticker}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights[ticker] || 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setWeights((prev) => ({
                        ...prev,
                        [ticker]: val,
                      }));
                    }}
                    className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-xs text-slate-400 w-10 text-right">{weights[ticker] || 0}%</span>
                </div>
              ))}
            </div>

            {/* Capital Input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                <DollarSign size={12} className="text-indigo-400" /> Capital Investment ($)
              </label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
              />
            </div>

            <button
              onClick={() => simulatePortfolio()}
              disabled={loadingPortfolio}
              className="w-full py-2.5 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loadingPortfolio ? (
                <>
                  <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                  <span>Simulating Portfolio...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Run Portfolio Simulation</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Content Workspace Panels */}
        <main className="xl:col-span-3 flex flex-col p-6 bg-slate-100 text-slate-900">
          
          {/* Workspace Tabs Header */}
          <div className="border-b border-slate-200/80 pb-px mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("sandbox")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "sandbox"
                  ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <TrendingUp size={14} className={activeTab === "sandbox" ? "text-indigo-600" : "text-slate-400"} /> Live SandBox
            </button>

            <button
              onClick={() => setActiveTab("portfolio")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "portfolio"
                  ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Layers size={14} className={activeTab === "portfolio" ? "text-indigo-600" : "text-slate-400"} /> Portfolio Simulator
            </button>

            <button
              onClick={() => setActiveTab("report")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "report"
                  ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <FileText size={14} className={activeTab === "report" ? "text-indigo-600" : "text-slate-400"} /> AI Analyst Report
            </button>

            <button
              onClick={() => setActiveTab("code")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "code"
                  ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Terminal size={14} className={activeTab === "code" ? "text-indigo-600" : "text-slate-400"} /> Code Explorer
            </button>

            <button
              onClick={() => setActiveTab("notebook")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "notebook"
                  ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <BookOpen size={14} className={activeTab === "notebook" ? "text-indigo-600" : "text-slate-400"} /> Jupyter Notebook
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "chat"
                  ? "border-indigo-600 text-indigo-600 bg-white shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <MessageSquare size={14} className={activeTab === "chat" ? "text-indigo-600" : "text-slate-400"} /> AI Copilot Chat
            </button>
          </div>

          {/* Feedback alerts */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-lg flex items-center gap-2 mb-6">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Live Ingestion Sandbox Tab */}
          {activeTab === "sandbox" && (
            <div className="space-y-6">
              {/* Asset Focus Selector */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">Select Focus Stock to Examine:</span>
                  <div className="flex flex-wrap gap-1">
                    {tickers.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTicker(t)}
                        className={`text-xs font-mono font-bold px-3 py-1 rounded transition-all cursor-pointer ${
                          selectedTicker === t
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Displaying historical data: {startDate} to {endDate}
                </div>
              </div>

              {/* Individual Metrics Cards */}
              {activeExamineDataset ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1 font-semibold">Cumulative Return</span>
                    <span className="text-xl font-bold font-mono text-indigo-600">
                      {(activeExamineDataset.metrics.cumulativeReturn * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1 font-semibold">Annualized CAGR</span>
                    <span className="text-xl font-bold font-mono text-indigo-600">
                      {(activeExamineDataset.metrics.annualizedReturn * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1 font-semibold">Annual Volatility</span>
                    <span className="text-xl font-bold font-mono text-amber-600">
                      {(activeExamineDataset.metrics.annualizedVolatility * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1 font-semibold">Sharpe Ratio</span>
                    <span className="text-xl font-bold font-mono text-indigo-600">
                      {activeExamineDataset.metrics.sharpeRatio.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs col-span-2 lg:col-span-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1 font-semibold">Max Drawdown</span>
                    <span className="text-xl font-bold font-mono text-rose-600">
                      {(activeExamineDataset.metrics.maxDrawdown * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
                  {loadingStocks ? "Ingesting price matrices..." : "Execute data ingestion on the sidebar parameters to populate visualizations."}
                </div>
              )}

              {/* Visual Grid */}
              {activeExamineDataset && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left big column: price charts */}
                  <div className="lg:col-span-2 bg-white p-6 border border-slate-200 rounded-xl space-y-6 shadow-xs">
                    <PriceVolumeChart dataset={activeExamineDataset} />
                  </div>

                  {/* Right: Distribution & Cross metrics */}
                  <div className="bg-white p-6 border border-slate-200 rounded-xl space-y-6 flex flex-col justify-between shadow-xs">
                    <ReturnsDistributionChart dataset={activeExamineDataset} />
                    <div className="border-t border-slate-200 pt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Cross-Asset Risk Comparison</h4>
                      {stocksData.length > 1 ? (
                        <RiskReturnScatterPlot datasets={stocksData} />
                      ) : (
                        <p className="text-[11px] text-slate-400 font-mono">Add more tickers to build frontier comparison charts.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Portfolio Simulator Tab */}
          {activeTab === "portfolio" && (
            <div className="space-y-6">
              {portfolioData ? (
                <>
                  {/* Portfolio Performance comparison scoreboard */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Score Card Panel */}
                    <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-xs">
                      <h3 className="text-sm font-bold text-slate-800">Simulation Summary</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-mono block uppercase font-semibold">Initial Principal</span>
                          <span className="text-base font-mono font-bold text-slate-800">${portfolioData.initialInvestment.toLocaleString()}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-mono block uppercase font-semibold">Final Valuation</span>
                          <span className="text-base font-mono font-bold text-indigo-600">${Math.floor(portfolioData.finalValue).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Side by side comparison table */}
                      <table className="w-full text-xs text-left text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-mono uppercase">
                            <th className="py-2">Metric</th>
                            <th className="py-2 text-right">Portfolio</th>
                            <th className="py-2 text-right">S&P 500 (SPY)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-2.5 font-medium">Cumulative Return</td>
                            <td className="py-2.5 text-right font-mono text-indigo-600 font-bold">{(portfolioData.totalReturn * 100).toFixed(2)}%</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{(portfolioData.benchmark?.totalReturn ? portfolioData.benchmark.totalReturn * 100 : 0).toFixed(2)}%</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-medium">Annualized Return (CAGR)</td>
                            <td className="py-2.5 text-right font-mono text-indigo-600 font-bold">{(portfolioData.annualizedReturn * 100).toFixed(2)}%</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{(portfolioData.benchmark?.annualizedReturn ? portfolioData.benchmark.annualizedReturn * 100 : 0).toFixed(2)}%</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-medium">Annualized Volatility</td>
                            <td className="py-2.5 text-right font-mono text-amber-600 font-bold">{(portfolioData.annualizedVolatility * 100).toFixed(2)}%</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{(portfolioData.benchmark?.annualizedVolatility ? portfolioData.benchmark.annualizedVolatility * 100 : 0).toFixed(2)}%</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-medium">Sharpe Ratio</td>
                            <td className="py-2.5 text-right font-mono text-indigo-600 font-bold">{portfolioData.sharpeRatio.toFixed(2)}</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{portfolioData.benchmark?.sharpeRatio ? portfolioData.benchmark.sharpeRatio.toFixed(2) : "0.00"}</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 font-medium">Maximum Drawdown</td>
                            <td className="py-2.5 text-right font-mono text-rose-600 font-bold">{(portfolioData.maxDrawdown * 100).toFixed(2)}%</td>
                            <td className="py-2.5 text-right font-mono text-slate-500">{(portfolioData.benchmark?.maxDrawdown ? portfolioData.benchmark.maxDrawdown * 100 : 0).toFixed(2)}%</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Alpha callout */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Benchmark Symbol:</span>
                        <span className="font-mono font-bold text-slate-700">SPY (S&P 500 Trust)</span>
                      </div>
                      
                      {portfolioData.benchmark && (
                        <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between font-mono ${
                          portfolioData.totalReturn > portfolioData.benchmark.totalReturn
                            ? "bg-indigo-50 border-indigo-100 text-indigo-700 font-semibold"
                            : "bg-amber-50 border-amber-100 text-amber-700 font-semibold"
                        }`}>
                          <span>Generated Net Alpha:</span>
                          <span className="font-bold">
                            {(portfolioData.totalReturn - portfolioData.benchmark.totalReturn >= 0 ? "+" : "")}
                            {((portfolioData.totalReturn - portfolioData.benchmark.totalReturn) * 100).toFixed(2)}%
                          </span>
                        </div>
                      )}
                      
                      {/* Run Gemini Report Button */}
                      <button
                        onClick={generateAnalystReport}
                        disabled={generatingReport}
                        className="w-full py-2.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 border border-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        {generatingReport ? (
                          <>
                            <div className="w-3.5 h-3.5 border border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <span>AI Quant Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>Generate AI Quantitative Report</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Chart Panel */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-xs">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Historical Portfolio Equity Curve vs. S&P 500</h3>
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={portfolioData.equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} minTickGap={50} />
                            <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `$${v.toLocaleString()}`} domain={["auto", "auto"]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)" }}
                              labelStyle={{ color: "#475569", fontFamily: "monospace" }}
                              itemStyle={{ fontSize: "12px" }}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
                            <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} dot={false} name="Your Custom Portfolio" />
                            {portfolioData.benchmark && (
                              <Line
                                type="monotone"
                                data={portfolioData.benchmark.equityCurve}
                                dataKey="value"
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                strokeDasharray="3 3"
                                dot={false}
                                name="S&P 500 (SPY)"
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Multi asset correlation if multiple assets are loaded */}
                  {stocksData.length > 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 border-t border-slate-200 pt-6">
                      <CorrelationHeatmap datasets={stocksData} />
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500 text-xs shadow-xs">
                  Configure asset allocations and capital values on the sidebar, then click "Run Portfolio Simulation" to view results.
                </div>
              )}
            </div>
          )}

          {/* 3. AI Analyst Report Tab */}
          {activeTab === "report" && (
            <div className="space-y-6 max-w-4xl mx-auto w-full">
              {aiReport ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 shadow-sm relative overflow-hidden">
                  {/* Decorative glowing accent */}
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[80px]" />

                  {/* Document Header */}
                  <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles size={20} className="text-indigo-600 animate-pulse" /> Executive Portfolio Analysis Report
                      </h2>
                      <p className="text-xs text-slate-500">Generated dynamically via Gemini Quantitative Analysis Agent</p>
                    </div>
                    <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                      SECURED INSIGHT
                    </span>
                  </div>

                  {/* Rendered report content */}
                  <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-sm">
                    <Markdown>{aiReport}</Markdown>
                  </div>

                  {/* Footer callout */}
                  <div className="border-t border-slate-200 pt-4 text-center text-slate-400 text-xs">
                    This qualitative review is prepared dynamically for code portfolio showcase reasons.
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200 flex flex-col items-center justify-center h-[350px] shadow-xs">
                  <Sparkles size={32} className="text-indigo-500/60 mb-3 animate-pulse" />
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Executive AI Quant Review</h4>
                  <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed text-center">
                    Generate a rigorous qualitative report interpreting your current portfolio allocations, cumulative return vectors, and efficient correlations using our Gemini model.
                  </p>
                  <button
                    onClick={generateAnalystReport}
                    disabled={generatingReport}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    {generatingReport ? (
                      <>
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                        <span>AI Quant Ingress...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Generate Executive AI Report
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 4. Code Explorer Tab */}
          {activeTab === "code" && (
            <RepositoryExplorer tree={repoTree} loading={loadingRepo} onRefresh={fetchRepositoryTree} />
          )}

          {/* 5. Jupyter Notebook Tab */}
          {activeTab === "notebook" && <NotebookViewer notebookContent={notebookContent} />}

          {/* 6. AI Copilot Chat Tab */}
          {activeTab === "chat" && (
            <CopilotChat
              context={{
                tickers,
                startDate,
                endDate,
                capital,
                weights,
                portfolioMetrics: portfolioData
                  ? {
                      totalReturn: portfolioData.totalReturn,
                      annualizedReturn: portfolioData.annualizedReturn,
                      annualizedVolatility: portfolioData.annualizedVolatility,
                      sharpeRatio: portfolioData.sharpeRatio,
                      maxDrawdown: portfolioData.maxDrawdown,
                    }
                  : null,
                individualMetrics: stocksData.map((s) => ({
                  ticker: s.ticker,
                  metrics: s.metrics,
                })),
              }}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400 font-mono shadow-xs">
        Stock-Market-Analysis-Python • Designed as a top-tier Quantitative Developer / Data Analyst Portfolio project • Python 3 • Node Express full-stack
      </footer>
    </div>
  );
}
