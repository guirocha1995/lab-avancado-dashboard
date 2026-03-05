const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).then((pool) => {
      console.log('Connected to Azure SQL Database');
      return pool;
    }).catch((err) => {
      poolPromise = null;
      console.error('Database connection failed:', err.message);
      throw err;
    });
  }
  return poolPromise;
}

async function query(sqlText, params = {}) {
  const pool = await getPool();
  const request = pool.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  const result = await request.query(sqlText);
  return result.recordset;
}

async function execute(sqlText, params = {}) {
  const pool = await getPool();
  const request = pool.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  return request.query(sqlText);
}

module.exports = { getPool, query, execute, sql };
