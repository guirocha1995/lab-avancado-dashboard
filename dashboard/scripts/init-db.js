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
  connectionTimeout: 60000,
  requestTimeout: 60000,
};

async function connectWithRetry(retries = 10, delayMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${retries}...`);
      const pool = await sql.connect(config);
      console.log("✅ Conectado com sucesso!");
      return pool;
    } catch (err) {
      console.error(`❌ Falha ${attempt}: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  let pool = null;
  try {
    pool = await connectWithRetry();
    console.log("🚀 Iniciando seed...");

    // Seu código de seed aqui

    console.log("✅ Seed finalizado!");
  } catch (err) {
    console.error("❌ Erro final:", err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
