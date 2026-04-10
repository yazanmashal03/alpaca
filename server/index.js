require('dotenv').config();
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const Alpaca = require('@alpacahq/alpaca-trade-api');
const cors = require('cors');

const {
  DEFAULT_POLL_INTERVAL_SECONDS,
  getTriggerAction,
  validateManualOrderInput,
  validatePollInterval,
  validateRuleInput,
} = require('./strategy');

const app = express();
app.use(cors());
app.use(express.json());

const paper = process.env.ALPACA_PAPER !== 'false';
const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper,
});

const DATA_DIR = path.join(__dirname, 'data');
const STRATEGY_FILE = path.join(DATA_DIR, 'strategy.json');

const strategyState = {
  running: false,
  pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
  lastRunAt: null,
  lastLog: 'Strategy not started.',
  lastError: null,
};

let strategyConfig = {
  pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
  rules: [],
};
let strategyInterval = null;
let strategyTickInProgress = false;
let httpServer = null;

console.log(`Alpaca Client Initialized: Paper=${paper}`);

function createDefaultRule(input) {
  return {
    id: crypto.randomUUID(),
    ...input,
    lastAction: 'none',
    lastActionAt: null,
  };
}

function createDefaultConfig() {
  return {
    pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
    rules: [],
  };
}

async function ensureStrategyConfigFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STRATEGY_FILE);
  } catch {
    await fs.writeFile(STRATEGY_FILE, JSON.stringify(createDefaultConfig(), null, 2));
  }
}

async function saveStrategyConfig() {
  const payload = JSON.stringify(
    {
      pollIntervalSeconds: strategyConfig.pollIntervalSeconds,
      rules: strategyConfig.rules,
    },
    null,
    2,
  );

  await fs.writeFile(STRATEGY_FILE, payload);
}

async function loadStrategyConfig() {
  await ensureStrategyConfigFile();
  const raw = await fs.readFile(STRATEGY_FILE, 'utf8');
  const parsed = JSON.parse(raw);

  const intervalValidation = validatePollInterval(parsed.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS);
  const nextRules = Array.isArray(parsed.rules) ? parsed.rules : [];
  const seenSymbols = new Set();

  strategyConfig = {
    pollIntervalSeconds: intervalValidation.value || DEFAULT_POLL_INTERVAL_SECONDS,
    rules: nextRules
      .map((rule) => {
        const validation = validateRuleInput(rule, []);
        if (!validation.value) {
          return null;
        }

        if (seenSymbols.has(validation.value.symbol)) {
          return null;
        }
        seenSymbols.add(validation.value.symbol);

        return {
          id: rule.id || crypto.randomUUID(),
          ...validation.value,
          lastAction: typeof rule.lastAction === 'string' ? rule.lastAction : 'none',
          lastActionAt: rule.lastActionAt || null,
        };
      })
      .filter(Boolean),
  };

  strategyState.pollIntervalSeconds = strategyConfig.pollIntervalSeconds;
}

function setStrategyLog(message, errorMessage = null) {
  strategyState.lastLog = message;
  strategyState.lastError = errorMessage;
}

function getStrategyStatus() {
  return {
    running: strategyState.running,
    paper,
    pollIntervalSeconds: strategyConfig.pollIntervalSeconds,
    lastRunAt: strategyState.lastRunAt,
    lastLog: strategyState.lastLog,
    lastError: strategyState.lastError,
  };
}

function getStrategyConfigResponse() {
  return {
    pollIntervalSeconds: strategyConfig.pollIntervalSeconds,
    rules: strategyConfig.rules,
  };
}

function stopStrategyLoop(message = 'Strategy stopped.') {
  if (strategyInterval) {
    clearInterval(strategyInterval);
    strategyInterval = null;
  }

  strategyState.running = false;
  setStrategyLog(message, null);
}

function startStrategyLoop() {
  if (strategyInterval) {
    clearInterval(strategyInterval);
  }

  strategyInterval = setInterval(runStrategyTick, strategyConfig.pollIntervalSeconds * 1000);
  strategyState.running = true;
}

async function getLatestPrice(symbol) {
  const snapshot = await alpaca.getSnapshot(symbol);
  return snapshot.latestTrade?.p || snapshot.latestQuote?.ap || snapshot.prevDailyBar?.c || null;
}

async function runStrategyTick() {
  if (strategyTickInProgress) {
    return;
  }

  strategyTickInProgress = true;
  strategyState.lastRunAt = new Date().toISOString();
  strategyState.lastError = null;

  try {
    const enabledRules = strategyConfig.rules.filter((rule) => rule.enabled);

    if (enabledRules.length === 0) {
      setStrategyLog(`Checked rules at ${new Date(strategyState.lastRunAt).toLocaleTimeString()}: no enabled rules.`);
      return;
    }

    const positions = await alpaca.getPositions();
    const heldBySymbol = new Map(
      positions.map((position) => [position.symbol, Math.abs(Number(position.qty || 0))]),
    );

    const actions = [];
    for (const rule of enabledRules) {
      const currentPrice = await getLatestPrice(rule.symbol);
      if (!(currentPrice > 0)) {
        actions.push(`${rule.symbol}: no market price available`);
        continue;
      }

      const heldQty = heldBySymbol.get(rule.symbol) || 0;
      const action = getTriggerAction(rule, currentPrice, heldQty);
      if (!action) {
        actions.push(`${rule.symbol}: hold at $${currentPrice.toFixed(2)}`);
        continue;
      }

      await alpaca.createOrder({
        symbol: rule.symbol,
        qty: action.qty,
        side: action.side,
        type: 'market',
        time_in_force: 'day',
      });

      rule.lastAction = `${action.side} ${action.qty} @ ${currentPrice.toFixed(2)}`;
      rule.lastActionAt = new Date().toISOString();
      actions.push(`${rule.symbol}: ${action.side} ${action.qty} shares`);
    }

    await saveStrategyConfig();
    setStrategyLog(`Checked ${enabledRules.length} rule(s): ${actions.join(' | ')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStrategyLog(`Strategy error at ${new Date().toLocaleTimeString()}.`, message);
    console.error(error);
  } finally {
    strategyTickInProgress = false;
  }
}

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
      changePercent: changePercent.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/market/movers', async (req, res) => {
  try {
    const tickers = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC', 'PYPL', 'ADBE', 'CRM', 'ORCL', 'CSCO', 'DIS', 'NKE', 'GS', 'MS', 'JPM'];
    const snapshotsResponse = await alpaca.getSnapshots(tickers);
    const snapshotList = Array.isArray(snapshotsResponse) ? snapshotsResponse : Object.values(snapshotsResponse);

    const movers = snapshotList
      .map((snapshot) => {
        const currentPrice = snapshot.latestTrade?.p || snapshot.latestQuote?.ap || 0;
        const prevClose = snapshot.prevDailyBar?.c || currentPrice;
        const change = currentPrice - prevClose;
        const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
        return {
          symbol: snapshot.symbol,
          price: currentPrice,
          change: change.toFixed(2),
          changePercent: changePercent.toFixed(2),
        };
      })
      .sort((a, b) => Math.abs(parseFloat(b.changePercent)) - Math.abs(parseFloat(a.changePercent)))
      .slice(0, 5);

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
      console.error('Error fetching portfolio history:', historyErr.message);
    }

    res.json({
      unrealized: unrealizedPL.toFixed(2),
      realized: realizedToday.toFixed(2),
      total: (unrealizedPL + realizedToday).toFixed(2),
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

app.post('/api/orders', async (req, res) => {
  const validation = validateManualOrderInput(req.body);
  if (!validation.value) {
    return res.status(400).json({ error: validation.error });
  }

  const orderRequest = {
    symbol: validation.value.symbol,
    qty: validation.value.qty,
    side: validation.value.side,
    type: validation.value.type,
    time_in_force: validation.value.time_in_force,
  };

  if (validation.value.type === 'limit') {
    orderRequest.limit_price = validation.value.limitPrice;
  }

  try {
    const order = await alpaca.createOrder(orderRequest);
    return res.status(201).json(order);
  } catch (error) {
    return res.status(500).json({ error: error.message });
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

app.get('/api/strategy/config', (req, res) => {
  res.json(getStrategyConfigResponse());
});

app.put('/api/strategy/config', async (req, res) => {
  const intervalValidation = validatePollInterval(req.body.pollIntervalSeconds);
  if (!intervalValidation.value) {
    return res.status(400).json({ error: intervalValidation.error });
  }

  try {
    strategyConfig.pollIntervalSeconds = intervalValidation.value;
    strategyState.pollIntervalSeconds = intervalValidation.value;
    await saveStrategyConfig();

    if (strategyState.running) {
      startStrategyLoop();
      setStrategyLog(`Strategy interval updated to ${intervalValidation.value} seconds.`);
    }

    return res.json(getStrategyConfigResponse());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/strategy/rules', async (req, res) => {
  const validation = validateRuleInput(req.body, strategyConfig.rules);
  if (!validation.value) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const nextRule = createDefaultRule(validation.value);
    strategyConfig.rules.push(nextRule);
    await saveStrategyConfig();
    return res.status(201).json(nextRule);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/strategy/rules/:id', async (req, res) => {
  const currentRule = strategyConfig.rules.find((rule) => rule.id === req.params.id);
  if (!currentRule) {
    return res.status(404).json({ error: 'Rule not found.' });
  }

  const validation = validateRuleInput(req.body, strategyConfig.rules, currentRule.id);
  if (!validation.value) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    Object.assign(currentRule, validation.value);
    await saveStrategyConfig();
    return res.json(currentRule);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/strategy/rules/:id', async (req, res) => {
  const nextRules = strategyConfig.rules.filter((rule) => rule.id !== req.params.id);
  if (nextRules.length === strategyConfig.rules.length) {
    return res.status(404).json({ error: 'Rule not found.' });
  }

  try {
    strategyConfig.rules = nextRules;
    await saveStrategyConfig();
    return res.json(getStrategyConfigResponse());
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/strategy/start', async (req, res) => {
  if (strategyState.running) {
    return res.json({ message: 'Already running', status: getStrategyStatus() });
  }

  strategyState.running = true;
  startStrategyLoop();
  runStrategyTick();
  return res.json({ message: 'Strategy started', status: getStrategyStatus() });
});

app.post('/api/strategy/stop', (req, res) => {
  stopStrategyLoop();
  res.json({ message: 'Strategy stopped', status: getStrategyStatus() });
});

app.get('/api/strategy/status', (req, res) => {
  res.json(getStrategyStatus());
});

async function bootstrap() {
  await loadStrategyConfig();

  const PORT = process.env.PORT || 3001;
  const HOST = process.env.HOST || '127.0.0.1';
  httpServer = http.createServer(app);

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(PORT, HOST, () => {
      httpServer.off('error', reject);
      console.log(`Server running on http://${HOST}:${PORT}`);
      resolve();
    });
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
