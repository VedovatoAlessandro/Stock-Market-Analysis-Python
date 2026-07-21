"""
Interactive Streamlit Dashboard for Stock-Market-Analysis-Python.
Allows users to dynamically query yfinance, run financial risk metrics,
visualize asset correlation, and simulate custom portfolio allocations.

Usage:
    streamlit run app.py

Author: Junior Quantitative Developer / Analyst Portfolio
"""

import datetime
import pandas as pd
import numpy as np
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

from src.data_loader import StockDataLoader
from src.analysis import FinancialAnalyzer
from src.portfolio import PortfolioSimulator

# Set Page Config
st.set_page_config(
    page_title="Stock Market Analytics & Portfolio Simulator",
    page_icon="📈",
    layout="wide"
)

# Title & Description
st.title("📈 Stock Market Ingestion, Analysis & Portfolio Simulator")
st.markdown("""
This interactive platform runs historical financial analyses. It aggregates daily pricing data, computes quantitative 
risk-return factors (CAGR, Volatility, Sharpe, Drawdown), and models rebalanced portfolios compared against the S&P 500 benchmark.
*Created as a Python software portfolio piece.*
""")

# Sidebar controls
st.sidebar.header("⚙️ Analysis Configurations")

# Default values
default_tickers = ["AAPL", "MSFT", "NVDA", "TSLA"]
tickers_input = st.sidebar.text_input(
    "Asset Ticker Symbols (comma separated)",
    value=", ".join(default_tickers)
)
tickers = [t.strip().upper() for t in tickers_input.split(",") if t.strip()]

# Custom dates
start_date = st.sidebar.date_input("Start Date", datetime.date.today() - datetime.timedelta(days=365))
end_date = st.sidebar.date_input("End Date", datetime.date.today())

# Capital Ingestion
capital = st.sidebar.number_input(
    "Initial Portfolio Investment ($)",
    min_value=100,
    max_value=100000000,
    value=10000,
    step=1000
)

# Trigger Ingestion
if len(tickers) == 0:
    st.error("Please provide at least one ticker symbol.")
else:
    # 1. Download data
    loader = StockDataLoader(data_dir="data")
    analyzer = FinancialAnalyzer()
    portfolio_sim = PortfolioSimulator()

    with st.spinner("Ingesting historical prices from Yahoo Finance..."):
        try:
            # Download tickers + SPY benchmark
            fetch_tickers = list(set(tickers + ["SPY"]))
            raw_data = loader.fetch_stock_data(fetch_tickers, start_date, end_date)
        except Exception as e:
            st.error(f"Error fetching data: {e}")
            raw_data = pd.DataFrame()

    if not raw_data.empty:
        # Separate columns
        close_prices = pd.DataFrame(index=raw_data.index)
        volume_df = pd.DataFrame(index=raw_data.index)

        for ticker in tickers:
            if len(fetch_tickers) > 1:
                if ticker in raw_data.columns.levels[0]:
                    close_prices[ticker] = raw_data[ticker]["Close"]
                    volume_df[ticker] = raw_data[ticker]["Volume"]
            else:
                close_prices[ticker] = raw_data["Close"] if "Close" in raw_data.columns else raw_data
                volume_df[ticker] = raw_data["Volume"] if "Volume" in raw_data.columns else pd.Series(0, index=raw_data.index)

        # Main Layout Tabs
        tab_market, tab_portfolio, tab_corr = st.tabs([
            "📊 Single Stock Analysis", 
            "💼 Portfolio Simulator", 
            "🕸️ Multi-Asset Correlations"
        ])

        with tab_market:
            st.header("Individual Stock Quant Performance")
            
            # Select stock to focus
            focus_ticker = st.selectbox("Select Asset to Examine", options=tickers)
            
            if focus_ticker in close_prices.columns:
                stock_series = close_prices[focus_ticker]
                stock_volume = volume_df[focus_ticker] if focus_ticker in volume_df.columns else pd.Series(0, index=stock_series.index)
                
                # Calculations
                ma_results = analyzer.calculate_moving_averages(stock_series)
                metrics = analyzer.calculate_risk_metrics(stock_series)
                
                # Metrics Cards
                m_col1, m_col2, m_col3, m_col4, m_col5 = st.columns(5)
                m_col1.metric("Cumulative Return", f"{metrics['cumulative_return']*100:.2f}%")
                m_col2.metric("Annualized CAGR", f"{metrics['annualized_return']*100:.2f}%")
                m_col3.metric("Annual Volatility", f"{metrics['annualized_volatility']*100:.2f}%")
                m_col4.metric("Sharpe Ratio", f"{metrics['sharpe_ratio']:.2f}")
                m_col5.metric("Max Drawdown", f"{metrics['max_drawdown']*100:.2f}%")

                # Plot Price and MAs with Plotly
                fig_price = go.Figure()
                fig_price.add_trace(go.Scatter(x=stock_series.index, y=stock_series.values, name=f"{focus_ticker} Price", line=dict(color="#1f77b4", width=2)))
                
                # Add SMAs
                for sma_name, sma_series in ma_results.items():
                    if not sma_series.isna().all():
                        fig_price.add_trace(go.Scatter(x=sma_series.index, y=sma_series.values, name=sma_name, line=dict(dash="dash")))

                fig_price.update_layout(
                    title=f"{focus_ticker} Price Curve & Moving Averages (50 / 200 Days)",
                    xaxis_title="Date",
                    yaxis_title="Price (USD)",
                    height=500,
                    margin=dict(l=10, r=10, t=40, b=10)
                )
                st.plotly_chart(fig_price, use_container_width=True)

                # Returns Distribution Plot
                daily_pct = metrics["daily_returns_series"] * 100.0
                fig_dist = px.histogram(
                    daily_pct, 
                    nbins=60, 
                    marginal="box", 
                    title=f"{focus_ticker} Daily Return Distribution (%)",
                    labels={"value": "Daily Return (%)"},
                    color_discrete_sequence=["#d62728"]
                )
                st.plotly_chart(fig_dist, use_container_width=True)

        with tab_portfolio:
            st.header("Custom Portfolio Modeling")
            st.markdown("Assign weight allocations for each selected ticker. **Sum must equal 100%.**")

            # Allocate weights
            p_cols = st.columns(len(tickers))
            weights = {}
            for i, tick in enumerate(tickers):
                with p_cols[i]:
                    weight_val = st.number_input(
                        f"Weight {tick} (%)",
                        min_value=0,
                        max_value=100,
                        value=int(100 / len(tickers)),
                        step=5,
                        key=f"weight_{tick}"
                    )
                    weights[tick] = weight_val / 100.0

            sum_weights = sum(weights.values())
            st.info(f"Total Portfolio Weights: {sum_weights*100:.1f}%")

            if not np.isclose(sum_weights, 1.0, atol=1e-3):
                st.warning("⚠️ Total weights must equal 100% to run the simulator.")
            else:
                # Simulate Portfolio
                p_results = portfolio_sim.simulate_portfolio(
                    prices_df=close_prices,
                    allocations=weights,
                    initial_investment=capital,
                    benchmark_symbol="SPY"
                )

                # Metrics grid
                pm_col1, pm_col2, pm_col3, pm_col4 = st.columns(4)
                with pm_col1:
                    st.subheader("Your Portfolio")
                    st.metric("Total Return", f"{p_results['total_return']*100:.2f}%")
                    st.metric("Annualized CAGR", f"{p_results['annualized_return']*100:.2f}%")
                    st.metric("Sharpe Ratio", f"{p_results['sharpe_ratio']:.2f}")
                    st.metric("Max Drawdown", f"{p_results['max_drawdown']*100:.2f}%")

                with pm_col2:
                    st.subheader("S&P 500 (SPY)")
                    if "benchmark_total_return" in p_results:
                        st.metric("Total Return", f"{p_results['benchmark_total_return']*100:.2f}%")
                        st.metric("Annualized CAGR", f"{p_results['benchmark_annualized_return']*100:.2f}%")
                        st.metric("Sharpe Ratio", f"{p_results['benchmark_sharpe_ratio']:.2f}")
                        st.metric("Max Drawdown", f"{p_results['benchmark_max_drawdown']*100:.2f}%")
                    else:
                        st.write("Benchmark unavailable.")

                with pm_col3:
                    st.subheader("Final Portfolio Value")
                    st.write(f"💵 **Portfolio:** ${p_results['final_value']:,.2f}")
                    if "benchmark_equity_curve" in p_results:
                        st.write(f"📈 **S&P 500:** ${p_results['benchmark_equity_curve'].iloc[-1]:,.2f}")
                    
                    alpha = p_results['total_return'] - p_results.get('benchmark_total_return', 0.0)
                    st.write(f"🔥 **Net Alpha generated:** {alpha*100:+.2f}%")

                # Plot comparison curves
                fig_eq = go.Figure()
                fig_eq.add_trace(go.Scatter(x=p_results['equity_curve'].index, y=p_results['equity_curve'].values, name="Your Portfolio", line=dict(color="#2ca02c", width=2.5)))
                
                if "benchmark_equity_curve" in p_results:
                    fig_eq.add_trace(go.Scatter(x=p_results['benchmark_equity_curve'].index, y=p_results['benchmark_equity_curve'].values, name="S&P 500 (SPY)", line=dict(color="#7f7f7f", width=1.5, dash="dot")))

                fig_eq.update_layout(
                    title="Portfolio Valuation Over Time ($) vs. S&P 500 Benchmark",
                    xaxis_title="Date",
                    yaxis_title="Valuation ($)",
                    height=500
                )
                st.plotly_chart(fig_eq, use_container_width=True)

        with tab_corr:
            st.header("Multi-Asset Cross Correlations")
            if len(tickers) > 1:
                # Compute returns correlation
                corr_matrix = analyzer.calculate_correlation_matrix(close_prices)
                
                fig_corr = px.imshow(
                    corr_matrix,
                    text_auto=".2f",
                    color_continuous_scale="RdBu_r",
                    zmin=-1.0,
                    zmax=1.0,
                    title="Pearson Correlation Coefficient on Asset Daily Returns"
                )
                st.plotly_chart(fig_corr, use_container_width=True)
                
                # Risk Reward Scatter Plot
                risk_rewards = []
                for ticker in tickers:
                    metrics = analyzer.calculate_risk_metrics(close_prices[ticker])
                    risk_rewards.append({
                        "Ticker": ticker,
                        "Annualized Volatility (%)": metrics["annualized_volatility"] * 100.0,
                        "Annualized Return (%)": metrics["annualized_return"] * 100.0,
                        "Sharpe Ratio": metrics["sharpe_ratio"]
                    })
                
                rr_df = pd.DataFrame(risk_rewards)
                fig_scatter = px.scatter(
                    rr_df,
                    x="Annualized Volatility (%)",
                    y="Annualized Return (%)",
                    text="Ticker",
                    size="Sharpe Ratio",
                    color="Ticker",
                    title="Efficient Frontier: Risk vs. Return (Size = Sharpe Ratio)"
                )
                fig_scatter.update_traces(textposition="top center", marker=dict(sizeref=0.1, sizemode="diameter"))
                st.plotly_chart(fig_scatter, use_container_width=True)
            else:
                st.warning("Please specify more than one ticker symbol to calculate correlations.")
    else:
        st.warning("No pricing data found. Please check ticker spelling and dates.")
