import { useState } from 'react';
import { api } from '../api';
import { Shell, State, Alerts, useMoney, useLoad, toast, CATS, mname } from '../lib.jsx';

export default function Budgets() {
  const money = useMoney(), [err, setErr] = useState(''), [confirm, setConfirm] = useState(null);
  const s = useLoad(async () => { const [r, b] = await Promise.all([api('/reports'), api('/budgets')]); return { r, b: b.budgets }; }, []);
  const save = async e => { e.preventDefault(); setErr(''); const f = e.target, v = Object.fromEntries(new FormData(f));
    try { await api('/budgets', { method: 'POST', body: v }); f.reset(); toast('Budget set'); s.reload(); } catch (x) { setErr(x.message); } };
  const del = async c => { if (confirm !== c) return setConfirm(c); await api('/budgets/' + encodeURIComponent(c), { method: 'DELETE' }); setConfirm(null); toast('Deleted'); s.reload(); };
  return <Shell><State s={s}>{s.data && (() => { const { r, b } = s.data; return <>
    <div className="hd"><div><h1>Budgets</h1><p className="mu">Monthly limits for {mname(r.month)}.</p></div></div>
    <Alerts budgets={b} cats={r.categories} />
    <div className="card" style={{ marginBottom: 16 }}><form onSubmit={save} noValidate><div className="row">
      <div><label htmlFor="category">Category</label><select id="category" name="category">{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
      <div><label htmlFor="limit">Monthly limit</label><input id="limit" name="limit" type="number" min="1" step="1" inputMode="numeric" /></div>
      <div style={{ flex: 0 }}><button className="btn p">Set Budget</button></div></div><p className="err" role="alert" style={{ margin: '8px 0 0' }}>{err}</p></form></div>
    <div className="grid g2">{b.length ? b.map(x => { const u = (r.categories.find(c => c.name === x.category) || {}).value || 0, p = Math.round(u / x.limit * 100);
      return <div className="card" key={x.category}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{x.category}</b><button className="btn s d" onClick={() => del(x.category)}>{confirm === x.category ? 'Confirm' : 'Remove'}</button></div>
        <div className={'bar ' + (p >= 100 ? 'o' : p >= 90 ? 'w' : '')}><span style={{ width: Math.min(p, 100) + '%' }} /></div><p className="sm mu">{money(u)} of {money(x.limit)} · {p}% used</p></div>; })
      : <div className="card empty" style={{ gridColumn: '1/-1' }}>No budgets yet. Set a limit above.</div>}</div></>; })()}</State></Shell>;
}
