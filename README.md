# Alpaca Trading Dashboard 📈

A modern, full-stack trading dashboard built with **React (TypeScript)** and **Node.js (Express)** that interfaces with the **Alpaca Trade API**. This application allows you to monitor your paper trading account, manage open positions, and run an automated trading strategy.

---

## ✨ Features

- **Real-time Account Metrics:** Monitor your Net Equity, Cash Balance, and Buying Power at a glance.
- **Position Management:** View all open positions with live P/L tracking and close them manually with a single click.
- **AI Strategy Toggle:** A dedicated control center to start or stop your automated trading algorithms.
- **Modern UI:** Built with a dark-themed, responsive dashboard layout using Lucide icons.
- **Safety First:** Defaults to the Alpaca Paper Trading environment to ensure no real capital is at risk during development.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Axios, Lucide-React
- **Backend:** Node.js, Express, Alpaca Node.js SDK
- **Styling:** Vanilla CSS (Custom Dashboard Design)

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- An [Alpaca](https://alpaca.markets/) account (Paper Trading keys)

### 2. Installation
Clone the repository and install dependencies for both the server and client:

```bash
# Install root dependencies (concurrently)
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 3. Environment Configuration
Create a `.env` file in the `server` directory (or edit the existing one):

```env
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_SECRET_KEY=your_paper_secret_key_here
ALPACA_PAPER=true
PORT=3001
```

### 4. Running the Application
From the **root directory**, run the following command to start both the backend and frontend simultaneously:

```bash
npm run dev
```

- **Dashboard:** [http://localhost:5173](http://localhost:5173)
- **API Server:** [http://localhost:3001](http://localhost:3001)

---

## 🤖 Customizing the Strategy

The core trading logic is located in `server/index.js` within the `runStrategy` function. 

Currently, it contains a placeholder "Hold" decision. You can integrate:
- **Technical Indicators:** Using libraries like `technicalindicators`.
- **AI/LLMs:** Calling OpenAI or LangChain to analyze sentiment or news before placing trades.
- **Webhooks:** Integrating with TradingView or other external signals.

---

## 📁 Project Structure

```text
alpaca/
├── client/              # React Frontend (Vite + TS)
│   ├── src/
│   │   ├── App.tsx      # Main Dashboard Logic
│   │   └── App.css      # Dashboard Styling
├── server/              # Express Backend
│   ├── index.js         # API & Strategy Engine
│   └── .env             # API Credentials (GIT IGNORED)
└── package.json         # Root configuration & scripts
```

---

## ⚠️ Disclaimer

**This software is for educational and simulation purposes only.** Trading stocks involves significant risk. Never trade with money you cannot afford to lose. The authors are not responsible for any financial losses incurred through the use of this software. Always verify your strategy in the Paper Trading environment before considering live deployment.

---

## 📄 License
ISC
