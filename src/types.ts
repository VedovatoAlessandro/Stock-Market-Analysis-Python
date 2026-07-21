/**
 * TypeScript type declarations for Stock Market Analysis Portfolio application.
 */

export interface StockMetricSummary {
  cumulativeReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  ticker: string;
}

export interface StockDataPoint {
  date: string;
  price: number;
  volume: number;
  dailyReturn: number;
  sma50: number | null;
  sma200: number | null;
}

export interface StockDataset {
  ticker: string;
  metrics: StockMetricSummary;
  data: StockDataPoint[];
}

export interface PortfolioSimulationResult {
  initialInvestment: number;
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  equityCurve: { date: string; value: number }[];
  tickerWeights: Record<string, number>;
  benchmark: {
    symbol: string;
    totalReturn: number;
    annualizedReturn: number;
    annualizedVolatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    equityCurve: { date: string; value: number }[];
  } | null;
}

export interface ProjectFile {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: ProjectFile[];
  content?: string;
}
