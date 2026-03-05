# Lab Avancado — Retail Operations Dashboard

Dashboard operacional de varejo em tempo real que integra **12 servicos Azure** em um unico fluxo visivel no browser.

O aluno cria um pedido na interface e acompanha todo o pipeline de processamento — desde o APIM gateway ate a notificacao de estoque baixo — com eventos aparecendo em tempo real via Server-Sent Events (SSE).

## Servicos Azure Utilizados

| # | Servico | Funcao no Lab |
|---|---------|---------------|
| 1 | **App Service** (B1 Linux) | Hospeda o dashboard (React + Express API) |
| 2 | **Azure SQL Database** (Serverless) | Persistencia de produtos, pedidos e eventos |
| 3 | **API Management** (Consumption) | Gateway com rate-limit, subscription key e validate-jwt |
| 4 | **Azure Functions** (Consumption) | HTTP, Queue, Topic, Event Grid e Event Hub triggers |
| 5 | **Durable Functions** | Orquestrador com 6 activity functions encadeadas |
| 6 | **Service Bus** (Standard) | Queue (order-queue) + Topic (order-events) + Subscription com filtro SQL |
| 7 | **Event Grid** | Custom Topic para alertas de estoque baixo |
| 8 | **Event Hubs** (Standard) | Ingestao de telemetria em escala |
| 9 | **Logic Apps** (Consumption) | Aprovacao de credito (>R$5k) + alerta de estoque |
| 10 | **Application Insights** | Monitoramento centralizado |
| 11 | **Microsoft Entra ID** | OAuth 2.0 Client Credentials + validate-jwt no APIM |
| 12 | **GitHub Actions** | CI/CD automatizado (App Service + Functions + DB seed) |

## Estrutura do Repositorio

```
lab-avancado-dashboard/
├── dashboard/              # App Service (Express API + React SPA)
│   ├── server/             # Express API (routes, SSE, auth, db)
│   ├── src/                # React com Vite + Tailwind CSS
│   ├── sql/init.sql        # Schema + seed (12 produtos)
│   ├── scripts/init-db.js  # Script de inicializacao do banco
│   └── .env.example        # Template de variaveis de ambiente
├── functions/              # Azure Functions + Durable Functions
│   ├── src/functions/      # 13 functions (HTTP, Queue, Topic, EG, EH triggers)
│   └── host.json           # Config do Durable Functions
├── logic-apps/             # Definicoes ARM das Logic Apps
├── docs/
│   ├── guia-portal.md      # Guia passo-a-passo (15 etapas)
│   └── arquitetura.drawio  # Diagrama da arquitetura (draw.io)
└── .github/workflows/
    └── deploy.yml          # CI/CD: 4 jobs automatizados
```

## Como Usar

### 1. Criar os recursos no Azure Portal

Siga o guia em [`docs/guia-portal.md`](docs/guia-portal.md) — Etapas 1 a 9.

Voce criara: Resource Group, SQL Database, App Service, Service Bus, API Management, Event Grid, Event Hubs, Logic Apps e Function App.

### 2. Fazer fork e configurar secrets

1. Faca **fork** deste repositorio para sua conta GitHub
2. No fork, va em **Settings** > **Secrets and variables** > **Actions**
3. Adicione os secrets:

| Secret | Exemplo |
|--------|---------|
| `AZURE_CREDENTIALS` | JSON do Service Principal |
| `LAB_AVANCADO_APP_NAME` | `app-lab-avancado` |
| `LAB_AVANCADO_FUNCTIONAPP_NAME` | `func-lab-avancado` |
| `LAB_AVANCADO_SQL_SERVER` | `sql-lab-avancado.database.windows.net` |
| `LAB_AVANCADO_SQL_DATABASE` | `sqldb-lab-avancado` |
| `LAB_AVANCADO_SQL_USER` | `sqladmin` |
| `LAB_AVANCADO_SQL_PASSWORD` | Sua senha |

### 3. Executar o deploy

Va em **Actions** > **Deploy Lab Avancado** > **Run workflow**.

O workflow executa 4 jobs automaticamente:
- **Validate** — Build React + verifica sintaxe JS
- **Deploy App Service** — Empacota e deploya Express + React
- **Deploy Functions** — Deploya as 13 Azure Functions
- **Seed Database** — Cria tabelas e insere 12 produtos

### 4. Continuar o guia

Apos o deploy, continue com as Etapas 11 a 15 do guia:
- Event Grid Subscription
- Pre-teste
- App Registrations (OAuth 2.0)
- Testes completos
- Limpeza

## Custo Estimado

| Cenario | Custo |
|---------|-------|
| Lab completo (1 dia) | ~R$ 12-15 |
| Mensal (se esquecer de deletar) | ~R$ 260 |

**Delete o Resource Group ao terminar!**

## Desenvolvimento Local

```bash
cd dashboard
cp .env.example .env   # Preencha com seus valores
npm install
npm run dev            # Inicia Express (3001) + Vite (5173)
```

---

*Disciplina: Integracao e Mensageria no Azure — TFTEC + Anhanguera*
