const { test } = require('node:test'), assert = require('node:assert/strict'), request = require('supertest');
const { newDb } = require('pg-mem'), fs = require('fs'), path = require('path'), createApp = require('../src/app');

function make() {
  const db = newDb(); db.public.none(fs.readFileSync(path.join(__dirname, '../src/schema.sql'), 'utf8'));
  const { Pool } = db.adapters.createPg(); return request(createApp(new Pool(), { secret: 'test-secret' }));
}
const signup = (r, email = 'a@x.com') => r.post('/api/auth/signup').send({ name: 'Umar-Faruq', email, password: 'password123' });
const month = new Date().toISOString().slice(0, 7);

test('auth: validation, signup, login, me, logout invalidates the JWT', async () => {
  const r = make();
  assert.equal((await r.post('/api/auth/signup').send({ email: 'bad', password: 'password123' })).status, 400);
  assert.equal((await r.post('/api/auth/signup').send({ email: 'a@x.com', password: 'short' })).status, 400);
  const s = await signup(r); assert.equal(s.status, 201); assert.ok(s.body.token);
  assert.equal((await signup(r)).status, 409);
  assert.equal((await r.post('/api/auth/login').send({ email: 'a@x.com', password: 'wrong-pass' })).status, 401);
  const l = await r.post('/api/auth/login').send({ email: 'A@x.com', password: 'password123' }); assert.equal(l.status, 200);
  const H = { Authorization: 'Bearer ' + l.body.token };
  assert.equal((await r.get('/api/auth/me').set(H)).body.user.name, 'Umar-Faruq');
  assert.equal((await r.get('/api/expenses')).status, 401);
  assert.equal((await r.post('/api/auth/logout').set(H)).status, 200);
  assert.equal((await r.get('/api/auth/me').set(H)).status, 401);
});

test('expenses: CRUD, validation, filters, per-user isolation, import', async () => {
  const r = make(), A = { Authorization: 'Bearer ' + (await signup(r)).body.token }, B = { Authorization: 'Bearer ' + (await signup(r, 'b@x.com')).body.token };
  assert.equal((await r.post('/api/expenses').set(A).send({ amount: 0, category: 'Food', date: `${month}-02` })).status, 400);
  assert.equal((await r.post('/api/expenses').set(A).send({ amount: 5, category: 'Nope', date: `${month}-02` })).status, 400);
  const e1 = (await r.post('/api/expenses').set(A).send({ amount: 4500.5, category: 'Food', date: `${month}-02`, notes: 'Lunch' })).body.expense;
  await r.post('/api/expenses').set(A).send({ amount: 50000, category: 'Rent', date: `${month}-03` });
  assert.equal(e1.date, `${month}-02`);
  const list = (await r.get('/api/expenses').set(A)).body; assert.equal(list.expenses.length, 2); assert.equal(list.total, 54500.5);
  assert.equal((await r.get('/api/expenses?category=Rent').set(A)).body.expenses.length, 1);
  assert.equal((await r.get(`/api/expenses?from=${month}-03&to=${month}-03`).set(A)).body.expenses.length, 1);
  assert.equal((await r.put(`/api/expenses/${e1.id}`).set(A).send({ amount: 6000, category: 'Food', date: `${month}-02`, notes: 'edited' })).body.expense.amount, 6000);
  assert.equal((await r.put(`/api/expenses/${e1.id}`).set(B).send({ amount: 1, category: 'Food', date: `${month}-02` })).status, 404);
  assert.equal((await r.delete(`/api/expenses/${e1.id}`).set(B)).status, 404);
  assert.equal((await r.get('/api/expenses').set(B)).body.expenses.length, 0);
  const imp = await r.post('/api/expenses/import').set(A).send({ rows: [{ date: `${month}-05`, category: 'Weird', amount: 10, notes: 'x' }, { date: 'bad', amount: 1 }] });
  assert.deepEqual(imp.body, { imported: 1, skipped: 1 });
  assert.equal((await r.delete(`/api/expenses/${e1.id}`).set(A)).status, 200);
  assert.equal((await r.get('/api/expenses').set(A)).body.expenses.length, 2);
});

test('budgets upsert/delete and reports aggregation', async () => {
  const r = make(), A = { Authorization: 'Bearer ' + (await signup(r)).body.token };
  await r.post('/api/expenses').set(A).send({ amount: 6000, category: 'Food', date: `${month}-02` });
  await r.post('/api/expenses').set(A).send({ amount: 2000, category: 'Food', date: `${month}-04` });
  await r.post('/api/expenses').set(A).send({ amount: 500, category: 'Rent', date: `${month}-04` });
  assert.equal((await r.post('/api/budgets').set(A).send({ category: 'Food', limit: -1 })).status, 400);
  await r.post('/api/budgets').set(A).send({ category: 'Food', limit: 8000 });
  await r.post('/api/budgets').set(A).send({ category: 'Food', limit: 9000 });
  assert.deepEqual((await r.get('/api/budgets').set(A)).body.budgets, [{ category: 'Food', limit: 9000 }]);
  const rep = (await r.get('/api/reports').set(A)).body;
  assert.equal(rep.total, 8500); assert.equal(rep.count, 3); assert.equal(rep.topCategory, 'Food');
  assert.equal(rep.trend.length, 6); assert.equal(rep.trend[5].total, 8500); assert.equal(rep.categories[0].value, 8000);
  await r.delete('/api/budgets/Food').set(A);
  assert.equal((await r.get('/api/budgets').set(A)).body.budgets.length, 0);
});

test('profile, password change, reset flow', async () => {
  const r = make(), A = { Authorization: 'Bearer ' + (await signup(r)).body.token };
  const p = await r.patch('/api/auth/me').set(A).send({ name: 'Faruq', currency: 'USD', theme: 'dark' });
  assert.deepEqual([p.body.user.name, p.body.user.currency, p.body.user.theme], ['Faruq', 'USD', 'dark']);
  assert.equal((await r.patch('/api/auth/me').set(A).send({ currency: 'XXX' })).status, 400);
  assert.equal((await r.post('/api/auth/password').set(A).send({ current: 'nope', password: 'newpassword1' })).status, 400);
  assert.equal((await r.post('/api/auth/password').set(A).send({ current: 'password123', password: 'newpassword1' })).status, 200);
  const f = await r.post('/api/auth/forgot').send({ email: 'a@x.com' }); assert.ok(f.body.devToken);
  assert.equal((await r.post('/api/auth/reset').send({ token: 'bogus', password: 'resetpass99' })).status, 400);
  assert.equal((await r.post('/api/auth/reset').send({ token: f.body.devToken, password: 'resetpass99' })).status, 200);
  assert.equal((await r.post('/api/auth/reset').send({ token: f.body.devToken, password: 'resetpass99' })).status, 400);
  assert.equal((await r.post('/api/auth/login').send({ email: 'a@x.com', password: 'resetpass99' })).status, 200);
});
