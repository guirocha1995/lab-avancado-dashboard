const sql = require('mssql');
require('dotenv').config(); // caso queira usar .env local também

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
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

/**
 * Conexão com Retry (principal solução para EAI_AGAIN)
 */
async function connectWithRetry(retries = 6, delayMs = 8000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${retries} - Conectando ao Azure SQL...`);
      
      const pool = await sql.connect(config);
      console.log("✅ Conexão estabelecida com sucesso!");
      return pool;
    } catch (err) {
      console.error(`❌ Tentativa ${attempt} falhou: ${err.message}`);

      if (attempt === retries) {
        console.error("⛔ Todas as tentativas falharam. Verifique o firewall, DNS ou segredos.");
        throw err;
      }

      console.log(`⏳ Aguardando ${delayMs / 1000} segundos...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  let pool = null;

  try {
    pool = await connectWithRetry();

    console.log("🚀 Iniciando seed do banco de dados...");

    // ====================== SEU CÓDIGO DE SEED ======================
    // Coloque aqui todas as queries de CREATE TABLE, INSERT, etc.
    // Exemplo:
    /*
    await pool.query(`
      IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
      CREATE TABLE Usuarios (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nome VARCHAR(100),
        email VARCHAR(150) UNIQUE
      );
    `);
    */

    console.log("✅ Seed do banco finalizado com sucesso!");

  } catch (err) {
    console.error("❌ Falha na inicialização do banco:", err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log("🔌 Conexão com o banco fechada.");
    }
  }
}

main();
