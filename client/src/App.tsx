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

function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [strategyStatus, setStrategyStatus] = useState({ running: false, lastLog: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    console.log("Fetching data from", API_BASE);
    try {
      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/account`),
        axios.get(`${API_BASE}/positions`),
        axios.get(`${API_BASE}/strategy/status`)
      ]);

      const [accRes, posRes, stratRes] = results;

      if (accRes.status === 'fulfilled') setAccount(accRes.value.data);
      else {
        console.error("Account fetch failed:", accRes.reason);
        throw new Error("Could not fetch account info. Check API keys.");
      }

      if (posRes.status === 'fulfilled') setPositions(posRes.value.data);
      if (stratRes.status === 'fulfilled') setStrategyStatus(stratRes.value.data);

      setError(null);
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
          <div className={`metric-card ${Number(account?.cash) > 0 ? 'positive' : ''}`}>
            <label>Cash Balance</label>
            <div className="value">${Number(account?.cash).toLocaleString()}</div>
          </div>
          <div className="metric-card">
            <label>Buying Power</label>
            <div className="value">${Number(account?.buying_power).toLocaleString()}</div>
          </div>
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
