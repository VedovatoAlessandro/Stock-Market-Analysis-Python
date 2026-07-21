"""
Financial Analysis Engine module for Stock Market Analysis.
Performs quantitative financial calculations including returns, volatility,
Sharpe ratio, drawdowns, and technical indicators.

Author: Junior Quantitative Developer / Analyst Portfolio
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, Union, Tuple

logger = logging.getLogger("AnalysisEngine")


class FinancialAnalyzer:
    """
    Applies statistical and quantitative formulations on stock price series.
    Provides rigorous risk-return metrics for financial assets.
    """

    @staticmethod
    def calculate_daily_returns(prices: pd.Series) -> pd.Series:
        """
        Calculates simple daily percent returns.
        Formulation: R_t = (P_t - P_{t-1}) / P_{t-1} = (P_t / P_{t-1}) - 1
        
        Parameters:
            prices (pd.Series): Stock closing prices.

        Returns:
            pd.Series: Percentage returns.
        """
        if prices.empty:
            return pd.Series(dtype=float)
        return prices.pct_change().dropna()

    @staticmethod
    def calculate_moving_averages(prices: pd.Series, windows: Tuple[int, ...] = (50, 200)) -> Dict[str, pd.Series]:
        """
        Calculates simple moving averages (SMA) for defined intervals.
        Used by analysts to identify trend reversals and support/resistance zones.
        
        Parameters:
            prices (pd.Series): Closing prices.
            windows (tuple): Moving average periods. Default: (50, 200).

        Returns:
            dict: Dictionary mapping "SMA_{window}" to their respective Series.
        """
        ma_dict = {}
        for w in windows:
            if len(prices) >= w:
                ma_dict[f"SMA_{w}"] = prices.rolling(window=w).mean()
                logger.info(f"Calculated SMA_{w} for series of length {len(prices)}.")
            else:
                ma_dict[f"SMA_{w}"] = pd.Series(index=prices.index, dtype=float)
                logger.warning(f"Insufficient historical periods to compute SMA_{w} (needed {w}, got {len(prices)}).")
        return ma_dict

    def calculate_risk_metrics(
        self,
        prices: pd.Series,
        risk_free_rate: float = 0.02,
        trading_days: int = 252
    ) -> Dict[str, Union[float, pd.Series]]:
        """
        Computes key risk and performance metrics over the entire historical window.

        Metrics Calculated:
        - Cumulative Return: Total gain/loss of holding the stock from start to finish.
        - Annualized Return: Compound Annual Growth Rate (CAGR).
        - Annualized Volatility: Standard deviation of returns scaled to annual trading days (252).
        - Sharpe Ratio: Risk-adjusted reward. Measure of return per unit of volatility.
        - Maximum Drawdown: Greatest peak-to-trough decline (critical risk control).

        Parameters:
            prices (pd.Series): Closing prices.
            risk_free_rate (float): Annual risk-free asset return (e.g. 0.02 for 2% Treasury yields).
            trading_days (int): Active equity market trading sessions per year (typically 252).

        Returns:
            dict: Dictionary containing floating-point values of financial statistics.
        """
        if prices.empty or len(prices) < 2:
            return {
                "cumulative_return": 0.0,
                "annualized_return": 0.0,
                "annualized_volatility": 0.0,
                "sharpe_ratio": 0.0,
                "max_drawdown": 0.0
            }

        # Calculate Returns
        daily_returns = self.calculate_daily_returns(prices)
        
        # 1. Cumulative Return
        # Formulation: P_final / P_initial - 1
        cum_ret = (prices.iloc[-1] / prices.iloc[0]) - 1.0

        # 2. Annualized Return (Compound Annual Growth Rate)
        # Calculates the hypothetical constant annual return over the period
        n_years = len(prices) / trading_days
        if n_years > 0:
            ann_ret = (prices.iloc[-1] / prices.iloc[0]) ** (1.0 / n_years) - 1.0
        else:
            ann_ret = 0.0

        # 3. Annualized Volatility
        # Formulation: std(daily_returns) * sqrt(252)
        daily_vol = daily_returns.std()
        ann_vol = daily_vol * np.sqrt(trading_days) if not pd.isna(daily_vol) else 0.0

        # 4. Sharpe Ratio
        # Formulation: (Annualized Return - Risk-Free Rate) / Annualized Volatility
        # Measures whether returns are due to smart investment decisions or excess risk.
        if ann_vol > 0:
            sharpe = (ann_ret - risk_free_rate) / ann_vol
        else:
            sharpe = 0.0

        # 5. Maximum Drawdown
        # Drawdown is the decline from a historical running high.
        # Max Drawdown is the maximum peak-to-trough loss over the investment life.
        running_max = prices.cummax()
        drawdowns = (prices - running_max) / running_max
        max_dd = drawdowns.min()  # Will be negative or zero (e.g. -0.25 represents -25% drawdown)

        return {
            "cumulative_return": float(cum_ret),
            "annualized_return": float(ann_ret),
            "annualized_volatility": float(ann_vol),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "drawdown_series": drawdowns,
            "daily_returns_series": daily_returns
        }

    @staticmethod
    def calculate_correlation_matrix(df_pricing: pd.DataFrame) -> pd.DataFrame:
        """
        Computes the Pearson correlation matrix of daily returns across multiple tickers.
        Helps quantitative researchers select uncorrelated assets for diversification.

        Parameters:
            df_pricing (pd.DataFrame): Wide DataFrame with tickers as columns containing close prices.

        Returns:
            pd.DataFrame: Symmetrical Ticker x Ticker correlation matrix.
        """
        # Calculate percent returns for all columns
        returns_df = df_pricing.pct_change().dropna()
        return returns_df.corr(method="pearson")


# Run simple module validations
if __name__ == "__main__":
    analyzer = FinancialAnalyzer()
    # Mock stock series
    dates = pd.date_range("2026-01-01", periods=10)
    mock_prices = pd.Series([100, 102, 101, 105, 104, 110, 108, 112, 115, 113], index=dates)
    
    metrics = analyzer.calculate_risk_metrics(mock_prices)
    print("Mock Cumulative Return:", metrics["cumulative_return"])
    print("Mock Volatility:", metrics["annualized_volatility"])
    print("Mock Sharpe Ratio:", metrics["sharpe_ratio"])
    print("Mock Max Drawdown:", metrics["max_drawdown"])
