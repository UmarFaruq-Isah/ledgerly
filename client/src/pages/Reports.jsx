import { api } from '../api';
import { Shell, State, Pie, Trend, useLoad, toast, mname, toCSV, parseCSV } from '../lib.jsx';

export default function Reports() {
  const s = useLoad(() => api('/reports'), []);
  const download = async () => { const { expenses } = await api('/expenses');
    const a = document.createElement('a'), u = URL.createObjectURL(new Blob([toCSV(expenses)], { type: 'text/csv' }));
    a.href = u; a.download = 'expenses.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  const onImport = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const rows = parseCSV(await f.text()).filter((r, i) => !(i === 0 && /date/i.test(r[0]))).map(r => ({ date: (r[0] || '').trim(), category: (r[1] || '').trim(), amount: parseFloat(r[2]), notes: (r[3] || '').trim() }));
    try { const r = await api('/expenses/import', { method: 'POST', body: { rows } }); toast(`Imported ${r.imported} expense${r.imported === 1 ? '' : 's'}${r.skipped ? `, skipped ${r.skipped}` : ''}`); s.reload(); } catch (x) { toast(x.message); } };
  return <Shell><div className="hd"><div><h1>Reports</h1><p className="mu">Trends and breakdowns.</p></div>
    <div className="acts"><label className="btn" htmlFor="imp" style={{ margin: 0 }}>Import CSV</label><input id="imp" type="file" accept=".csv,text/csv" hidden onChange={onImport} /><button className="btn p" onClick={download}>Download CSV</button></div></div>
    <State s={s}>{s.data && <div className="grid"><div className="card"><h2>Spending trend (last 6 months)</h2><Trend data={s.data.trend} /></div>
      <div className="card"><h2>Category breakdown, {mname(s.data.month)}</h2><Pie data={s.data.categories} /></div></div>}</State></Shell>;
}
