require('dotenv').config();
const fs = require('fs'), path = require('path'), { Pool, types } = require('pg');
const createApp = require('./app');
types.setTypeParser(1082, v => v); // keep DATE columns as 'YYYY-MM-DD' strings
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const port = process.env.PORT || 4000;
  createApp(pool).listen(port, () => console.log(`Ledgerly API on :${port}`));
})().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
