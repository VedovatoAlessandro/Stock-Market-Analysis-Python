#!/usr/bin/env python3
"""
Main entry point for Stock-Market-Analysis-Python.
Binds together data loader, analysis engine, visualization, and portfolio simulation.

Provides a robust command-line interface (CLI) to run the full pipeline.

Author: Junior Quantitative Developer / Analyst Portfolio
"""

import os
import argparse
import logging
from datetime import datetime, timedelta
import pandas as pd

from src.data_loader import StockDataLoader
from src.analysis import FinancialAnalyzer
from src.visualization import FinancialVisualizer
from src.portfolio import PortfolioSimulator

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("MainWorkflow")


def run_pipeline(
    tickers: list,
    start_date: str,
    end_date: str,
    output_dir: str,
    portfolio_weights: dict,
    investment: float
) -> None:
    """
    Executes the entire quantitative finance pipeline.
    """
    logger.info("=========================================")
    logger.info("Initializing Stock Market Analysis Pipeline")
    logger.info("=========================================")

    # 1. Ingest Data
    loader = StockDataLoader(data_dir=os.path.join(output_dir, "data"))
    
    # Download all unique tickers including benchmark index SPY if not present
    all_tickers_to_fetch = list(set(tickers + ["SPY"]))
    
    try:
        raw_prices = loader.fetch_stock_data(
            tickers=all_tickers_to_fetch,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        logger.error(f"Failed to fetch stock prices: {e}")
        return

    if raw_prices.empty:
        logger.error("No stock data downloaded. Aborting pipeline.")
        return

    # Cache cleaned data
    loader.save_to_csv(raw_prices, "cleaned_prices.csv")

    # 2. Extract Individual Stocks Metrics and Generate Technical Indicators
    analyzer = FinancialAnalyzer()
    visualizer = FinancialVisualizer(output_dir=os.path.join(output_dir, "reports"))
    
    risk_return_summary = {}
    
    # Extract wide columns (Close / Adj Close columns)
    # yfinance structures wide columns per ticker if multi-index is returned
    # Let's extract clean closed prices series for each stock
    cleaned_close_prices = pd.DataFrame(index=raw_prices.index)
    
    for ticker in tickers:
        try:
            # Handle yfinance multi-index columns vs flat series
            if len(tickers) > 1:
                # Multi-index or Multi-column
                if ticker in raw_prices.columns.levels[0]:
                    ticker_series = raw_prices[ticker]["Close"]
                    volume_series = raw_prices[ticker]["Volume"]
                else:
                    logger.warning(f"Ticker {ticker} not found in columns. Skipping.")
                    continue
            else:
                ticker_series = raw_prices["Close"] if "Close" in raw_prices.columns else raw_prices
                volume_series = raw_prices["Volume"] if "Volume" in raw_prices.columns else None

            cleaned_close_prices[ticker] = ticker_series

            logger.info(f"Analyzing ticker: {ticker}")
            
            # Compute Moving Averages
            ma_results = analyzer.calculate_moving_averages(ticker_series, windows=(50, 200))
            
            # Compute Risk Metrics
            metrics = analyzer.calculate_risk_metrics(ticker_series)
            risk_return_summary[ticker] = {
                "annualized_return": metrics["annualized_return"],
                "annualized_volatility": metrics["annualized_volatility"],
                "sharpe_ratio": metrics["sharpe_ratio"],
                "max_drawdown": metrics["max_drawdown"]
            }

            # Generate individual stock charts
            visualizer.plot_price_and_volume(
                prices=ticker_series,
                volume=volume_series if volume_series is not None else pd.Series(0, index=ticker_series.index),
                ticker=ticker,
                moving_averages=ma_results,
                save_path=f"{ticker}_analysis.png"
            )

            # Generate return distributions
            visualizer.plot_daily_returns_distribution(
                returns=metrics["daily_returns_series"],
                ticker=ticker,
                save_path=f"{ticker}_returns_dist.png"
            )

        except Exception as e:
            logger.error(f"Error analyzing {ticker}: {e}", exc_info=True)

    # 3. Generate Comparative Cross-Asset Visualizations
    if len(tickers) > 1 and cleaned_close_prices.shape[1] > 1:
        # Correlation Heatmap
        corr_matrix = analyzer.calculate_correlation_matrix(cleaned_close_prices)
        visualizer.plot_correlation_heatmap(corr_matrix, save_path="correlation_heatmap.png")

        # Risk-Return Comparison Scatter
        visualizer.plot_risk_return_scatter(risk_return_summary, save_path="risk_return_profile.png")

    # 4. Simulate Custom Weighted Portfolio
    logger.info("Initializing Portfolio Simulation Module")
    portfolio_sim = PortfolioSimulator()
    
    # Run simulation
    portfolio_results = portfolio_sim.simulate_portfolio(
        prices_df=cleaned_close_prices,
        allocations=portfolio_weights,
        initial_investment=investment,
        benchmark_symbol="SPY"
    )

    # Display quantitative summary of execution
    print("\n" + "="*50)
    print("      QUANTITATIVE PORTFOLIO PERFORMANCE SUMMARY      ")
    print("="*50)
    print(f"Simulation Period:   {start_date} to {end_date}")
    print(f"Initial Investment:  ${investment:,.2f}")
    print(f"Final Portfolio Val: ${portfolio_results['final_value']:,.2f}")
    print(f"Total Cumulative Ret: {portfolio_results['total_return']*100:.2f}%")
    print(f"Annualized Return:   {portfolio_results['annualized_return']*100:.2f}%")
    print(f"Annual Volatility:   {portfolio_results['annualized_volatility']*100:.2f}%")
    print(f"Portfolio Sharpe:    {portfolio_results['sharpe_ratio']:.2f}")
    print(f"Max Peak-to-Trough:  {portfolio_results['max_drawdown']*100:.2f}%")
    
    if "benchmark_total_return" in portfolio_results:
        print("-"*50)
        print(f"Benchmark Index:     {portfolio_results['benchmark_symbol']} (S&P 500)")
        print(f"Benchmark Cum Ret:   {portfolio_results['benchmark_total_return']*100:.2f}%")
        print(f"Benchmark Sharpe:    {portfolio_results['benchmark_sharpe_ratio']:.2f}")
        print(f"Benchmark Max DD:    {portfolio_results['benchmark_max_drawdown']*100:.2f}%")
        
        beating = portfolio_results['total_return'] > portfolio_results['benchmark_total_return']
        print(f"Alpha Generated:     {('YES (+' if beating else 'NO (')}{(portfolio_results['total_return'] - portfolio_results['benchmark_total_return'])*100:.2f}%)")
    print("="*50 + "\n")

    logger.info("Pipeline executed successfully! Reports generated in reports/")


def main():
    """
    Parses arguments to configure the quantitative finance sandbox.
    """
    parser = argparse.ArgumentParser(
        description="Stock Market Ingestion, Quantitative Analysis & Portfolio Simulator"
    )

    parser.add_argument(
        "--tickers",
        nargs="+",
        default=["AAPL", "MSFT", "NVDA", "TSLA"],
        help="List of space-separated ticker symbols to analyze"
    )
    
    parser.add_argument(
        "--start",
        default=(datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d"),
        help="Analysis start date (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--end",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="Analysis end date (YYYY-MM-DD)"
    )

    parser.add_argument(
        "--out",
        default=".",
        help="Root directory for caching data and saving charts"
    )

    parser.add_argument(
        "--weights",
        nargs="+",
        type=float,
        help="Allocations weights for portfolio. Must match tickers length (e.g. 0.4 0.3 0.2 0.1)"
    )

    parser.add_argument(
        "--capital",
        type=float,
        default=10000.0,
        help="Starting investment capital in USD (e.g. 50000)"
    )

    args = parser.parse_args()

    # Format weights map
    tickers = [t.upper() for t in args.tickers]
    
    if args.weights:
        if len(args.weights) != len(tickers):
            parser.error("Weights count must match tickers count.")
        weights_dict = dict(zip(tickers, args.weights))
    else:
        # Default to equal weight allocations
        equal_weight = 1.0 / len(tickers)
        weights_dict = {ticker: equal_weight for ticker in tickers}

    run_pipeline(
        tickers=tickers,
        start_date=args.start,
        end_date=args.end,
        output_dir=args.out,
        portfolio_weights=weights_dict,
        investment=args.capital
    )


if __name__ == "__main__":
    main()
