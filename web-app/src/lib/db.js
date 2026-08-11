import { Pool } from 'pg';

let pool;

if (!pool) {
  pool = new Pool({
    host: 'localhost',
    port: 1234,
    user: 'postgres',
    password: 'karunakar',
    database: 'test',
  });
}

export default pool;
