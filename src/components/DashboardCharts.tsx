import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
  LabelList
} from "recharts";
import { StockDataset } from "../types";

interface DashboardChartsProps {
  dataset: StockDataset;
}

export function PriceVolumeChart({ dataset }: DashboardChartsProps) {
  const chartData = dataset.data.map((d) => ({
    date: d.date,
    Price: Number(d.price.toFixed(2)),
    Volume: d.volume,
    "50 SMA": d.sma50 ? Number(d.sma50.toFixed(2)) : null,
    "200 SMA": d.sma200 ? Number(d.sma200.toFixed(2)) : null,
  }));

  return (
    <div className="space-y-6">
      {/* Price Plot */}
      <div className="h-[300px] w-full">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Price Curve & Moving Averages</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" stroke="#64748b" fontSize={10} minTickGap={50} />
            <YAxis stroke="#64748b" fontSize={10} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}
              labelStyle={{ color: "#475569", fontFamily: "monospace" }}
              itemStyle={{ fontSize: "12px", color: "#1e293b" }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line type="monotone" dataKey="Price" stroke="#4f46e5" strokeWidth={2.5} dot={false} name={`${dataset.ticker} Close`} />
            <Line type="monotone" dataKey="50 SMA" stroke="#f43f5e" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="50-day SMA" connectNulls />
            <Line type="monotone" dataKey="200 SMA" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="200-day SMA" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Plot */}
      <div className="h-[150px] w-full border-t border-slate-200/60 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Trading Volume</h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" stroke="#64748b" fontSize={10} minTickGap={50} />
            <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}
              labelStyle={{ color: "#475569", fontFamily: "monospace" }}
              itemStyle={{ fontSize: "12px", color: "#64748b" }}
            />
            <Bar dataKey="Volume" fill="#818cf8" opacity={0.6} name="Daily Volume" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ReturnsDistributionChart({ dataset }: DashboardChartsProps) {
  // Compute histogram bins for Daily Returns
  const returns = dataset.data.slice(1).map((d) => d.dailyReturn * 100); // in percent
  if (returns.length === 0) return <div className="text-slate-500 text-xs">Insufficient data for distribution.</div>;

  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binCount = 30;
  const binSize = (max - min) / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => {
    const binStart = min + i * binSize;
    const binEnd = binStart + binSize;
    return {
      label: `${((binStart + binEnd) / 2).toFixed(2)}%`,
      count: 0,
    };
  });

  for (const r of returns) {
    let binIdx = Math.floor((r - min) / binSize);
    if (binIdx >= binCount) binIdx = binCount - 1;
    if (binIdx < 0) binIdx = 0;
    bins[binIdx].count++;
  }

  return (
    <div className="h-[250px] w-full">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Daily Returns Distribution Histogram (%)</h4>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" stroke="#64748b" fontSize={9} minTickGap={20} />
          <YAxis stroke="#64748b" fontSize={10} name="Frequency" />
          <Tooltip
            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}
            labelStyle={{ color: "#475569", fontFamily: "monospace" }}
            itemStyle={{ fontSize: "12px", color: "#1e293b" }}
          />
          <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} opacity={0.8} name="Frequency" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MultiAssetChartsProps {
  datasets: StockDataset[];
}

export function CorrelationHeatmap({ datasets }: MultiAssetChartsProps) {
  if (datasets.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
        Add multiple ticker symbols to calculate cross-correlations.
      </div>
    );
  }

  const tickers = datasets.map((d) => d.ticker);

  // Math helper for Pearson correlation
  const getCorrelation = (t1: string, t2: string): number => {
    if (t1 === t2) return 1.0;
    const ds1 = datasets.find((d) => d.ticker === t1);
    const ds2 = datasets.find((d) => d.ticker === t2);
    if (!ds1 || !ds2) return 0;

    // Align returns by date
    const map1 = new Map(ds1.data.slice(1).map((d) => [d.date, d.dailyReturn]));
    const map2 = new Map(ds2.data.slice(1).map((d) => [d.date, d.dailyReturn]));

    const dates = ds1.data.slice(1).map((d) => d.date).filter((d) => map2.has(d));
    if (dates.length < 2) return 0;

    const r1 = dates.map((d) => map1.get(d) as number);
    const r2 = dates.map((d) => map2.get(d) as number);

    const m1 = r1.reduce((s, v) => s + v, 0) / r1.length;
    const m2 = r2.reduce((s, v) => s + v, 0) / r2.length;

    const num = r1.reduce((sum, v, idx) => sum + (v - m1) * (r2[idx] - m2), 0);
    const den1 = r1.reduce((sum, v) => sum + Math.pow(v - m1, 2), 0);
    const den2 = r2.reduce((sum, v) => sum + Math.pow(v - m2, 2), 0);

    return den1 > 0 && den2 > 0 ? num / Math.sqrt(den1 * den2) : 0;
  };

  // Generate matrix
  const matrix = tickers.map((t1) => {
    return tickers.map((t2) => ({
      t1,
      t2,
      value: getCorrelation(t1, t2),
    }));
  });

  // Heatmap rendering
  const getColor = (val: number) => {
    const abs = Math.abs(val);
    if (val >= 0) {
      return `rgba(79, 70, 229, ${abs * 0.85})`; // Indigo for positive correlation
    } else {
      return `rgba(244, 63, 94, ${abs * 0.85})`; // Rose for negative correlation
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pearson Correlation Heatmap (Daily Returns)</h4>
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${tickers.length + 1}, minmax(60px, 1fr))`,
          }}
        >
          {/* Header Row */}
          <div className="h-10 flex items-center justify-center text-xs font-bold text-slate-400 font-mono" />
          {tickers.map((t) => (
            <div key={t} className="h-10 flex items-center justify-center text-xs font-bold text-slate-700 font-mono uppercase bg-slate-200/60 border border-slate-200 rounded">
              {t}
            </div>
          ))}

          {/* Matrix Rows */}
          {tickers.map((t1, rIdx) => (
            <React.Fragment key={`row-${t1}`}>
              {/* Left Row Header */}
              <div className="h-12 flex items-center justify-center text-xs font-bold text-slate-700 font-mono uppercase bg-slate-200/60 border border-slate-200 rounded px-1">
                {t1}
              </div>
              {matrix[rIdx].map((cell) => (
                <div
                  key={`${cell.t1}-${cell.t2}`}
                  className="h-12 flex flex-col items-center justify-center text-xs font-bold text-slate-900 font-mono rounded border transition-transform hover:scale-105"
                  style={{
                    backgroundColor: getColor(cell.value),
                    borderColor: cell.value > 0 ? "rgba(79, 70, 229, 0.2)" : "rgba(244, 63, 94, 0.2)",
                  }}
                >
                  {cell.value.toFixed(2)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RiskReturnScatterPlot({ datasets }: MultiAssetChartsProps) {
  if (datasets.length === 0) return null;

  const data = datasets.map((d) => {
    const vol = d.metrics.annualizedVolatility * 100; // as percentage
    const ret = d.metrics.annualizedReturn * 100; // as percentage
    const sharpe = d.metrics.sharpeRatio;

    return {
      ticker: d.ticker,
      Volatility: Number(vol.toFixed(2)),
      Return: Number(ret.toFixed(2)),
      Sharpe: Number(sharpe.toFixed(2)),
      size: Math.max(2, Math.floor(sharpe * 10)), // size scale
    };
  });

  return (
    <div className="h-[250px] w-full">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Efficient Frontier Risk-Return Profiles (Annualized %)</h4>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <XAxis type="number" dataKey="Volatility" name="Annual Risk (Volatility)" unit="%" stroke="#64748b" fontSize={10} label={{ value: "Risk / Volatility (%)", position: "insideBottom", offset: -10, fill: "#64748b", fontSize: 10 }} />
          <YAxis type="number" dataKey="Return" name="Annual Return (CAGR)" unit="%" stroke="#64748b" fontSize={10} label={{ value: "CAGR Return (%)", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }} />
          <ZAxis type="number" dataKey="size" range={[100, 400]} />
          <Tooltip
            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}
            cursor={{ strokeDasharray: "3 3" }}
          />
          <Scatter name="Assets" data={data} fill="#6366f1" opacity={0.85}>
            <LabelList dataKey="ticker" position="top" style={{ fill: "#1e293b", fontFamily: "monospace", fontSize: "11px", fontWeight: "bold" }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
