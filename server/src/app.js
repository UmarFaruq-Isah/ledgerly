const express = require('express'), cors = require('cors'), helmet = require('helmet'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), crypto = require('crypto'), path = require('path'), fs = require('fs');

const CATS = ['Food', 'Rent', 'Transport', 'Utilities', 'Health', 'Entertainment', 'Shopping', 'Other'];
const CURS = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'], THEMES = ['system', 'light', 'dark'];
const dstr = v => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const wrap = f => (req, res, next) => Promise.resolve(f(req, res, next)).catch(next);
const bad = (res, m, c = 400) => res.status(c).json({ error: m });
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const expense = r => ({ id: r.id, amount: Number(r.amount), category: r.category, date: dstr(r.date), notes: r.notes || '' });
const userOut = u => ({ id: u.id, email: u.email, name: u.name, currency: u.currency, theme: u.theme });

function validExpense(b) {
  const amount = Number(b.amount), notes = String(b.notes || '').trim();
  if (!(amount > 0) || !isFinite(amount)) return 'Amount must be greater than zero.';
  if (!CATS.includes(b.category)) return 'Invalid category.';
  if (!isDate(b.date)) return 'Date must be YYYY-MM-DD.';
  if (notes.length > 200) return 'Notes are limited to 200 characters.';
  return null;
}

module.exports = function createApp(pool, { secret = process.env.JWT_SECRET } = {}) {
  if (!secret) throw new Error('JWT_SECRET is required');
  const q = (sql, p) => pool.query(sql, p);
  const app = express(), api = express.Router();
  app.use(helmet()); app.use(cors({ origin: process.env.CLIENT_ORIGIN || true })); app.use(express.json({ limit: '1mb' }));

  const issue = id => jwt.sign({ sub: id, jti: crypto.randomUUID() }, secret, { expiresIn: '7d' });
  const auth = wrap(async (req, res, next) => {
    let p; try { p = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret); } catch { return bad(res, 'Unauthorized', 401); }
    if ((await q('SELECT 1 FROM revoked_tokens WHERE jti=$1', [p.jti])).rows.length) return bad(res, 'Session expired', 401);
    req.uid = Number(p.sub); req.jwt = p; next();
  });

  api.get('/health', (_, res) => res.json({ ok: true }));

  /* ---------- auth ---------- */
  api.post('/auth/signup', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase(), pw = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter a valid email address.');
    if (pw.length < 8) return bad(res, 'Password must be at least 8 characters.');
    if ((await q('SELECT 1 FROM users WHERE email=$1', [email])).rows.length) return bad(res, 'An account with this email already exists.', 409);
    const name = String(req.body.name || '').trim().slice(0, 60) || email.split('@')[0];
    const { rows } = await q('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING *', [email, name, await bcrypt.hash(pw, 10)]);
    res.status(201).json({ token: issue(rows[0].id), user: userOut(rows[0]) });
  }));
  api.post('/auth/login', wrap(async (req, res) => {
    const { rows } = await q('SELECT * FROM users WHERE email=$1', [String(req.body.email || '').trim().toLowerCase()]);
    if (!rows[0] || !(await bcrypt.compare(String(req.body.password || ''), rows[0].password_hash))) return bad(res, 'Incorrect email or password.', 401);
    res.json({ token: issue(rows[0].id), user: userOut(rows[0]) });
  }));
  api.post('/auth/logout', auth, wrap(async (req, res) => {
    await q('INSERT INTO revoked_tokens(jti,expires_at) VALUES($1,$2)', [req.jwt.jti, new Date(req.jwt.exp * 1000)]);
    await q('DELETE FROM revoked_tokens WHERE expires_at < $1', [new Date()]);
    res.json({ ok: true });
  }));
  api.post('/auth/forgot', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase(), token = crypto.randomBytes(24).toString('hex');
    const r = await q('UPDATE users SET reset_hash=$1,reset_exp=$2 WHERE email=$3 RETURNING id', [sha(token), new Date(Date.now() + 3600e3), email]);
    const out = { message: 'If that email is registered, a reset link has been sent.' };
    // No email provider is wired up. Outside production the token is returned so the flow can be exercised; plug a mailer in here.
    if (r.rows.length && process.env.NODE_ENV !== 'production') { out.devToken = token; console.log(`[reset] /reset/${token}`); }
    res.json(out);
  }));
  api.post('/auth/reset', wrap(async (req, res) => {
    const pw = String(req.body.password || '');
    if (pw.length < 8) return bad(res, 'Password must be at least 8 characters.');
    const r = await q('UPDATE users SET password_hash=$1,reset_hash=NULL,reset_exp=NULL WHERE reset_hash=$2 AND reset_exp > $3 RETURNING id', [await bcrypt.hash(pw, 10), sha(String(req.body.token || '')), new Date()]);
    if (!r.rows.length) return bad(res, 'This reset link is invalid or has expired.');
    res.json({ ok: true });
  }));
  api.get('/auth/me', auth, wrap(async (req, res) => {
    const { rows } = await q('SELECT * FROM users WHERE id=$1', [req.uid]);
    rows[0] ? res.json({ user: userOut(rows[0]) }) : bad(res, 'Unauthorized', 401);
  }));
  api.patch('/auth/me', auth, wrap(async (req, res) => {
    const { rows: [u] } = await q('SELECT * FROM users WHERE id=$1', [req.uid]);
    const name = req.body.name === undefined ? u.name : String(req.body.name).trim().slice(0, 60);
    const currency = req.body.currency === undefined ? u.currency : req.body.currency, theme = req.body.theme === undefined ? u.theme : req.body.theme;
    if (!name) return bad(res, 'Name cannot be empty.');
    if (!CURS.includes(currency) || !THEMES.includes(theme)) return bad(res, 'Invalid preference.');
    const { rows } = await q('UPDATE users SET name=$1,currency=$2,theme=$3 WHERE id=$4 RETURNING *', [name, currency, theme, req.uid]);
    res.json({ user: userOut(rows[0]) });
  }));
  api.post('/auth/password', auth, wrap(async (req, res) => {
    const { rows: [u] } = await q('SELECT * FROM users WHERE id=$1', [req.uid]);
    if (!(await bcrypt.compare(String(req.body.current || ''), u.password_hash))) return bad(res, 'Current password is incorrect.');
    if (String(req.body.password || '').length < 8) return bad(res, 'New password must be at least 8 characters.');
    await q('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(req.body.password, 10), req.uid]);
    res.json({ ok: true });
  }));

  /* ---------- expenses ---------- */
  api.get('/expenses', auth, wrap(async (req, res) => {
    const w = ['user_id=$1'], p = [req.uid], { from, to, category, limit } = req.query;
    if (from) { if (!isDate(from)) return bad(res, 'Invalid from date.'); p.push(from); w.push(`date>=$${p.length}`); }
    if (to) { if (!isDate(to)) return bad(res, 'Invalid to date.'); p.push(to); w.push(`date<=$${p.length}`); }
    if (category) { p.push(category); w.push(`category=$${p.length}`); }
    const lim = Math.min(Math.max(parseInt(limit) || 1000, 1), 1000);
    const { rows } = await q(`SELECT * FROM expenses WHERE ${w.join(' AND ')} ORDER BY date DESC, id DESC LIMIT ${lim}`, p);
    const list = rows.map(expense);
    res.json({ expenses: list, total: list.reduce((s, e) => s + e.amount, 0) });
  }));
  api.get('/expenses/:id', auth, wrap(async (req, res) => {
    const { rows } = await q('SELECT * FROM expenses WHERE id=$1 AND user_id=$2', [parseInt(req.params.id) || 0, req.uid]);
    rows[0] ? res.json({ expense: expense(rows[0]) }) : bad(res, 'Expense not found.', 404);
  }));
  api.post('/expenses', auth, wrap(async (req, res) => {
    const e = validExpense(req.body); if (e) return bad(res, e);
    const { rows } = await q('INSERT INTO expenses(user_id,amount,category,date,notes) VALUES($1,$2,$3,$4,$5) RETURNING *', [req.uid, Number(req.body.amount), req.body.category, req.body.date, String(req.body.notes || '').trim()]);
    res.status(201).json({ expense: expense(rows[0]) });
  }));
  api.post('/expenses/import', auth, wrap(async (req, res) => {
    const list = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 1000) : null;
    if (!list) return bad(res, 'rows must be an array.');
    let imported = 0, skipped = 0;
    for (const r of list) {
      const row = { ...r, category: CATS.includes(r.category) ? r.category : 'Other' };
      if (validExpense(row)) { skipped++; continue; }
      await q('INSERT INTO expenses(user_id,amount,category,date,notes) VALUES($1,$2,$3,$4,$5)', [req.uid, Number(row.amount), row.category, row.date, String(row.notes || '').trim()]);
      imported++;
    }
    res.json({ imported, skipped });
  }));
  api.put('/expenses/:id', auth, wrap(async (req, res) => {
    const e = validExpense(req.body); if (e) return bad(res, e);
    const { rows } = await q('UPDATE expenses SET amount=$1,category=$2,date=$3,notes=$4 WHERE id=$5 AND user_id=$6 RETURNING *', [Number(req.body.amount), req.body.category, req.body.date, String(req.body.notes || '').trim(), parseInt(req.params.id) || 0, req.uid]);
    rows[0] ? res.json({ expense: expense(rows[0]) }) : bad(res, 'Expense not found.', 404);
  }));
  api.delete('/expenses/:id', auth, wrap(async (req, res) => {
    const r = await q('DELETE FROM expenses WHERE id=$1 AND user_id=$2 RETURNING id', [parseInt(req.params.id) || 0, req.uid]);
    r.rows.length ? res.json({ ok: true }) : bad(res, 'Expense not found.', 404);
  }));

  /* ---------- budgets ---------- */
  api.get('/budgets', auth, wrap(async (req, res) => {
    const { rows } = await q('SELECT category,monthly_limit FROM budgets WHERE user_id=$1 ORDER BY category', [req.uid]);
    res.json({ budgets: rows.map(r => ({ category: r.category, limit: Number(r.monthly_limit) })) });
  }));
  api.post('/budgets', auth, wrap(async (req, res) => {
    const limit = Number(req.body.limit);
    if (!CATS.includes(req.body.category)) return bad(res, 'Invalid category.');
    if (!(limit > 0) || !isFinite(limit)) return bad(res, 'Limit must be greater than zero.');
    const u = await q('UPDATE budgets SET monthly_limit=$1 WHERE user_id=$2 AND category=$3 RETURNING category', [limit, req.uid, req.body.category]);
    if (!u.rows.length) await q('INSERT INTO budgets(user_id,category,monthly_limit) VALUES($1,$2,$3)', [req.uid, req.body.category, limit]);
    res.status(201).json({ budget: { category: req.body.category, limit } });
  }));
  api.delete('/budgets/:category', auth, wrap(async (req, res) => {
    await q('DELETE FROM budgets WHERE user_id=$1 AND category=$2', [req.uid, req.params.category]);
    res.json({ ok: true });
  }));

  /* ---------- reports ---------- */
  api.get('/reports', auth, wrap(async (req, res) => {
    const cur = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
    const [y, m] = cur.split('-').map(Number), months = [];
    for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
    const { rows } = await q('SELECT amount,category,date FROM expenses WHERE user_id=$1 AND date>=$2 AND date<=$3', [req.uid, months[0] + '-01', cur + '-31']);
    const trend = months.map(k => ({ month: k, total: 0 })), cats = {}; let total = 0, count = 0;
    for (const r of rows) {
      const k = dstr(r.date).slice(0, 7), a = Number(r.amount), t = trend.find(x => x.month === k);
      if (t) t.total += a;
      if (k === cur) { cats[r.category] = (cats[r.category] || 0) + a; total += a; count++; }
    }
    const categories = Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    res.json({ month: cur, total, count, topCategory: categories[0] ? categories[0].name : null, categories, trend });
  }));

  api.use((req, res) => bad(res, 'Not found', 404));
  app.use('/api', api);

  const dist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html'))); }
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); });
  return app;
};
