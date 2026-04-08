const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  connectionTimeout: 45000,   // aumentado
  requestTimeout: 60000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  }
};

async function connectWithRetry(retries = 8, delayMs = 10000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${retries} - Conectando ao ${config.server}...`);
      
      const pool = await sql.connect(config);
      console.log("✅ Conexão estabelecida com sucesso!");
      return pool;
    } catch (err) {
      console.error(`❌ Tentativa ${attempt} falhou: ${err.message}`);
      
      if (attempt === retries) throw err;
      
      console.log(`⏳ Aguardando ${delayMs/1000}s antes da próxima tentativa...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  let pool = null;
  try {
    pool = await connectWithRetry();

    console.log("🚀 Iniciando seed do banco...");

    // Coloque aqui suas queries de CREATE TABLE / INSERTS

    console.log("✅ Seed concluído com sucesso!");

  } catch (err) {
    console.error("❌ Falha final na conexão:", err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
