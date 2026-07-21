"""
Financial Visualization module for Stock Market Analysis.
Builds professional-grade Matplotlib, Seaborn, and Interactive Plotly charts
for financial price series, return distributions, and correlations.

Author: Junior Quantitative Developer / Analyst Portfolio
"""

import os
import logging
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pandas as pd
from typing import Dict, List, Optional

# Configure Matplotlib styling to modern professional defaults
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "ggplot")
plt.rcParams["figure.figsize"] = (12, 6)
plt.rcParams["font.family"] = "sans-serif"
plt.rcParams["font.size"] = 10

logger = logging.getLogger("VisualizationEngine")


class FinancialVisualizer:
    """
    Renders high-quality static and interactive charts for portfolio showcases.
    Saves outputs in the reports/ directory.
    """

    def __init__(self, output_dir: str = "reports"):
        """
        Initializes the FinancialVisualizer.
        
        Parameters:
            output_dir (str): Location to save image artifacts.
        """
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            logger.info(f"Created visualization output directory: {output_dir}")

    def plot_price_and_volume(
        self,
        prices: pd.Series,
        volume: pd.Series,
        ticker: str,
        moving_averages: Optional[Dict[str, pd.Series]] = None,
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """
        Creates a dual-subplot visual combining historical Adj Close pricing 
        with Moving Averages (top) and Trading Volume bars (bottom).

        Parameters:
            prices (pd.Series): Stock prices.
            volume (pd.Series): Volume series.
            ticker (str): Asset ticket identifier.
            moving_averages (dict): Optional pre-calculated SMA series.
            save_path (str): Optional filename to save.
            
        Returns:
            plt.Figure: The constructed matplotlib figure.
        """
        fig, (ax_price, ax_vol) = plt.subplots(
            2, 1, sharex=True, gridspec_kw={"height_ratios": [3, 1]}, figsize=(12, 8)
        )

        # Plot Prices
        ax_price.plot(prices.index, prices.values, label=f"{ticker} Close", color="#1f77b4", linewidth=1.8)
        
        # Overlay Moving Averages
        if moving_averages:
            colors = {"SMA_50": "#ff7f0e", "SMA_200": "#2ca02c"}
            for ma_name, ma_series in moving_averages.items():
                if not ma_series.isna().all():
                    ax_price.plot(
                        ma_series.index,
                        ma_series.values,
                        label=ma_name,
                        color=colors.get(ma_name, "#7f7f7f"),
                        linestyle="--",
                        alpha=0.8
                    )

        ax_price.set_title(f"{ticker} Historical Prices & Trading Volume", fontsize=14, fontweight="bold")
        ax_price.set_ylabel("Price (USD)", fontsize=11)
        ax_price.legend(loc="upper left")
        ax_price.grid(True, alpha=0.3)

        # Plot Volume
        ax_vol.bar(volume.index, volume.values, color="#7f7f7f", alpha=0.5, width=1.0, label="Volume")
        ax_vol.set_ylabel("Volume", fontsize=11)
        ax_vol.set_xlabel("Date", fontsize=11)
        ax_vol.legend(loc="upper left")
        ax_vol.grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            full_path = os.path.join(self.output_dir, save_path)
            plt.savefig(full_path, dpi=300)
            logger.info(f"Saved price/volume chart to {full_path}")
            plt.close()

        return fig

    def plot_daily_returns_distribution(
        self,
        returns: pd.Series,
        ticker: str,
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """
        Plots a histogram and overlayed Kernel Density Estimate (KDE) for Daily Returns.
        Used to assess fat tails and skewness relative to standard Normal distributions.

        Parameters:
            returns (pd.Series): Series of percentage returns.
            ticker (str): Asset identifier.
            save_path (str): File destination.

        Returns:
            plt.Figure: Matplotlib figure.
        """
        fig, ax = plt.subplots(figsize=(10, 5))
        
        # Calculate returns in percent
        pct_returns = returns * 100.0

        # Plot distribution
        sns.histplot(
            pct_returns,
            kde=True,
            ax=ax,
            color="#d62728",
            bins=50,
            stat="density",
            alpha=0.6,
            edgecolor="white"
        )
        
        # Plot mean reference line
        mean_val = pct_returns.mean()
        std_val = pct_returns.std()
        ax.axvline(mean_val, color="black", linestyle="--", linewidth=1.5, label=f"Mean: {mean_val:.3f}%")
        ax.axvline(mean_val - std_val, color="blue", linestyle=":", linewidth=1.0, label=f"-1 Std Dev: {mean_val-std_val:.2f}%")
        ax.axvline(mean_val + std_val, color="blue", linestyle=":", linewidth=1.0, label=f"+1 Std Dev: {mean_val+std_val:.2f}%")

        ax.set_title(f"{ticker} Daily Returns Distribution (%)", fontsize=13, fontweight="bold")
        ax.set_xlabel("Daily Return (%)", fontsize=11)
        ax.set_ylabel("Density", fontsize=11)
        ax.legend(loc="upper right")
        ax.grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            full_path = os.path.join(self.output_dir, save_path)
            plt.savefig(full_path, dpi=300)
            logger.info(f"Saved returns distribution to {full_path}")
            plt.close()

        return fig

    def plot_correlation_heatmap(
        self,
        corr_matrix: pd.DataFrame,
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """
        Generates a visually striking, annotated heatmap of asset correlations.

        Parameters:
            corr_matrix (pd.DataFrame): Asset-asset correlation values.
            save_path (str): File path.

        Returns:
            plt.Figure: Matplotlib figure.
        """
        fig, ax = plt.subplots(figsize=(8, 6))

        # Generate upper triangular mask to hide redundant half
        mask = np.triu(np.ones_like(corr_matrix, dtype=bool))

        # Render heatmap
        sns.heatmap(
            corr_matrix,
            mask=mask,
            annot=True,
            fmt=".2f",
            cmap="coolwarm",
            vmin=-1.0,
            vmax=1.0,
            square=True,
            linewidths=0.5,
            cbar_kws={"shrink": 0.8},
            ax=ax
        )

        ax.set_title("Asset Returns Correlation Matrix", fontsize=13, fontweight="bold")
        plt.tight_layout()

        if save_path:
            full_path = os.path.join(self.output_dir, save_path)
            plt.savefig(full_path, dpi=300)
            logger.info(f"Saved correlation heatmap to {full_path}")
            plt.close()

        return fig

    def plot_risk_return_scatter(
        self,
        risk_return_data: Dict[str, Dict[str, float]],
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """
        Plots multiple companies on an Annualized Return (y-axis) vs. Annualized Volatility (x-axis) scatter grid.
        Efficient frontier visualization helper.

        Parameters:
            risk_return_data (dict): Dict mapping ticker -> {'annualized_return': float, 'annualized_volatility': float}
            save_path (str): Output filename.

        Returns:
            plt.Figure: Matplotlib figure.
        """
        fig, ax = plt.subplots(figsize=(10, 6))

        volatilities = []
        returns = []
        tickers = []

        for tick, metrics in risk_return_data.items():
            vol = metrics["annualized_volatility"] * 100.0  # Convert to %
            ret = metrics["annualized_return"] * 100.0      # Convert to %
            volatilities.append(vol)
            returns.append(ret)
            tickers.append(tick)

            ax.scatter(vol, ret, s=200, marker="o", alpha=0.8, edgecolors="black", label=tick)
            ax.annotate(
                tick,
                (vol, ret),
                textcoords="offset points",
                xytext=(0, 10),
                ha="center",
                fontweight="bold",
                fontsize=11
            )

        ax.set_title("Risk vs. Return Profile (Annualized)", fontsize=13, fontweight="bold")
        ax.set_xlabel("Annualized Volatility (Risk) (%)", fontsize=11)
        ax.set_ylabel("Annualized Return (Reward) (%)", fontsize=11)
        ax.grid(True, alpha=0.3)
        
        # Draw some baseline quadrants if data is available
        if volatilities and returns:
            ax.axvline(np.mean(volatilities), color="grey", linestyle="--", alpha=0.5, label="Average Risk")
            ax.axhline(np.mean(returns), color="grey", linestyle="--", alpha=0.5, label="Average Return")
            ax.legend(loc="lower right")

        plt.tight_layout()

        if save_path:
            full_path = os.path.join(self.output_dir, save_path)
            plt.savefig(full_path, dpi=300)
            logger.info(f"Saved risk-return scatter to {full_path}")
            plt.close()

        return fig


if __name__ == "__main__":
    # Smoke test visualizer
    viz = FinancialVisualizer()
    corr = pd.DataFrame(
        [[1.0, 0.6, 0.2], [0.6, 1.0, -0.1], [0.2, -0.1, 1.0]],
        index=["AAPL", "MSFT", "GOLD"],
        columns=["AAPL", "MSFT", "GOLD"]
    )
    viz.plot_correlation_heatmap(corr)
