require('dotenv').config();
const express = require('express');
const Alpaca = require('@alpacahq/alpaca-trade-api');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: process.env.ALPACA_PAPER === 'true',
});

console.log(`Alpaca Client Initialized: Paper=${process.env.ALPACA_PAPER}`);

let strategyInterval = null;
let strategyRunning = false;
let lastLog = "Strategy not started.";

// Trading Strategy Logic
const runStrategy = async () => {
  try {
    lastLog = `Running strategy at ${new Date().toLocaleTimeString()}...`;
    // Example Simple Strategy: Buy 1 share of SPY if price is below a certain level (Mock AI logic)
    // In a real AI scenario, you'd call an LLM or a model here.
    
    // For this prototype, we'll just log and mock the logic.
    // actual trading calls:
    // await alpaca.createOrder({ symbol: 'SPY', qty: 1, side: 'buy', type: 'market', time_in_force: 'day' });
    
    lastLog += " - Decision: Hold (Simulated)";
  } catch (error) {
    lastLog = `Strategy Error: ${error.message}`;
    console.error(error);
  }
};

app.get('/api/account', async (req, res) => {
  try {
    const account = await alpaca.getAccount();
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/market/indices', async (req, res) => {
  try {
    const snapshot = await alpaca.getSnapshot('SPY');
    const currentPrice = snapshot.latestTrade?.p || snapshot.latestQuote?.ap || 0;
    const prevClose = snapshot.prevDailyBar?.c || currentPrice;
    const change = currentPrice - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    res.json({
      symbol: 'S&P 500 (SPY)',
      price: currentPrice,
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/market/movers', async (req, res) => {
  try {
    const tickers = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC', 'PYPL', 'ADBE', 'CRM', 'ORCL', 'CSCO', 'DIS', 'NKE', 'GS', 'MS', 'JPM'];
    const snapshotsResponse = await alpaca.getSnapshots(tickers);
    
    // Convert object/map to array if needed
    const snapshotList = Array.isArray(snapshotsResponse) ? snapshotsResponse : Object.values(snapshotsResponse);
    
    const movers = snapshotList.map(s => {
      const currentPrice = s.latestTrade?.p || s.latestQuote?.ap || 0;
      const prevClose = s.prevDailyBar?.c || currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
      return {
        symbol: s.symbol,
        price: currentPrice,
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2)
      };
    }).sort((a, b) => Math.abs(parseFloat(b.changePercent)) - Math.abs(parseFloat(a.changePercent))).slice(0, 5);
    
    res.json(movers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/portfolio/summary', async (req, res) => {
  try {
    const positions = await alpaca.getPositions();
    const unrealizedPL = positions.reduce((acc, pos) => acc + parseFloat(pos.unrealized_pl), 0);
    
    let realizedToday = 0;
    try {
      const history = await alpaca.getPortfolioHistory({ period: '1D', timeframe: '1Min' });
      if (history && history.profit_loss && history.profit_loss.length > 0) {
        const lastProfitLoss = history.profit_loss[history.profit_loss.length - 1] || 0;
        realizedToday = lastProfitLoss - unrealizedPL;
      }
    } catch (historyErr) {
      console.error("Error fetching portfolio history:", historyErr.message);
      // Fallback: Realized P/L from activities would go here, or stay 0
    }

    res.json({
      unrealized: unrealizedPL.toFixed(2),
      realized: realizedToday.toFixed(2),
      total: (unrealizedPL + realizedToday).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/positions', async (req, res) => {
  try {
    const positions = await alpaca.getPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/positions/:symbol', async (req, res) => {
  try {
    await alpaca.closePosition(req.params.symbol);
    res.json({ message: `Closed position for ${req.params.symbol}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/strategy/start', (req, res) => {
  if (strategyRunning) return res.json({ message: "Already running" });
  
  strategyRunning = true;
  strategyInterval = setInterval(runStrategy, 60000); // Run every minute
  runStrategy();
  res.json({ message: "Strategy started" });
});

app.post('/api/strategy/stop', (req, res) => {
  clearInterval(strategyInterval);
  strategyRunning = false;
  lastLog = "Strategy stopped.";
  res.json({ message: "Strategy stopped" });
});

app.get('/api/strategy/status', (req, res) => {
  res.json({ running: strategyRunning, lastLog });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
