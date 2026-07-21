# Stock-Market-Analysis-Python 📈

A professional-grade quantitative finance analysis, cross-asset correlation mapping, and custom weighted portfolio simulation engine.

This repository is designed to fetch historical stock prices, perform clean mathematical valuations on volatility and risk factors, and construct portfolio benchmarks against index trackers like the S&P 500 (SPY).

---

## 🚀 Key Features

1. **Robust Data Ingestion**:
   - Integrates with Yahoo Finance API via `yfinance`.
   - Supports arbitrary stock list declarations and customizable dates.
   - Fault-tolerant caching and custom serialization to CSV files.

2. **Data Ingest Hygiene**:
   - Automated index verification, duplication cleaning, and forward/backward imputation of missing data points.

3. **Quantitative Metrics Engine**:
   - Calculates daily percent returns.
   - Computes compound annual growth rates (CAGR).
   - Scales and measures annualized volatility.
   - Calculates **Sharpe Ratio** (risk-adjusted reward index).
   - Tracks **Maximum Drawdown** (peak-to-trough extreme risk measurement).
   - Overlays **Simple Moving Averages** (50-day and 200-day SMA).

4. **Professional Visual Artifacts**:
   - Integrated dual-chart plotting for pricing channels combined with trading volumes.
   - Kernel Density Estimate (KDE) over return probability distributions.
   - Interactive or formatted Pearson correlation matrix grids.
   - Risk-Return profile scatter plots representing asset efficiency front lines.

5. **Rebalanced Portfolio Simulator**:
   - Simulates allocations using user-defined weights.
   - Evaluates portfolio equity lines against S&P 500 trackers over historical timelines.

6. **Interactive Dashboard**:
   - Provides a comprehensive, beautiful Streamlit web interface as an optional dashboard wrapper.

---

## 🧮 Financial Formulations Implemented

- **Compound Annual Return (CAGR)**:
  $$\text{CAGR} = \left( \frac{Price_{End}}{Price_{Start}} \right)^{\frac{252}{N_{periods}}} - 1$$

- **Annualized Volatility**:
  $$\sigma_{annual} = \text{std}(\text{Daily Returns}) \times \sqrt{252}$$

- **Sharpe Ratio**:
  $$\text{Sharpe} = \frac{\text{CAGR} - R_{free}}{\sigma_{annual}}$$

- **Maximum Drawdown**:
  $$\text{Drawdown}_t = \frac{\text{Price}_t - \text{Running Peak}_t}{\text{Running Peak}_t}$$
  $$\text{Max Drawdown} = \min(\text{Drawdown}_t)$$

---

## 🛠️ Technology Stack

- **Python 3.9+**
- **Pandas**: Core tabular data structures and timeseries manipulations.
- **NumPy**: Linear algebra and fast array vectorization.
- **Matplotlib & Seaborn**: High-quality static visualizations and correlation maps.
- **Plotly**: Interactive charting channels.
- **yfinance API**: Open financial pricing channels from Yahoo Finance.
- **Streamlit**: Elegant web-based portfolio simulation UI.
- **Jupyter Notebook**: Interactive research and qualitative reports.

---

## 📦 Directory Structure

```text
Stock-Market-Analysis-Python/
│── README.md
│── requirements.txt
│── main.py
│── app.py                 # Streamlit dashboard
│
├── data/                  # Local cached stock datasets
│   └── cleaned_prices.csv
│
├── notebooks/             # Exploratory research notebooks
│   └── Stock_Analysis.ipynb
│
├── src/                   # Modular quantitative package
│   ├── data_loader.py     # Ingest & clean routines
│   ├── analysis.py        # Financial formulas
│   ├── visualization.py   # Charting modules
│   └── portfolio.py       # Portfolio simulators
│
└── reports/               # Output directory for saved charts and PDFs
```

---

## ⚙️ Installation & Execution

### 1. Clone the repository and navigate inside:
```bash
git clone https://github.com/your-username/Stock-Market-Analysis-Python.git
cd Stock-Market-Analysis-Python
```

### 2. Configure virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install packages:
```bash
pip install -r requirements.txt
```

### 4. Run full analysis via Command Line (CLI):
```bash
python main.py --tickers AAPL MSFT NVDA TSLA --start 2025-01-01 --end 2025-12-31 --capital 25000 --weights 0.3 0.3 0.2 0.2
```

### 5. Run Streamlit interactive dashboard:
```bash
streamlit run app.py
```

---

## 🔮 Future Enhancements
- Integrate Modern Portfolio Theory (MPT) and Markowitz Mean-Variance Optimization.
- Implement GARCH models for dynamic volatility forecasts.
- Connect alternative machine learning predictors (LSTM / Random Forest) on directionality.
- Support multi-currency rebalancing portfolios.
