# Server Monitoring

A web-based dashboard for monitoring server metrics in real time.  
Consists of 3 main parts: **Agent (server-api)**, **UI (frontend)**, and **API Gateway (api)**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      frontend                       │
│              Angular UI (port 4204)                 │
└────────────────────┬────────────────────────────────┘
                     │  Authorization: Bearer <UI_API_KEY>
          ┌──────────┴──────────┐
          │         api         │   ← API Gateway (port 4000)
          │   Express Proxy     │
          └──────────┬──────────┘
                     │  X-Server-Key: <server_key>
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 server-api       server-api      server-api
 (Server A)       (Server B)      (Server C)
  port 3003        port 3003       port 3003
```

### Security Chain

```
UI  ──[Bearer UI_API_KEY]──►  api/  ──[X-Server-Key]──►  agent
                                                              │
                                               ✓ SERVER_KEY match?
                                               ✓ IP ∈ ALLOWED_IP_RANGES?
```

---

## Folders

### `server-api/` — Agent
Install on **every server you want to monitor**.  
An Express API that exposes the host machine's metrics (CPU, Memory, Disk, Network, Processes, Nginx, Database).

**Security:** Every request is verified by the `securityGuard` middleware before reaching any route.
- `SERVER_KEY` — requests must include a matching `X-Server-Key` header
- `ALLOWED_IP_RANGES` — (optional) restrict access to specific CIDRs (e.g. the API gateway IP)

**Port:** `3000` (default, configurable via `.env`)

**Required `.env`:**
```env
PORT=3003
SERVER_NAME=agent-server-01
SERVER_KEY=agent-secret-key-32to128chars
ALLOWED_IP_RANGES=192.168.100.1/32,10.0.0.0/8   # IP of the API gateway
```

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/summary` | Overview of all metrics (CPU, MEM, DISK, Network, Load, Processes) |
| GET | `/system` | System info |
| GET | `/monitor` | Real-time metrics |
| GET | `/database` | Database connection & query stats |
| GET | `/nginx/status` | Nginx service status |
| GET | `/nginx/logs` | Nginx error logs |
| GET | `/logs/service` | Service logs |

> All endpoints require the `X-Server-Key` header (unless `SERVER_KEY` is not set in `.env`)

**Dev:**
```bash
cd server-api
npm install
npm run dev        # nodemon + ts-node
```

**Production:**
```bash
npm run build      # compile TypeScript → dist/
npm start          # build + run
# or use PM2 via ecosystem.config.js
```

---

### `frontend/` — UI
Angular web application for viewing metrics from all agents.

**Port:** `4204`

**Pages:**
- **Dashboard** — Server metrics charts (CPU, Memory, Disk, Network)
- **Alive** — Tree view showing online/offline status of all agents with auto-refresh every 10 seconds
- **Database** — Database monitoring
- **Management** — Select a server and view monitors side-by-side (Server / DB / PM2 / Nginx)

**Configure servers** — edit `src/app/services/server-management.service.ts` in the `getConfigServer()` method:
```ts
getConfigServer() {
  return [
    {
      group: 'Group Name',
      detail: 'Description',
      agents: [
        { name: 'Server A', detail: '', url: 'https://example.com/svr-mng' },
      ]
    },
  ];
}
```
> Once `api/` is complete, only `getConfigServer()` needs updating to call the HTTP endpoint — no component changes required.

**Dev:**
```bash
cd frontend
npm install
npm start          # ng serve --port 4204
```

**Build:**
```bash
npm run build      # output → dist/
```

---

### `api/` — Central API *(planned)*
A central API that acts as a proxy between the frontend and the agents.

**Planned features:**
- Frontend calls the central API instead of agents directly
- Central API handles routing to the correct agent
- Returns server group config to the frontend via `getConfigServer()` in `ServerManagementService` instead of a hardcoded array
- Centralized authentication and rate limiting

---

## Quick Start

1. Deploy `server-api` on each server you want to monitor
2. Edit `getConfigServer()` in `frontend/src/app/services/server-management.service.ts` to point to your agent URLs
3. Run the frontend

```bash
# Terminal 1 — agent (on the server to monitor)
cd server-api && npm run dev

# Terminal 2 — frontend (on your dev machine)
cd frontend && npm start
```
