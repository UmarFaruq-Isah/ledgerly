import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, tok } from './api';
import { AuthCtx } from './lib.jsx';
import { Landing, Login, Signup, Forgot, Reset } from './pages/Public.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { Expenses, ExpenseForm } from './pages/Expenses.jsx';
import Budgets from './pages/Budgets.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

function Logout({ onDone }) { useEffect(() => { onDone(); }, []); return <Navigate to="/" replace />; }

export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => {
    const out = () => setUser(null), t = e => { setMsg(e.detail); setTimeout(() => setMsg(''), 2200); };
    window.addEventListener('ledgerly:logout', out); window.addEventListener('ledgerly:toast', t);
    (tok.get() ? api('/auth/me').then(d => setUser(d.user)).catch(() => {}) : Promise.resolve()).finally(() => setReady(true));
    return () => { window.removeEventListener('ledgerly:logout', out); window.removeEventListener('ledgerly:toast', t); };
  }, []);
  useEffect(() => { const t = user && user.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }, [user && user.theme]);
  const login = d => { tok.set(d.token); setUser(d.user); };
  const logout = () => { api('/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => { tok.set(null); setUser(null); }); };
  if (!ready) return <p className="load">Loading…</p>;
  const priv = el => (user ? el : <Navigate to="/login" replace />), pub = el => (user ? <Navigate to="/dashboard" replace /> : el);
  return (
    <AuthCtx.Provider value={{ user, setUser, login }}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={pub(<Login />)} /><Route path="/signup" element={pub(<Signup />)} />
        <Route path="/forgot" element={pub(<Forgot />)} /><Route path="/reset/:token" element={pub(<Reset />)} />
        <Route path="/dashboard" element={priv(<Dashboard />)} />
        <Route path="/expenses" element={priv(<Expenses />)} />
        <Route path="/expenses/add" element={priv(<ExpenseForm />)} />
        <Route path="/expenses/edit/:id" element={priv(<ExpenseForm />)} />
        <Route path="/budgets" element={priv(<Budgets />)} />
        <Route path="/reports" element={priv(<Reports />)} />
        <Route path="/settings" element={priv(<Settings />)} />
        <Route path="/logout" element={<Logout onDone={logout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <div id="toast" role="status" className={msg ? 'on' : ''}>{msg}</div>
    </AuthCtx.Provider>
  );
}
