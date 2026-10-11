import { Link } from 'react-router-dom';
import { api } from '../api';
import { Shell, State, Pie, Alerts, useAuth, useMoney, useLoad, mname, cc } from '../lib.jsx';

export default function Dashboard() {
  const { user } = useAuth(), money = useMoney();
  const s = useLoad(async () => { const [r, b, e] = await Promise.all([api('/reports'), api('/budgets'), api('/expenses?limit=5')]); return { r, b: b.budgets, e: e.expenses }; }, []);
  return <Shell><State s={s}>{s.data && (() => { const { r, b, e } = s.data; return <>
    <div className="hd"><div><h1>Welcome back, {user.name}!</h1><p className="mu">Here's your spending for {mname(r.month)}.</p></div><Link className="btn p" to="/expenses/add">Add Expense</Link></div>
    <Alerts budgets={b} cats={r.categories} />
    <div className="grid g3" style={{ marginBottom: 16 }}>
      <div className="card stat"><p className="mu sm">Total spent this month</p><p className="v">{money(r.total)}</p></div>
      <div className="card stat"><p className="mu sm">Top category</p><p className="v">{r.topCategory || '—'}</p></div>
      <div className="card stat"><p className="mu sm">Transactions</p><p className="v">{r.count}</p></div></div>
    <div className="grid g2"><div className="card"><h2>Spending by category</h2><Pie data={r.categories} /></div>
      <div className="card"><h2>Recent expenses</h2>{e.length ? <table><tbody>{e.map(x => <tr key={x.id}><td>{x.date}</td><td><span className="tag"><i style={{ background: cc(x.category) }} />{x.category}</span></td><td className="r">{money(x.amount)}</td></tr>)}</tbody></table> : <p className="empty">No expenses yet. Add your first one.</p>}</div></div></>; })()}</State></Shell>;
}
