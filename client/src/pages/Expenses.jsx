import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Shell, State, useMoney, useLoad, toast, CATS, cc, iso, mname } from '../lib.jsx';

const range = p => { const n = new Date(), y = n.getFullYear(), m = n.getMonth(); let a = '', b = '';
  if (p === 'today') a = b = iso(); else if (p === 'week') { const d = new Date(n); d.setDate(n.getDate() - ((n.getDay() + 6) % 7)); a = iso(d); const e = new Date(d); e.setDate(d.getDate() + 6); b = iso(e); }
  else if (p === 'month') { a = iso(new Date(y, m, 1)); b = iso(new Date(y, m + 1, 0)); } else if (p === 'year') { a = y + '-01-01'; b = y + '-12-31'; }
  return { from: a, to: b }; };

export function Expenses() {
  const money = useMoney(), [F, setF] = useState({ preset: '', from: '', to: '', category: '' }), [confirm, setConfirm] = useState(null);
  const s = useLoad(() => api('/expenses?' + new URLSearchParams(Object.fromEntries(['from', 'to', 'category'].filter(k => F[k]).map(k => [k, F[k]])))), [F.from, F.to, F.category]);
  const set = (k, v) => setF(f => k === 'preset' ? { ...f, preset: v, ...range(v) } : { ...f, [k]: v, ...(k !== 'category' ? { preset: '' } : {}) });
  const del = async id => { if (confirm !== id) return setConfirm(id); await api('/expenses/' + id, { method: 'DELETE' }); setConfirm(null); toast('Deleted'); s.reload(); };
  const lbl = !F.from && !F.to ? 'in total' : F.from.slice(0, 7) === F.to.slice(0, 7) && F.from.slice(8) === '01' ? 'in ' + mname(F.from) : 'in this period';
  const d = s.data;
  return <Shell><div className="hd"><div><h1>Expenses</h1>{d && <p className="mu">You spent <b>{money(d.total)}</b> {lbl}{F.category ? ' on ' + F.category : ''}.</p>}</div><Link className="btn p" to="/expenses/add">Add Expense</Link></div>
    <div className="card" style={{ marginBottom: 16 }}><div className="row">
      <div><label htmlFor="pr">Period</label><select id="pr" value={F.preset} onChange={e => set('preset', e.target.value)}>{[['', 'All time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['year', 'This year']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div><label htmlFor="fr">From</label><input id="fr" type="date" value={F.from} onChange={e => set('from', e.target.value)} /></div>
      <div><label htmlFor="to">To</label><input id="to" type="date" value={F.to} onChange={e => set('to', e.target.value)} /></div>
      <div><label htmlFor="ct">Category</label><select id="ct" value={F.category} onChange={e => set('category', e.target.value)}><option value="">All categories</option>{CATS.map(c => <option key={c}>{c}</option>)}</select></div></div></div>
    <div className="card tw"><State s={s}>{d && (d.expenses.length ? <table><thead><tr><th>Date</th><th>Category</th><th className="r">Amount</th><th>Notes</th><th className="r">Actions</th></tr></thead>
      <tbody>{d.expenses.map(x => <tr key={x.id}><td>{x.date}</td><td><span className="tag"><i style={{ background: cc(x.category) }} />{x.category}</span></td><td className="r">{money(x.amount)}</td><td className="n">{x.notes}</td>
        <td className="r"><Link className="btn s" to={'/expenses/edit/' + x.id}>Edit</Link> <button className="btn s d" onClick={() => del(x.id)}>{confirm === x.id ? 'Confirm' : 'Delete'}</button></td></tr>)}</tbody></table> : <p className="empty">No expenses match these filters.</p>)}</State></div></Shell>;
}

export function ExpenseForm() {
  const { id } = useParams(), nav = useNavigate(), [err, setErr] = useState('');
  const s = useLoad(() => id ? api('/expenses/' + id).then(r => r.expense) : Promise.resolve({ amount: '', category: 'Food', date: iso(), notes: '' }), [id]);
  const save = async e => { e.preventDefault(); setErr(''); const v = Object.fromEntries(new FormData(e.target));
    try { await api(id ? '/expenses/' + id : '/expenses', { method: id ? 'PUT' : 'POST', body: v }); toast('Expense saved'); nav('/expenses'); } catch (x) { setErr(x.message); } };
  const x = s.data;
  return <Shell><div className="hd"><h1>{id ? 'Edit' : 'Add'} Expense</h1></div><div className="card" style={{ maxWidth: 520 }}><State s={s}>{x && <form onSubmit={save} noValidate>
    <div className="f"><label htmlFor="amount">Amount</label><input id="amount" name="amount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={x.amount} /></div>
    <div className="f"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={x.category}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
    <div className="f"><label htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={x.date} /></div>
    <div className="f"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows="3" maxLength="200" defaultValue={x.notes} /></div>
    <p className="err" role="alert">{err}</p><button className="btn p">Save</button> <Link className="btn" to="/expenses">Cancel</Link></form>}</State></div></Shell>;
}
