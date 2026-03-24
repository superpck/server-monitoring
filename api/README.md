# API Gateway

Express/TypeScript + SQLite server acting as a **central API gateway** between the Angular UI and server agents (`server-api`).

- JWT-based authentication with role-based access (`admin` / `monitor`)
- Manages server groups & agents stored in SQLite
- Proxies requests to agents — `server_key` values are never exposed to the browser

---

## Security Flow

```
Angular UI
    │  Authorization: Bearer <JWT>
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
  data/
    servers.db              ← SQLite database (auto-created)
  src/
    server.ts               ← Express entry point
    config.ts               ← parse env vars
    types.ts                ← AgentConfig interface
    db/
      database.ts           ← DB init, migrations, seed users
    middleware/
      auth.middleware.ts    ← JWT + static API key verification
      logger.middleware.ts  ← log ip + method + path
    routes/
      index.ts
      auth.routes.ts        ← POST /auth/login, GET /auth/random-string/:len
      servers.routes.ts     ← CRUD /servers/groups, /servers/agents
      users.routes.ts       ← CRUD /users
      agents.routes.ts      ← GET /agents (env-based, legacy)
      proxy.routes.ts       ← ALL /proxy/:agentId/*
    utils/
      ip.utils.ts           ← CIDR helpers
      util.ts               ← randomString, hashPassword, verifyPassword
```

---

## Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/random-string/:len` | — | Generate a random string (10–1024 chars) |

**Login request:**
```json
POST /auth/login
{ "username": "admin", "password": "Admin@1234" }
```
**Response:**
```json
{ "status": 200, "token": "<JWT>", "expiresIn": "8h" }
```

> `superadmin` is a reserved username authenticated from `.env` (`SUPERADMIN_PASSWORD`), not from the DB.

---

### Servers (Groups & Agents)

`GET /servers` is public. All write routes require `Authorization: Bearer <JWT>` with `role: admin`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/servers` | — | List all groups with their agents (ordered by `seq`) |
| POST | `/servers/groups` | Admin | Create a group |
| PUT | `/servers/groups/:groupid` | Admin | Update group (name, detail, seq) |
| DELETE | `/servers/groups/:groupid` | Admin | Delete group (cascades agents) |
| POST | `/servers/agents` | Admin | Create an agent |
| PUT | `/servers/agents/:agentid` | Admin | Update agent (name, url, seq, …) |
| DELETE | `/servers/agents/:agentid` | Admin | Delete agent |
| PATCH | `/servers/agents/:agentid/toggle` | Admin | Toggle isactive 0/1 |

**GET /servers response:**
```json
{
  "status": 200,
  "groups": [
    {
      "groupid": 1, "group": "Production", "detail": "", "seq": 10,
      "agents": [
        { "agentid": 1, "groupid": 1, "name": "Web", "url": "https://...", "isactive": 1, "seq": 10 }
      ]
    }
  ]
}
```

---

### Users

All routes require `Authorization: Bearer <JWT>` with `role: admin`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users (password excluded) |
| GET | `/users/:userid` | Get user by id |
| POST | `/users` | Create user |
| PUT | `/users/:userid` | Update user (name, role, user_admin, password optional) |
| DELETE | `/users/:userid` | Delete user |

**User fields:** `userid`, `username`, `name`, `role` (`admin`\|`monitor`), `user_admin` (`1`\|`0`)

> Username `superadmin` is reserved and cannot be created via the API.

**Default seeded users** (created once on first run):

| username | password | role | user_admin |
|----------|----------|------|-----------|
| `admin` | `Admin@1234` | admin | 1 |
| `user1` | `User1@1234` | monitor | 0 |

---

### Proxy

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| ALL | `/proxy/:agentId/*` | Auth | Forward request to the target agent |

**Example:**
```
GET /proxy/web-1/dashboard/summary
  → GET https://example.com/svr-mng/dashboard/summary
      + X-Server-Key: <web-1's server_key>
```

Supports all HTTP methods. Query strings and request bodies are forwarded as-is.

| Status | Reason |
|--------|--------|
| `401` | Missing or invalid `Authorization` header |
| `404` | `:agentId` not found |
| `502` | Cannot reach agent (ECONNREFUSED) |
| `504` | Agent timeout (>30 s) |

---

## Configuration `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Gateway port (default `4000`) |
| `JWT_SECRET` | **Yes** | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | Token lifetime (default `8h`) |
| `SUPERADMIN_PASSWORD` | **Yes** | Password for the reserved `superadmin` account |
| `UI_API_KEY` | No | Static machine-to-machine key (fallback auth) |
| `AGENTS` | No | JSON array of env-based agent configs (legacy) |

---

## Getting Started

```bash
cd api

# 1. Install dependencies
npm install

# 2. Create .env from template
cp .env.example .env
# Set JWT_SECRET and SUPERADMIN_PASSWORD at minimum

# 3. Dev mode (nodemon + ts-node)
npm run dev

# 4. Production
npm run build   # compile TypeScript → dist/
npm start       # run compiled output
# or: pm2 start ecosystem.config.js
```

The SQLite database (`data/servers.db`) is created automatically on first run, including the `users` table with two default accounts.
