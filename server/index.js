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
  baseUrl: process.env.ALPACA_PAPER === 'true' 
    ? 'https://paper-api.alpaca.markets/v2'
    : 'https://api.alpaca.markets'
});

console.log(`Alpaca Client Initialized: Using ${process.env.ALPACA_PAPER === 'true' ? 'PAPER' : 'LIVE'} environment.`);

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
