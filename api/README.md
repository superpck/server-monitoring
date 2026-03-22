# API Gateway

Express/TypeScript server acting as a **central proxy** between the Angular UI and server agents (`server-api`).

All requests from the UI pass through this gateway — `server_key` values and agent URLs are never exposed to the browser.

---

## Security Flow

```
Angular UI
    │  Authorization: Bearer <UI_API_KEY>
    ▼
API Gateway  (port 4000)
    │  X-Server-Key: <server_key>
    ▼
server-api  (agent)
    ├─ ✓ SERVER_KEY match?
    └─ ✓ IP ∈ ALLOWED_IP_RANGES?
```

---

## Folder Structure

```
api/
  .env                      ← actual config (not committed)
  .env.example              ← template
  package.json
  tsconfig.json
  nodemon.json
  ecosystem.config.js
  src/
    server.ts               ← Express entry point
    config.ts               ← parse env vars → agents[]
    types.ts                ← AgentConfig, AgentPublic interfaces
    middleware/
      auth.middleware.ts    ← verify Authorization: Bearer <UI_API_KEY>
      logger.middleware.ts  ← log ip + method + path
    routes/
      index.ts
      agents.routes.ts      ← GET /agents
      proxy.routes.ts       ← ALL /proxy/:agentId/*
    utils/
      ip.utils.ts           ← CIDR helpers
```

---

## Endpoints

### `GET /agents`
Returns all configured agents — **`server_key` is never included** in the response.

**Required headers:**
```
Authorization: Bearer <UI_API_KEY>
```

**Response:**
```json
[
  { "id": "dev-server", "name": "dev_server", "group": "Dev Zone",    "url": "http://localhost:3003" },
  { "id": "web-1",      "name": "Web",        "group": "Production", "url": "https://example.com/svr-mng-1" }
]
```

---

### `ALL /proxy/:agentId/*path`
Forwards the request to the specified agent, automatically attaching `X-Server-Key`.

**Required headers:**
```
Authorization: Bearer <UI_API_KEY>
```

**Example:**
```
GET /proxy/dev-server/dashboard/summary
  → GET http://localhost:3003/dashboard/summary
      + X-Server-Key: <dev-server's server_key>

GET /proxy/web-1/monitor/pm2
  → GET https://example.com/svr-mng-1/monitor/pm2
      + X-Server-Key: <web-1's server_key>
```

Supports all HTTP methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.  
Query strings and request bodies are forwarded as-is.

**Error responses:**

| Status | Reason |
|--------|---------|
| `401` | Missing or invalid `Authorization` header |
| `404` | `:agentId` not found in config |
| `502` | Cannot reach agent (ECONNREFUSED) |
| `504` | Agent did not respond within 30 seconds |

---

## Configuration `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Gateway port (default `4000`) |
| `UI_API_KEY` | **Yes** | Key the UI must send in `Authorization: Bearer ...` |
| `AGENTS` | **Yes** | JSON array of agent configs (see example below) |

**`AGENTS` format:**
```env
AGENTS='[
  {
    "id":         "dev-server",
    "name":       "dev_server",
    "group":      "Dev Zone",
    "url":        "http://localhost:3003",
    "server_key": "agent-secret-key-32to128chars"
  }
]'
```

> `server_key` must match `SERVER_KEY` in that agent's `.env`  
> Always wrap the value in **single quotes** because JSON may contain special characters

---

## Getting Started

```bash
cd api

# 1. Install dependencies
npm install

# 2. Create .env from template
cp .env.example .env
# Set UI_API_KEY and AGENTS to match your environment

# 3. Dev mode (nodemon + ts-node)
npm run dev

# 4. Production
npm run build   # compile TypeScript → dist/
npm start       # build + run
```

**PM2:**
```bash
npm run build
pm2 start ecosystem.config.js
```

---

## Notes

- `server_key` is never sent to the client — it is injected only when forwarding to an agent
- Loopback IPs (`127.0.0.1`, `::1`) always pass `ALLOWED_IP_RANGES` (for local dev)
- If `SERVER_KEY` is not set in an agent's `.env`, the agent skips auth (dev mode only — not recommended in production)
