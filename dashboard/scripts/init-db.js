const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  connectionTimeout: 90000,   // 90 segundos
  requestTimeout: 90000,
};

async function connectWithRetry(retries = 12, delayMs = 15000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${retries} de conexão...`);
      const pool = await sql.connect(config);
      console.log("✅ Conectado com sucesso!");
      return pool;
    } catch (err) {
      console.error(`❌ Tentativa ${attempt} falhou: ${err.message}`);
      if (attempt === retries) throw err;
      
      console.log(`⏳ Esperando ${delayMs/1000} segundos...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  let pool = null;
  try {
    pool = await connectWithRetry();
    console.log("🚀 Iniciando seed do banco...");

    // Coloque aqui seu código de CREATE TABLE / INSERT

    console.log("✅ Seed finalizado com sucesso!");
  } catch (err) {
    console.error("❌ Falha definitiva:", err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
