import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Square, RefreshCcw, XCircle, LayoutDashboard, Settings, Activity } from 'lucide-react';
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

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [strategyStatus, setStrategyStatus] = useState({ running: false, lastLog: "" });
  const [marketMovers, setMarketMovers] = useState<MarketMover[]>([]);
  const [indexData, setIndexData] = useState<MarketIndex | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    console.log("Fetching data from", API_BASE);
    try {
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/account`),
        axios.get(`${API_BASE}/positions`),
        axios.get(`${API_BASE}/strategy/status`),
        axios.get(`${API_BASE}/market/movers`),
        axios.get(`${API_BASE}/market/indices`),
        axios.get(`${API_BASE}/portfolio/summary`)
      ]);

      const [accRes, posRes, stratRes, moverRes, indexRes, summaryRes] = results;

      if (accRes.status === 'fulfilled') setAccount(accRes.value.data);
      else console.error("Account fetch failed:", accRes.reason);
      
      if (posRes.status === 'fulfilled') setPositions(posRes.value.data);
      else console.error("Positions fetch failed:", posRes.reason);

      if (stratRes.status === 'fulfilled') setStrategyStatus(stratRes.value.data);
      else console.error("Strategy status fetch failed:", stratRes.reason);

      if (moverRes.status === 'fulfilled') setMarketMovers(moverRes.value.data);
      else console.error("Market movers fetch failed:", moverRes.reason);

      if (indexRes.status === 'fulfilled') setIndexData(indexRes.value.data);
      else console.error("Index data fetch failed:", indexRes.reason);

      if (summaryRes.status === 'fulfilled') setPortfolioSummary(summaryRes.value.data);
      else console.error("Portfolio summary fetch failed:", summaryRes.reason);

      const hasCriticalError = accRes.status === 'rejected';
      if (hasCriticalError) {
        setError("Crucial account data could not be fetched. Check your server and API keys.");
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error("Fetch Error:", err);
      setError(err.response?.data?.error || err.message || "Connection Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const closePosition = async (symbol: string) => {
    if (!confirm(`Are you sure you want to close ${symbol}?`)) return;
    try {
      await axios.delete(`${API_BASE}/positions/${symbol}`);
      fetchData();
    } catch (err: any) {
      alert("Error closing position: " + err.message);
    }
  };

  const toggleStrategy = async () => {
    try {
      const endpoint = strategyStatus.running ? 'stop' : 'start';
      await axios.post(`${API_BASE}/strategy/${endpoint}`);
      fetchData();
    } catch (err: any) {
      alert("Error toggling strategy: " + err.message);
    }
  };

  if (loading && !account) {
    return (
      <div className="loading">
        {error ? `Error: ${error}` : "Initializing Trading Dashboard..."}
        {error && <button onClick={fetchData} style={{display: 'block', marginTop: '1rem'}}>Retry</button>}
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
          <button className="nav-item active"><LayoutDashboard size={20} /> Dashboard</button>
          <button className="nav-item"><Settings size={20} /> Settings</button>
        </nav>
        <div className="status-footer">
          <div className={`status-dot ${strategyStatus.running ? 'online' : 'offline'}`}></div>
          {strategyStatus.running ? "Strategy Active" : "Strategy Stopped"}
        </div>
      </aside>

      <main className="content">
        <header className="top-bar">
          <h1>Trading Overview</h1>
          <button onClick={fetchData} className="refresh-btn">
            <RefreshCcw size={16} /> Refresh
          </button>
        </header>

        {error && <div className="error-alert">{error}</div>}

        <div className="metrics-grid">
          <div className="metric-card">
            <label>Net Equity</label>
            <div className="value">${Number(account?.equity).toLocaleString()}</div>
          </div>
          <div className="metric-card">
            <label>Realized P/L</label>
            <div className={`value ${Number(portfolioSummary?.realized) >= 0 ? 'positive' : 'negative'}`}>
              ${Number(portfolioSummary?.realized).toLocaleString()}
            </div>
          </div>
          <div className="metric-card">
            <label>Unrealized P/L</label>
            <div className={`value ${Number(portfolioSummary?.unrealized) >= 0 ? 'positive' : 'negative'}`}>
              ${Number(portfolioSummary?.unrealized).toLocaleString()}
            </div>
          </div>
          <div className="metric-card">
            <label>Buying Power</label>
            <div className="value">${Number(account?.buying_power).toLocaleString()}</div>
          </div>
        </div>

        <div className="market-overview-grid">
          <section className="market-card-section">
            <div className="section-header">
              <h2>S&P 500 Index</h2>
            </div>
            {indexData && (
              <div className="index-display">
                <div className="index-price">${indexData.price.toLocaleString()}</div>
                <div className={`index-change ${Number(indexData.change) >= 0 ? 'positive' : 'negative'}`}>
                  {Number(indexData.change) >= 0 ? '+' : ''}{indexData.change} ({indexData.changePercent}%)
                </div>
              </div>
            )}
          </section>

          <section className="market-card-section">
            <div className="section-header">
              <h2>Top Movers (24h)</h2>
            </div>
            <div className="movers-list">
              {marketMovers.map(mover => (
                <div key={mover.symbol} className="mover-item">
                  <span className="mover-symbol">{mover.symbol}</span>
                  <span className="mover-price">${mover.price.toFixed(2)}</span>
                  <span className={`mover-percent ${Number(mover.changePercent) >= 0 ? 'positive' : 'negative'}`}>
                    {Number(mover.changePercent) >= 0 ? '+' : ''}{mover.changePercent}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="strategy-section">
          <div className="section-header">
            <h2>AI Trading Strategy</h2>
            <button 
              onClick={toggleStrategy} 
              className={`strategy-toggle ${strategyStatus.running ? 'stop' : 'start'}`}
            >
              {strategyStatus.running ? <Square size={16} /> : <Play size={16} />}
              {strategyStatus.running ? "Stop Strategy" : "Start Strategy"}
            </button>
          </div>
          <div className="strategy-log">
            <code>{strategyStatus.lastLog || "Ready to start trading."}</code>
          </div>
        </section>

        <section className="positions-section">
          <h2>Open Positions ({positions.length})</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Market Value</th>
                  <th>Avg Entry</th>
                  <th>P/L</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">No open positions.</td></tr>
                ) : (
                  positions.map(pos => (
                    <tr key={pos.symbol}>
                      <td className="symbol">{pos.symbol}</td>
                      <td>{pos.qty}</td>
                      <td>${Number(pos.market_value).toFixed(2)}</td>
                      <td>${Number(pos.avg_entry_price).toFixed(2)}</td>
                      <td className={Number(pos.unrealized_pl) >= 0 ? 'positive' : 'negative'}>
                        ${Number(pos.unrealized_pl).toFixed(2)} ({ (Number(pos.unrealized_plpc) * 100).toFixed(2) }%)
                      </td>
                      <td>
                        <button className="close-btn" onClick={() => closePosition(pos.symbol)}>
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
