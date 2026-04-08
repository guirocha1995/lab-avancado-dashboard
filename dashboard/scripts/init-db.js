require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  pool: {
    min: 1,
    max: 5,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function initDatabase() {
  console.log('=== Lab Avancado Dashboard — Database Initialization ===\n');
  console.log(`Server:   ${config.server}`);
  console.log(`Database: ${config.database}`);
  console.log(`User:     ${config.user}\n`);

  if (!config.server || !config.database || !config.user || !config.password) {
    console.error('ERROR: Missing required environment variables.');
    console.error('Make sure SQL_SERVER, SQL_DATABASE, SQL_USER, and SQL_PASSWORD are set.');
    console.error('Copy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }

  let pool;

  try {
    console.log('Connecting to Azure SQL Database...');
    pool = await sql.connect(config);
    console.log('Connected successfully.\n');

    const sqlFilePath = path.join(__dirname, '..', 'sql', 'init.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Split on GO statements to execute batches separately
    const batches = sqlContent
      .split(/^\s*GO\s*$/im)
      .map((batch) => batch.trim())
      .filter((batch) => batch.length > 0);

    console.log(`Executing ${batches.length} SQL batch(es)...\n`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const preview = batch.substring(0, 80).replace(/\n/g, ' ');
      console.log(`  Batch ${i + 1}/${batches.length}: ${preview}...`);

      try {
        await pool.request().query(batch);
        console.log(`  -> OK`);
      } catch (batchErr) {
        console.error(`  -> FAILED: ${batchErr.message}`);
        throw batchErr;
      }
    }

    console.log('\n=== Database initialization completed successfully! ===\n');

    // Verify seed data
    const productCount = await pool.request().query('SELECT COUNT(*) AS cnt FROM Products');
    const tableCount = await pool.request().query(
      `SELECT COUNT(*) AS cnt FROM sys.tables WHERE name IN ('Products','Orders','OrderItems','EventLog','Metrics')`
    );

    console.log(`Tables created: ${tableCount.recordset[0].cnt}/5`);
    console.log(`Products seeded: ${productCount.recordset[0].cnt}`);
  } catch (err) {
    console.error('\nDatabase initialization failed:', err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\nConnection closed.');
    }
  }
}

initDatabase();
