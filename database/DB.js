
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  user: 'postgres',
  password: '12345',
  host: 'localhost',
  port: 5432,
  database: 'mywomanproject',
});

await client.connect();

export default client;
