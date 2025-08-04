const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: '12345',
  host: 'localhost',
  port: 5432,
  database: 'mywomanproject',
});

(async () => {
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log(res.rows);
  } catch (err) {
    console.error('Veritabanı bağlantı hatası:', err);
  } finally {
    await client.end();
  }
})();
