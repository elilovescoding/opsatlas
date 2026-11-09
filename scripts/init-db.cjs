const { Client } = require('pg');
(async () => {
  const client = new Client({ host: '127.0.0.1', port: 55432, user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: 'postgres' });
  await client.connect();
  try {
    for (const database of ['opsatlas', 'opsatlas_test']) {
      const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
      if (!result.rowCount) await client.query(`CREATE DATABASE ${database}`);
    }
  } finally { await client.end(); }
})().catch(error => { console.error(`Database initialization failed (${error.code ?? error.name}).`); process.exitCode = 1; });
