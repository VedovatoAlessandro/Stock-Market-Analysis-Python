"""
Portfolio Simulator module for Stock Market Analysis.
Models asset combinations, weighted performance, and portfolio equity lines
relative to benchmark indexes (S&P 500).

Author: Junior Quantitative Developer / Analyst Portfolio
"""

import logging
import numpy as np
import pandas as pd
import yfinance as yf
from typing import Dict, List, Union, Tuple

logger = logging.getLogger("PortfolioSimulator")


class PortfolioSimulator:
    """
    Simulates historical rebalancing of assets with user-defined weights.
    Calculates composite Sharpe ratios, total returns, drawdowns, and
    provides a direct benchmarking overlay against SPY.
    """

    def __init__(self, risk_free_rate: float = 0.02):
        """
        Parameters:
            risk_free_rate (float): Base treasury rate.
        """
        self.risk_free_rate = risk_free_rate

    def simulate_portfolio(
        self,
        prices_df: pd.DataFrame,
        allocations: Dict[str, float],
        initial_investment: float = 10000.0,
        benchmark_symbol: str = "SPY"
    ) -> Dict[str, Union[float, pd.Series, pd.DataFrame]]:
        """
        Simulates holding a weighted portfolio of assets over time.

        Parameters:
            prices_df (pd.DataFrame): Wide DataFrame of close prices for chosen stocks.
            allocations (dict): Map of ticker -> weight (e.g., {'AAPL': 0.4, 'MSFT': 0.6}). Sum must equal 1.0.
            initial_investment (float): Total starting capital in USD. Default: 10,000.
            benchmark_symbol (str): Reference market index. Default: 'SPY' (S&P 500 Trust).

        Returns:
            dict: Simulation results mapping metrics, equity curve series, and comparison tables.
        """
        # Validate weights
        total_weight = sum(allocations.values())
        if not np.isclose(total_weight, 1.0, atol=1e-4):
            # Auto-normalize weights if not exactly 1.0
            logger.warning(f"Portfolio weights sum to {total_weight}. Normalizing to 1.0.")
            allocations = {t: w / total_weight for t, w in allocations.items()}

        logger.info(f"Simulating weighted portfolio: {allocations} with capital ${initial_investment:,.2f}")

        # Filter pricing columns to matching allocations
        avail_tickers = [t for t in allocations.keys() if t in prices_df.columns]
        if len(avail_tickers) < len(allocations):
            logger.warning("Some allocated tickers are missing from the input prices DataFrame.")

        # Subset pricing data
        subset_df = prices_df[avail_tickers]

        # Calculate normalized daily equity indices (normalized to start at 1.0)
        normalized_prices = subset_df / subset_df.iloc[0]

        # Compute weighted daily portfolio values
        portfolio_equity_multiplier = pd.Series(0.0, index=subset_df.index)
        for ticker, weight in allocations.items():
            if ticker in normalized_prices.columns:
                portfolio_equity_multiplier += normalized_prices[ticker] * weight

        # Scale with initial investment
        portfolio_equity_curve = portfolio_equity_multiplier * initial_investment

        # Compute daily percent returns for the portfolio
        portfolio_daily_returns = portfolio_equity_multiplier.pct_change().dropna()

        # Calculate Portfolio Metrics
        total_portfolio_return = (portfolio_equity_curve.iloc[-1] / initial_investment) - 1.0
        
        # Annualized values
        n_years = len(portfolio_equity_curve) / 252.0
        if n_years > 0:
            ann_portfolio_return = (portfolio_equity_curve.iloc[-1] / initial_investment) ** (1.0 / n_years) - 1.0
        else:
            ann_portfolio_return = 0.0

        daily_vol = portfolio_daily_returns.std()
        ann_portfolio_volatility = daily_vol * np.sqrt(252)

        # Sharpe Ratio
        if ann_portfolio_volatility > 0:
            portfolio_sharpe = (ann_portfolio_return - self.risk_free_rate) / ann_portfolio_volatility
        else:
            portfolio_sharpe = 0.0

        # Drawdowns
        running_peak = portfolio_equity_curve.cummax()
        portfolio_drawdowns = (portfolio_equity_curve - running_peak) / running_peak
        portfolio_max_drawdown = portfolio_drawdowns.min()

        results = {
            "initial_investment": initial_investment,
            "final_value": float(portfolio_equity_curve.iloc[-1]),
            "total_return": float(total_portfolio_return),
            "annualized_return": float(ann_portfolio_return),
            "annualized_volatility": float(ann_portfolio_volatility),
            "sharpe_ratio": float(portfolio_sharpe),
            "max_drawdown": float(portfolio_max_drawdown),
            "equity_curve": portfolio_equity_curve,
            "daily_returns": portfolio_daily_returns
        }

        # Benchmark Integration
        try:
            start_date = subset_df.index[0].strftime("%Y-%m-%d")
            end_date = subset_df.index[-1].strftime("%Y-%m-%d")
            logger.info(f"Downloading benchmark ({benchmark_symbol}) from {start_date} to {end_date}")
            
            benchmark_data = yf.download(benchmark_symbol, start=start_date, end=end_date, progress=False)
            if not benchmark_data.empty:
                # Align benchmark index with portfolio
                benchmark_close = benchmark_data["Adj Close"] if "Adj Close" in benchmark_data.columns else benchmark_data["Close"]
                benchmark_close = benchmark_close.reindex(subset_df.index).ffill().bfill()
                
                benchmark_normalized = benchmark_close / benchmark_close.iloc[0]
                benchmark_equity_curve = benchmark_normalized * initial_investment
                benchmark_daily_returns = benchmark_normalized.pct_change().dropna()
                
                # Calculate benchmark metrics
                total_benchmark_return = (benchmark_equity_curve.iloc[-1] / initial_investment) - 1.0
                ann_bench_return = (benchmark_equity_curve.iloc[-1] / initial_investment) ** (1.0 / n_years) - 1.0 if n_years > 0 else 0.0
                bench_daily_vol = benchmark_daily_returns.std()
                ann_bench_vol = bench_daily_vol * np.sqrt(252)
                bench_sharpe = (ann_bench_return - self.risk_free_rate) / ann_bench_vol if ann_bench_vol > 0 else 0.0
                
                bench_peak = benchmark_equity_curve.cummax()
                bench_drawdowns = (benchmark_equity_curve - bench_peak) / bench_peak
                bench_max_dd = bench_drawdowns.min()

                # Save Benchmark comparison data to results
                results["benchmark_symbol"] = benchmark_symbol
                results["benchmark_equity_curve"] = benchmark_equity_curve
                results["benchmark_total_return"] = float(total_benchmark_return)
                results["benchmark_annualized_return"] = float(ann_bench_return)
                results["benchmark_annualized_volatility"] = float(ann_bench_vol)
                results["benchmark_sharpe_ratio"] = float(bench_sharpe)
                results["benchmark_max_drawdown"] = float(bench_max_dd)
                
                logger.info(f"Benchmark simulation successful for index: {benchmark_symbol}")

        except Exception as err:
            logger.error(f"Failed to fetch or compute benchmark {benchmark_symbol}: {err}", exc_info=True)

        return results


# Simple self-test
if __name__ == "__main__":
    dates = pd.date_range("2026-01-01", periods=10)
    mock_close = pd.DataFrame({
        "AAPL": [150, 152, 151, 155, 154, 156, 157, 160, 158, 162],
        "MSFT": [300, 305, 302, 310, 308, 312, 311, 315, 314, 320]
    }, index=dates)

    simulator = PortfolioSimulator()
    res = simulator.simulate_portfolio(mock_close, {"AAPL": 0.5, "MSFT": 0.5}, initial_investment=10000.0)
    print("Portfolio Final Value:", res["final_value"])
    print("Portfolio Cumulative Return:", res["total_return"])
