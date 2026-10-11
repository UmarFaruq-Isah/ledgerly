import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { Logo, useAuth, toast } from '../lib.jsx';

const Top = () => <div className="top"><Link className="brand" to="/" style={{ margin: 0, color: 'var(--tx)' }}><Logo />Ledgerly</Link></div>;
export function Landing() {
  const { user } = useAuth();
  return <div className="pub">
    <div className="top"><div className="brand" style={{ margin: 0 }}><Logo />Ledgerly</div>
      <div>{user ? <Link className="btn p" to="/dashboard">Open dashboard</Link> : <><Link className="btn" to="/login">Login</Link> <Link className="btn p" to="/signup">Sign Up</Link></>}</div></div>
    <div className="hero"><h1>Track your expenses. Take control of your money.</h1><p>Log spending in seconds, set budgets that warn you early, and see exactly where your money goes each month.</p>
      {!user && <><Link className="btn p" to="/signup">Sign Up</Link> <Link className="btn" to="/login">Login</Link></>}</div>
    <div className="hl">
      <div className="card"><h2>Categorised spending</h2><p className="mu">Food, rent, transport and more, with filters by day, week, month or year.</p></div>
      <div className="card"><h2>Budgets with alerts</h2><p className="mu">Set a limit per category and get warned at 90% of it.</p></div>
      <div className="card"><h2>Reports and CSV</h2><p className="mu">Trend and category charts, plus CSV export and import.</p></div></div></div>;
}
function AuthBox({ title, sub, cta, foot, fields, onSubmit }) {
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setErr(''); setBusy(true); try { await onSubmit(Object.fromEntries(new FormData(e.target))); } catch (x) { setErr(x.message); } setBusy(false); };
  return <div className="pub"><Top /><div className="auth card"><h1>{title}</h1><p className="mu" style={{ marginBottom: 20 }}>{sub}</p>
    <form onSubmit={submit} noValidate>{fields.map(([n, l, t, ac]) => <div className="f" key={n}><label htmlFor={n}>{l}</label><input id={n} name={n} type={t || 'text'} autoComplete={ac} /></div>)}
      <p className="err" role="alert">{err}</p><button className="btn p" style={{ width: '100%' }} disabled={busy}>{cta}</button></form>
    <p className="sm mu" style={{ marginTop: 16, textAlign: 'center' }}>{foot}</p></div></div>;
}
export const Login = () => { const { login } = useAuth();
  return <AuthBox title="Welcome back" sub="Log in to your account." cta="Login" onSubmit={async v => login(await api('/auth/login', { method: 'POST', body: v }))}
    fields={[['email', 'Email', 'email', 'email'], ['password', 'Password', 'password', 'current-password']]}
    foot={<><Link to="/forgot">Forgot Password?</Link> · New here? <Link to="/signup">Create an account</Link></>} />; };
export const Signup = () => { const { login } = useAuth();
  return <AuthBox title="Create your account" sub="Start tracking in under a minute." cta="Create Account" onSubmit={async v => login(await api('/auth/signup', { method: 'POST', body: v }))}
    fields={[['name', 'Name (optional)', 'text', 'name'], ['email', 'Email', 'email', 'email'], ['password', 'Password (min. 8 characters)', 'password', 'new-password']]}
    foot={<>Already registered? <Link to="/login">Login</Link></>} />; };
export function Forgot() {
  const [res, setRes] = useState(null);
  if (res) return <div className="pub"><Top /><div className="auth card"><h1>Check your email</h1><p className="mu">{res.message}</p>
    {res.devToken && <p className="sm" style={{ marginTop: 16 }}>Development mode (no mail server): <Link to={'/reset/' + res.devToken}>open reset link</Link></p>}
    <p className="sm" style={{ marginTop: 16 }}><Link to="/login">Back to login</Link></p></div></div>;
  return <AuthBox title="Reset password" sub="Enter your email and we'll send you a reset link." cta="Send reset link" onSubmit={async v => setRes(await api('/auth/forgot', { method: 'POST', body: v }))}
    fields={[['email', 'Email', 'email', 'email']]} foot={<Link to="/login">Back to login</Link>} />;
}
export function Reset() {
  const { token } = useParams(), nav = useNavigate();
  return <AuthBox title="Choose a new password" sub="Use at least 8 characters." cta="Reset Password" fields={[['password', 'New password', 'password', 'new-password']]}
    onSubmit={async v => { await api('/auth/reset', { method: 'POST', body: { token, password: v.password } }); toast('Password updated. Please log in.'); nav('/login'); }}
    foot={<Link to="/login">Back to login</Link>} />;
}
