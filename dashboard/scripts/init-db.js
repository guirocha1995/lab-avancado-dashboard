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
  connectionTimeout: 90000,
  requestTimeout: 90000,
};

async function connectWithRetry(retries = 15, delayMs = 15000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${retries} de conexão ao banco...`);
      const pool = await sql.connect(config);
      console.log("✅ Conexão estabelecida com sucesso!");
      return pool;
    } catch (err) {
      console.error(`❌ Tentativa ${attempt} falhou: ${err.message}`);
      
      if (attempt === retries) {
        console.error("⛔ Todas as tentativas esgotadas.");
        throw err;
      }
      
      console.log(`⏳ Aguardando ${delayMs/1000} segundos...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  let pool = null;
  try {
    pool = await connectWithRetry();

    console.log("🚀 Iniciando seed do banco de dados...");

    // ================== SEU CÓDIGO DE SEED AQUI ==================
    // Exemplo:
    // await pool.query(`IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SuaTabela') ...`);

    console.log("✅ Seed executado com sucesso!");

  } catch (err) {
    console.error("❌ Falha na inicialização do banco:", err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
