import { useState } from 'react';
import { api } from '../api';
import { Shell, useAuth, toast } from '../lib.jsx';

function Form({ onSubmit, cta, children }) {
  const [err, setErr] = useState('');
  const go = async e => { e.preventDefault(); setErr(''); const f = e.target; try { await onSubmit(Object.fromEntries(new FormData(f)), f); } catch (x) { setErr(x.message); } };
  return <form onSubmit={go} noValidate>{children}<p className="err" role="alert">{err}</p><button className="btn p">{cta}</button></form>;
}
const Field = ({ n, l, t, ...r }) => <div className="f"><label htmlFor={n}>{l}</label><input id={n} name={n} type={t || 'text'} {...r} /></div>;

export default function Settings() {
  const { user, setUser } = useAuth();
  const patch = async body => { const d = await api('/auth/me', { method: 'PATCH', body }); setUser(d.user); toast('Saved'); };
  return <Shell><div className="hd"><h1>Settings</h1></div><div className="grid g2">
    <div className="card"><h2>Profile</h2><Form cta="Save profile" onSubmit={v => patch({ name: v.name })}><Field n="name" l="Name" defaultValue={user.name} /><div className="f"><label>Email</label><input value={user.email} disabled readOnly /></div></Form></div>
    <div className="card"><h2>Security</h2><Form cta="Change password" onSubmit={async (v, f) => { await api('/auth/password', { method: 'POST', body: { current: v.current, password: v.password } }); f.reset(); toast('Password changed'); }}>
      <Field n="current" l="Current password" t="password" autoComplete="current-password" /><Field n="password" l="New password" t="password" autoComplete="new-password" /></Form></div>
    <div className="card"><h2>Preferences</h2><Form cta="Save preferences" onSubmit={v => patch({ currency: v.currency, theme: v.theme })}>
      <div className="f"><label htmlFor="currency">Currency</label><select id="currency" name="currency" defaultValue={user.currency}>{['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'].map(c => <option key={c}>{c}</option>)}</select></div>
      <div className="f"><label htmlFor="theme">Theme</label><select id="theme" name="theme" defaultValue={user.theme}>{['system', 'light', 'dark'].map(c => <option key={c}>{c}</option>)}</select></div></Form></div></div></Shell>;
}
