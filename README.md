# Stock-Market-Analysis-Workspace 📈

A professional-grade portfolio application showcasing a modular **Quantitative Finance Analyzer** built with **Python 3** and served via an interactive full-stack **React + Express** dashboard.

This workspace splits into two core divisions:

1. **The Core Python Repository (`/Stock-Market-Analysis-Python`)**:
   - The standalone mathematical library using `pandas`, `numpy`, `yfinance`, and `seaborn`.
   - Includes data loading pipelines, quantitative metrics calculators, plotting scripts, and a Streamlit dashboard.
   - Contains its own dedicated **[Python Module README.md](./Stock-Market-Analysis-Python/README.md)**.
2. **The Interactive Web Showcase Dashboard (Root / `/src` / `/server.ts`)**:
   - Built on React 18, Tailwind CSS, Recharts, and Express.
   - Allows live parameter optimization, interactive portfolio simulations, cross-asset correlation analysis, and dynamic AI investment reviews via Gemini.

---

## 📂 Workspace Layout

```text
.
├── README.md                      # Workspace documentation (this file)
├── server.ts                      # Full-stack Node.js / Express API Server
├── package.json                   # Web application manifest and scripts
├── vite.config.ts                 # React bundler config
│
├── Stock-Market-Analysis-Python/  # The standalone Python Repository
│   ├── README.md                  # Comprehensive Python Quant Readme
│   ├── main.py                    # CLI execution entry point
│   ├── app.py                     # Streamlit dashboard interface
│   ├── requirements.txt           # Python library requirements
│   ├── notebooks/                 # Exploratory research notebooks
│   └── src/                       # Modular financial libraries
│
└── src/                           # Interactive Web Frontend
    ├── App.tsx                    # Main showcase application layout
    ├── components/                # Modular visual dashboard widgets
    └── types.ts                   # Unified typescript type definitions
```

---

## 💻 Exploring the READMEs

- **Showcase Interface**: Navigate to the **Code Explorer** tab in the live running web application. The file browser will automatically select and render the showcased **Python README.md** inside the custom editor workspace.
- **Standalone Download**: Click **"Download Python Repository (ZIP)"** in the header to get the clean standalone Python folder containing its README and code, ready to run locally.

---

## ⚙️ Running the Full-Stack Web Showcase

To launch the interactive React + Express showcase dashboard locally:

1. **Install web dependencies**:
   ```bash
   npm install
   ```
2. **Configure environment secrets**:
   Create a `.env` file at the root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```
3. **Launch in development mode**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with the dashboard.
