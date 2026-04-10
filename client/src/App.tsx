import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import {
  Activity,
  LayoutDashboard,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import './App.css';

const API_BASE = 'http://localhost:3001/api';

interface Account {
  cash: string;
  equity: string;
  buying_power: string;
  account_number: string;
}

interface Position {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  market_value: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
}

interface MarketMover {
  symbol: string;
  price: number;
  change: string;
  changePercent: string;
}

interface MarketIndex {
  symbol: string;
  price: number;
  change: string;
  changePercent: string;
}

interface PortfolioSummary {
  unrealized: string;
  realized: string;
  total: string;
}

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

interface StrategyRule {
  id: string;
  symbol: string;
  qty: number;
  buyBelow: number;
  sellAbove: number;
  enabled: boolean;
  cycleMode: 'repeat';
  lastAction: string;
  lastActionAt: string | null;
}

interface StrategyConfig {
  pollIntervalSeconds: number;
  rules: StrategyRule[];
}

interface StrategyStatus {
  running: boolean;
  paper: boolean;
  pollIntervalSeconds: number;
  lastRunAt: string | null;
  lastLog: string;
  lastError: string | null;
}

interface RuleFormState {
  id: string | null;
  symbol: string;
  qty: string;
  buyBelow: string;
  sellAbove: string;
  enabled: boolean;
}

interface OrderFormState {
  symbol: string;
  qty: string;
  side: OrderSide;
  type: OrderType;
  limitPrice: string;
}

const emptyRuleForm: RuleFormState = {
  id: null,
  symbol: '',
  qty: '1',
  buyBelow: '',
  sellAbove: '',
  enabled: true,
};

const emptyOrderForm: OrderFormState = {
  symbol: '',
  qty: '1',
  side: 'buy',
  type: 'market',
  limitPrice: '',
};

function formatMoney(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not yet';
  }

  return new Date(value).toLocaleString();
}

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>({
    pollIntervalSeconds: 15,
    rules: [],
  });
  const [strategyStatus, setStrategyStatus] = useState<StrategyStatus>({
    running: false,
    paper: true,
    pollIntervalSeconds: 15,
    lastRunAt: null,
    lastLog: 'Strategy not started.',
    lastError: null,
  });
  const [marketMovers, setMarketMovers] = useState<MarketMover[]>([]);
  const [indexData, setIndexData] = useState<MarketIndex | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(emptyRuleForm);
  const [orderForm, setOrderForm] = useState<OrderFormState>(emptyOrderForm);
  const [pollIntervalDraft, setPollIntervalDraft] = useState('15');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [togglingStrategy, setTogglingStrategy] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const fetchData = async () => {
    try {
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/account`),
        axios.get(`${API_BASE}/positions`),
        axios.get(`${API_BASE}/strategy/status`),
        axios.get(`${API_BASE}/strategy/config`),
        axios.get(`${API_BASE}/market/movers`),
        axios.get(`${API_BASE}/market/indices`),
        axios.get(`${API_BASE}/portfolio/summary`),
      ]);

      const [accRes, posRes, statusRes, configRes, moverRes, indexRes, summaryRes] = results;

      if (accRes.status === 'fulfilled') {
        setAccount(accRes.value.data);
        setPageError(null);
      } else {
        setPageError('Crucial account data could not be fetched. Check your server and API keys.');
      }

      if (posRes.status === 'fulfilled') {
        setPositions(posRes.value.data);
        setPositionError(null);
      } else {
        setPositionError('Positions are temporarily unavailable.');
      }

      if (statusRes.status === 'fulfilled') {
        setStrategyStatus(statusRes.value.data);
      }

      if (configRes.status === 'fulfilled') {
        setStrategyConfig(configRes.value.data);
        setPollIntervalDraft(String(configRes.value.data.pollIntervalSeconds));
      } else {
        setStrategyError('Strategy configuration could not be loaded.');
      }

      if (moverRes.status === 'fulfilled') {
        setMarketMovers(moverRes.value.data);
      }

      if (indexRes.status === 'fulfilled') {
        setIndexData(indexRes.value.data);
      }

      if (summaryRes.status === 'fulfilled') {
        setPortfolioSummary(summaryRes.value.data);
      }
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Connection error';
      setPageError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 10000);
    return () => window.clearInterval(interval);
  }, []);

  const resetRuleForm = () => {
    setRuleForm(emptyRuleForm);
    setRuleFormError(null);
  };

  const resetOrderFeedback = () => {
    setOrderError(null);
    setOrderSuccess(null);
  };

  const closePosition = async (symbol: string) => {
    if (!window.confirm(`Are you sure you want to close ${symbol}?`)) {
      return;
    }

    try {
      setClosingSymbol(symbol);
      setPositionError(null);
      await axios.delete(`${API_BASE}/positions/${symbol}`);
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to close position.';
      setPositionError(message);
    } finally {
      setClosingSymbol(null);
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmittingOrder(true);
      resetOrderFeedback();

      await axios.post(`${API_BASE}/orders`, {
        symbol: orderForm.symbol,
        qty: Number(orderForm.qty),
        side: orderForm.side,
        type: orderForm.type,
        limitPrice: orderForm.type === 'limit' ? Number(orderForm.limitPrice) : undefined,
      });

      setOrderSuccess(
        `${orderForm.side === 'buy' ? 'Buy' : 'Sell'} order submitted for ${orderForm.qty} ${orderForm.symbol.toUpperCase()} share(s).`,
      );
      setOrderForm((current) => ({
        ...emptyOrderForm,
        symbol: current.symbol.toUpperCase(),
      }));
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to submit order.';
      setOrderError(message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const toggleStrategy = async () => {
    try {
      setTogglingStrategy(true);
      setStrategyError(null);
      const endpoint = strategyStatus.running ? 'stop' : 'start';
      await axios.post(`${API_BASE}/strategy/${endpoint}`);
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to update strategy status.';
      setStrategyError(message);
    } finally {
      setTogglingStrategy(false);
    }
  };

  const savePollInterval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSavingSettings(true);
      setStrategyError(null);
      await axios.put(`${API_BASE}/strategy/config`, {
        pollIntervalSeconds: Number(pollIntervalDraft),
      });
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to save strategy settings.';
      setStrategyError(message);
    } finally {
      setSavingSettings(false);
    }
  };

  const submitRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSavingRule(true);
      setRuleFormError(null);

      const payload = {
        symbol: ruleForm.symbol,
        qty: Number(ruleForm.qty),
        buyBelow: Number(ruleForm.buyBelow),
        sellAbove: Number(ruleForm.sellAbove),
        enabled: ruleForm.enabled,
      };

      if (ruleForm.id) {
        await axios.put(`${API_BASE}/strategy/rules/${ruleForm.id}`, payload);
      } else {
        await axios.post(`${API_BASE}/strategy/rules`, payload);
      }

      resetRuleForm();
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to save rule.';
      setRuleFormError(message);
    } finally {
      setSavingRule(false);
    }
  };

  const editRule = (rule: StrategyRule) => {
    setRuleForm({
      id: rule.id,
      symbol: rule.symbol,
      qty: String(rule.qty),
      buyBelow: String(rule.buyBelow),
      sellAbove: String(rule.sellAbove),
      enabled: rule.enabled,
    });
    setRuleFormError(null);
  };

  const removeRule = async (ruleId: string) => {
    try {
      setDeletingRuleId(ruleId);
      setStrategyError(null);
      await axios.delete(`${API_BASE}/strategy/rules/${ruleId}`);
      if (ruleForm.id === ruleId) {
        resetRuleForm();
      }
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to delete rule.';
      setStrategyError(message);
    } finally {
      setDeletingRuleId(null);
    }
  };

  const toggleRuleEnabled = async (rule: StrategyRule) => {
    try {
      setDeletingRuleId(rule.id);
      setStrategyError(null);
      await axios.put(`${API_BASE}/strategy/rules/${rule.id}`, {
        symbol: rule.symbol,
        qty: rule.qty,
        buyBelow: rule.buyBelow,
        sellAbove: rule.sellAbove,
        enabled: !rule.enabled,
      });
      await fetchData();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to update rule.';
      setStrategyError(message);
    } finally {
      setDeletingRuleId(null);
    }
  };

  if (loading && !account) {
    return (
      <div className="loading">
        <div className="loading-card">
          <div>{pageError ? `Error: ${pageError}` : 'Initializing trading dashboard...'}</div>
          {pageError && (
            <button type="button" className="refresh-btn" onClick={fetchData}>
              <RefreshCcw size={16} /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="logo">
          <Activity size={32} color="#4ade80" />
          <span>AlpacaTrader</span>
        </div>
        <nav>
          <button type="button" className="nav-item active">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button type="button" className="nav-item">
            <Settings size={20} /> Strategy
          </button>
        </nav>
        <div className="status-footer">
          <div className={`status-dot ${strategyStatus.running ? 'online' : 'offline'}`}></div>
          <div>
            <div>{strategyStatus.running ? 'Strategy Active' : 'Strategy Stopped'}</div>
            <small>{strategyStatus.paper ? 'Paper trading mode' : 'Live mode'}</small>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="top-bar">
          <div>
            <h1>Trading Overview</h1>
            <p className="subtle-copy">Monitor your Alpaca account, manage open positions, and run threshold rules.</p>
          </div>
          <button type="button" onClick={fetchData} className="refresh-btn">
            <RefreshCcw size={16} /> Refresh
          </button>
        </header>

        {pageError && <div className="error-alert">{pageError}</div>}

        <div className="metrics-grid">
          <div className="metric-card">
            <label>Net Equity</label>
            <div className="value">${formatMoney(account?.equity)}</div>
          </div>
          <div className="metric-card">
            <label>Realized P/L</label>
            <div className={`value ${Number(portfolioSummary?.realized) >= 0 ? 'positive' : 'negative'}`}>
              ${formatMoney(portfolioSummary?.realized)}
            </div>
          </div>
          <div className="metric-card">
            <label>Unrealized P/L</label>
            <div className={`value ${Number(portfolioSummary?.unrealized) >= 0 ? 'positive' : 'negative'}`}>
              ${formatMoney(portfolioSummary?.unrealized)}
            </div>
          </div>
          <div className="metric-card">
            <label>Buying Power</label>
            <div className="value">${formatMoney(account?.buying_power)}</div>
          </div>
        </div>

        <div className="market-overview-grid">
          <section className="market-card-section">
            <div className="section-header">
              <h2>S&P 500 Index</h2>
            </div>
            {indexData && (
              <div className="index-display">
                <div className="index-price">${formatMoney(indexData.price)}</div>
                <div className={`index-change ${Number(indexData.change) >= 0 ? 'positive' : 'negative'}`}>
                  {Number(indexData.change) >= 0 ? '+' : ''}
                  {indexData.change} ({indexData.changePercent}%)
                </div>
              </div>
            )}
          </section>

          <section className="market-card-section">
            <div className="section-header">
              <h2>Top Movers</h2>
            </div>
            <div className="movers-list">
              {marketMovers.map((mover) => (
                <div key={mover.symbol} className="mover-item">
                  <span className="mover-symbol">{mover.symbol}</span>
                  <span className="mover-price">${mover.price.toFixed(2)}</span>
                  <span className={`mover-percent ${Number(mover.changePercent) >= 0 ? 'positive' : 'negative'}`}>
                    {Number(mover.changePercent) >= 0 ? '+' : ''}
                    {mover.changePercent}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="manual-order-section">
          <div className="section-header section-header-wrap">
            <div>
              <h2>Manual Order Ticket</h2>
              <p className="subtle-copy">
                Submit a direct Alpaca order to open or reduce a position without waiting for the strategy loop.
              </p>
            </div>
          </div>

          <form className="order-form-card" onSubmit={submitOrder}>
            {orderError && <div className="error-alert inline-alert">{orderError}</div>}
            {orderSuccess && <div className="success-alert inline-alert">{orderSuccess}</div>}

            <div className="order-form-grid">
              <label className="field">
                <span>Symbol</span>
                <input
                  type="text"
                  placeholder="AAPL"
                  value={orderForm.symbol}
                  onChange={(event) => {
                    resetOrderFeedback();
                    setOrderForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }));
                  }}
                />
              </label>

              <label className="field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={orderForm.qty}
                  onChange={(event) => {
                    resetOrderFeedback();
                    setOrderForm((current) => ({ ...current, qty: event.target.value }));
                  }}
                />
              </label>

              <label className="field">
                <span>Side</span>
                <select
                  value={orderForm.side}
                  onChange={(event) => {
                    resetOrderFeedback();
                    setOrderForm((current) => ({ ...current, side: event.target.value as OrderSide }));
                  }}
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </label>

              <label className="field">
                <span>Order Type</span>
                <select
                  value={orderForm.type}
                  onChange={(event) => {
                    resetOrderFeedback();
                    const nextType = event.target.value as OrderType;
                    setOrderForm((current) => ({
                      ...current,
                      type: nextType,
                      limitPrice: nextType === 'limit' ? current.limitPrice : '',
                    }));
                  }}
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </label>

              {orderForm.type === 'limit' && (
                <label className="field">
                  <span>Limit Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderForm.limitPrice}
                    onChange={(event) => {
                      resetOrderFeedback();
                      setOrderForm((current) => ({ ...current, limitPrice: event.target.value }));
                    }}
                  />
                </label>
              )}
            </div>

            <div className="order-ticket-footer">
              <div className="ticket-note">
                {strategyStatus.paper ? 'Orders will be sent to your paper trading account.' : 'Orders will be sent to your live account.'}
              </div>
              <button type="submit" className="primary-btn" disabled={submittingOrder}>
                <Plus size={16} /> Submit Order
              </button>
            </div>
          </form>
        </section>

        <section className="strategy-section">
          <div className="section-header section-header-wrap">
            <div>
              <h2>Watchlist Strategy</h2>
              <p className="subtle-copy">
                Long-only threshold rules. Buys at or below the entry price and sells held shares at or above the exit price.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleStrategy}
              className={`strategy-toggle ${strategyStatus.running ? 'stop' : 'start'}`}
              disabled={togglingStrategy}
            >
              {strategyStatus.running ? <Square size={16} /> : <Play size={16} />}
              {strategyStatus.running ? 'Stop Strategy' : 'Start Strategy'}
            </button>
          </div>

          <div className="strategy-status-grid">
            <div className="status-card">
              <span className="status-label">Environment</span>
              <strong>{strategyStatus.paper ? 'Paper Trading' : 'Live Trading'}</strong>
            </div>
            <div className="status-card">
              <span className="status-label">Polling Interval</span>
              <strong>{strategyConfig.pollIntervalSeconds}s</strong>
            </div>
            <div className="status-card">
              <span className="status-label">Last Run</span>
              <strong>{formatDateTime(strategyStatus.lastRunAt)}</strong>
            </div>
            <div className="status-card">
              <span className="status-label">Active Rules</span>
              <strong>{strategyConfig.rules.filter((rule) => rule.enabled).length}</strong>
            </div>
          </div>

          {strategyError && <div className="error-alert inline-alert">{strategyError}</div>}
          {strategyStatus.lastError && <div className="error-alert inline-alert">{strategyStatus.lastError}</div>}

          <div className="strategy-log">
            <code>{strategyStatus.lastLog || 'Ready to start trading.'}</code>
          </div>

          <div className="strategy-management-grid">
            <form className="settings-card" onSubmit={savePollInterval}>
              <div className="card-header">
                <h3>Loop Settings</h3>
              </div>
              <label className="field">
                <span>Poll interval (seconds)</span>
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={pollIntervalDraft}
                  onChange={(event) => setPollIntervalDraft(event.target.value)}
                />
              </label>
              <button type="submit" className="primary-btn" disabled={savingSettings}>
                <Save size={16} /> Save Settings
              </button>
            </form>

            <form className="rule-form-card" onSubmit={submitRule}>
              <div className="card-header">
                <h3>{ruleForm.id ? 'Edit Rule' : 'Add Rule'}</h3>
                {ruleForm.id && (
                  <button type="button" className="ghost-btn" onClick={resetRuleForm}>
                    <X size={16} /> Cancel
                  </button>
                )}
              </div>

              {ruleFormError && <div className="error-alert inline-alert">{ruleFormError}</div>}

              <div className="rule-form-grid">
                <label className="field">
                  <span>Symbol</span>
                  <input
                    type="text"
                    placeholder="AAPL"
                    value={ruleForm.symbol}
                    onChange={(event) =>
                      setRuleForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={ruleForm.qty}
                    onChange={(event) => setRuleForm((current) => ({ ...current, qty: event.target.value }))}
                  />
                </label>

                <label className="field">
                  <span>Buy Below</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleForm.buyBelow}
                    onChange={(event) =>
                      setRuleForm((current) => ({ ...current, buyBelow: event.target.value }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Sell Above</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ruleForm.sellAbove}
                    onChange={(event) =>
                      setRuleForm((current) => ({ ...current, sellAbove: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={ruleForm.enabled}
                  onChange={(event) => setRuleForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Start enabled
              </label>

              <button type="submit" className="primary-btn" disabled={savingRule}>
                {ruleForm.id ? <Save size={16} /> : <Plus size={16} />}
                {ruleForm.id ? 'Save Rule' : 'Add Rule'}
              </button>
            </form>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Buy Below</th>
                  <th>Sell Above</th>
                  <th>Status</th>
                  <th>Last Action</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {strategyConfig.rules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      No strategy rules yet.
                    </td>
                  </tr>
                ) : (
                  strategyConfig.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="symbol">{rule.symbol}</td>
                      <td>{rule.qty}</td>
                      <td>${formatMoney(rule.buyBelow)}</td>
                      <td>${formatMoney(rule.sellAbove)}</td>
                      <td>
                        <button
                          type="button"
                          className={`pill-btn ${rule.enabled ? 'enabled' : 'disabled'}`}
                          onClick={() => toggleRuleEnabled(rule)}
                          disabled={deletingRuleId === rule.id}
                        >
                          {rule.enabled ? 'Enabled' : 'Paused'}
                        </button>
                      </td>
                      <td>{rule.lastAction}</td>
                      <td>{formatDateTime(rule.lastActionAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="ghost-btn" onClick={() => editRule(rule)}>
                            <Pencil size={16} /> Edit
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => removeRule(rule.id)}
                            disabled={deletingRuleId === rule.id}
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="positions-section">
          <div className="section-header section-header-wrap">
            <div>
              <h2>Open Positions ({positions.length})</h2>
              <p className="subtle-copy">Manual closes remain single-position actions in v1.</p>
            </div>
          </div>

          {positionError && <div className="error-alert inline-alert">{positionError}</div>}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Market Value</th>
                  <th>Current Price</th>
                  <th>Avg Entry</th>
                  <th>P/L</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      No open positions.
                    </td>
                  </tr>
                ) : (
                  positions.map((position) => (
                    <tr key={position.symbol}>
                      <td className="symbol">{position.symbol}</td>
                      <td>{position.qty}</td>
                      <td>${formatMoney(position.market_value)}</td>
                      <td>${formatMoney(position.current_price)}</td>
                      <td>${formatMoney(position.avg_entry_price)}</td>
                      <td className={Number(position.unrealized_pl) >= 0 ? 'positive' : 'negative'}>
                        ${formatMoney(position.unrealized_pl)} ({(Number(position.unrealized_plpc) * 100).toFixed(2)}%)
                      </td>
                      <td>
                        <button
                          type="button"
                          className="close-btn"
                          onClick={() => closePosition(position.symbol)}
                          disabled={closingSymbol === position.symbol}
                        >
                          <XCircle size={16} /> Close
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
