import { createContext, useContext, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PieChart, Pie as RPie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

export const CATS = ['Food', 'Rent', 'Transport', 'Utilities', 'Health', 'Entertainment', 'Shopping', 'Other'];
export const COL = ['#1f6f5c', '#3d5a9e', '#b7791f', '#8a4f7d', '#c05621', '#2b8a9e', '#6b7280', '#9c4a4a'];
export const cc = n => COL[CATS.indexOf(n)] || COL[7];
export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
export const useMoney = () => { const { user } = useAuth(); return n => new Intl.NumberFormat(undefined, { style: 'currency', currency: user.currency, maximumFractionDigits: 0 }).format(n || 0); };
export const iso = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const mname = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleString('en', { month: 'long' });
export const mshort = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).toLocaleString('en', { month: 'short' });

export function useLoad(fn, deps) {
  const [s, set] = useState({ data: null, error: '', loading: true });
  const [n, bump] = useState(0);
  useEffect(() => { let on = true; set(v => ({ ...v, loading: true })); fn().then(data => on && set({ data, error: '', loading: false })).catch(e => on && set({ data: null, error: e.message, loading: false })); return () => { on = false; }; }, [...deps, n]);
  return { ...s, reload: () => bump(x => x + 1) };
}
export const toast = m => window.dispatchEvent(new CustomEvent('ledgerly:toast', { detail: m }));
export const Logo = () => <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect width="26" height="26" rx="7" fill="var(--ac)" /><path d="M7 17l4-5 3 3 5-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const nav = [['dashboard', 'Dashboard'], ['expenses', 'Expenses'], ['budgets', 'Budgets'], ['reports', 'Reports'], ['settings', 'Settings']];
export const Shell = ({ children }) => (
  <div className="shell"><aside><div className="brand"><Logo />Ledgerly</div>
    <nav>{nav.map(([k, l]) => <NavLink key={k} to={'/' + k} className={({ isActive }) => (isActive ? 'on' : '')}>{l}</NavLink>)}<NavLink to="/logout">Log out</NavLink></nav>
  </aside><main>{children}</main></div>
);
export const State = ({ s, children }) => s.loading && !s.data ? <p className="load">Loading…</p> : s.error ? <p className="err" role="alert">{s.error}</p> : children;

export function Pie({ data }) {
  const money = useMoney(), t = data.reduce((s, d) => s + d.value, 0);
  if (!t) return <p className="empty">No spending to chart yet.</p>;
  return <div className="pie"><div className="rc"><ResponsiveContainer width="100%" height="100%"><PieChart><RPie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} stroke="none">{data.map(d => <Cell key={d.name} fill={cc(d.name)} />)}</RPie><Tooltip formatter={v => money(v)} /></PieChart></ResponsiveContainer></div>
    <ul className="leg">{data.map(d => <li key={d.name}><i style={{ background: cc(d.name) }} />{d.name}<b>{Math.round(d.value / t * 100)}%</b></li>)}</ul></div>;
}
export function Trend({ data }) {
  const money = useMoney(), rows = data.map(d => ({ label: mshort(d.month), total: d.total }));
  const tick = { fill: 'var(--mu)', fontSize: 11 };
  return <div className="chart"><ResponsiveContainer><LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--ln)" vertical={false} /><XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} /><YAxis tick={tick} axisLine={false} tickLine={false} width={64} tickFormatter={v => money(v)} /><Tooltip formatter={v => money(v)} /><Line type="monotone" dataKey="total" name="Spent" stroke="#1f6f5c" strokeWidth={2.5} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>;
}
export const Alerts = ({ budgets, cats }) => budgets.map(b => {
  const p = Math.round(((cats.find(c => c.name === b.category) || {}).value || 0) / b.limit * 100);
  return p >= 90 ? <div key={b.category} className={'al' + (p >= 100 ? ' o' : '')}>{p >= 100 ? `You've exceeded your ${b.category} budget (${p}% used).` : `You've used ${p}% of your ${b.category} budget.`}</div> : null;
});

const q = v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
export const toCSV = list => ['Date,Category,Amount,Notes', ...[...list].reverse().map(x => [x.date, x.category, x.amount, q(x.notes || '')].join(','))].join('\n');
export function parseCSV(t) {
  const r = []; let w = [], c = '', o = false;
  for (let i = 0; i < t.length; i++) {
    const h = t[i];
    if (o) { if (h === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else o = false; } else c += h; }
    else if (h === '"') o = true; else if (h === ',') { w.push(c); c = ''; }
    else if (h === '\n' || h === '\r') { if (h === '\r' && t[i + 1] === '\n') i++; w.push(c); c = ''; r.push(w); w = []; } else c += h;
  }
  if (c || w.length) { w.push(c); r.push(w); }
  return r.filter(x => x.some(v => v.trim()));
}
