# Server Monitoring — Installation Guide

This guide covers deploying all three components of the system:

| Component | Folder | Default Port | Role |
|---|---|---|---|
| **Agent** | `server-api/` | `3003` | Install on every server you want to monitor |
| **API Gateway** | `api/` | `4000` | Central hub — install once on your management server |
| **Frontend** | `frontend/` | `4204` | Web UI — served as a static build or via `ng serve` in dev |

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Requirements](#2-requirements)
3. [Step 1 — Deploy the Agent (`server-api`)](#3-step-1--deploy-the-agent-server-api)
4. [Step 2 — Deploy the API Gateway (`api`)](#4-step-2--deploy-the-api-gateway-api)
5. [Step 3 — Build and Serve the Frontend](#5-step-3--build-and-serve-the-frontend)
6. [PM2 Reference](#6-pm2-reference)
7. [Nginx Reverse Proxy Example](#7-nginx-reverse-proxy-example)
8. [Post-Installation Checklist](#8-post-installation-checklist)

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────┐
│                      frontend                       │
│              Angular UI (port 4204)                 │
└────────────────────┬────────────────────────────────┘
                     │  Authorization: Bearer <JWT token>
          ┌──────────┴──────────┐
          │         api         │   ← API Gateway (port 4000)
          │  Express + SQLite   │
          └──────────┬──────────┘
                     │  X-Server-Key: <server_key>
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
 server-api       server-api      server-api
 (Server A)       (Server B)      (Server C)
  port 3003        port 3003       port 3003
```

**Security chain:**  
`UI` ──[Bearer JWT]──► `api/` ──[X-Server-Key]──► `agent`

Each agent independently verifies the key and (optionally) the caller's IP range.

---

## 2. Requirements

| Requirement | Minimum |
|---|---|
| Node.js | v20 LTS or later (v24 recommended) |
| npm | v10+ |
| PM2 (optional) | v5+ |
| SQLite | Bundled via `better-sqlite3` — no separate install needed |
| OS | Linux, macOS, or Windows (Linux recommended for production) |

Install Node.js from [https://nodejs.org](https://nodejs.org) or use a version manager such as `nvm` or `fnm`.

---

## 3. Step 1 — Deploy the Agent (`server-api`)

Run this step on **every server you want to monitor**.

### 3.1 Install dependencies

```bash
cd server-api
npm install
```

### 3.2 Create the environment file

```bash
cp .env.example .env
```

Edit `.env` and set the following values:

#### Required

| Variable | Description |
|---|---|
| `SERVER_KEY` | Secret key the API gateway must send in the `X-Server-Key` header. Use a long random string (32–128 characters). |
| `SERVER_NAME` | Identifies this agent. Must match `X-Server-Name` sent by the gateway. |

#### Recommended for security

| Variable | Example | Description |
|---|---|---|
| `PORT` | `3003` | Port to listen on (default `3003`) |
| `ALLOWED_IP_RANGES` | `10.0.0.1/32,192.168.1.0/24` | Comma-separated CIDR list. Restricts access to the API gateway IP. Leave empty to allow all. |

#### Feature flags (all default `false`)

| Variable | Effect when `true` |
|---|---|
| `SYSTEM_OVERVIEW_ENABLED` | Enables the `/system/overview` endpoint (uname, logins, open ports, crontab) |
| `NGINX_LOG_ENABLED` | Enables `/nginx/log` and `/nginx/log/stream` |
| `SECURE_LOG_ENABLED` | Enables `/secure/sources` and `/secure/log` |
| `DB_MONITOR_ENABLED` | Enables `/database/*` endpoints |

#### Nginx log paths (when `NGINX_LOG_ENABLED=true`)

| Variable | Default |
|---|---|
| `NGINX_ACCESS_LOG` | `/var/log/nginx/access.log` |
| `NGINX_ERROR_LOG` | `/var/log/nginx/error.log` |
| `NGINX_CHECK_URL` | `http://localhost/` |

#### Database connections (when `DB_MONITOR_ENABLED=true`)

You may define multiple databases using an incrementing `<ID>` prefix:

```env
DB_MONITOR_ENABLED=true

DB_PROD_VENDOR=mysql
DB_PROD_HOST=127.0.0.1
DB_PROD_PORT=3306
DB_PROD_USER=monitor
DB_PROD_PASSWORD=secret
DB_PROD_NAME=myapp

DB_LOGS_VENDOR=pgsql
DB_LOGS_HOST=10.0.0.5
DB_LOGS_PORT=5432
DB_LOGS_USER=readonly
DB_LOGS_PASSWORD=secret
DB_LOGS_NAME=logs
```

Supported vendors: `mysql`, `mariadb`, `percona`, `pgsql`, `mssql`.

### 3.3 Example `.env` file

```env
PORT=3003
SERVER_NAME=web-server-01
SERVER_KEY=change-this-to-a-long-random-secret

ALLOWED_IP_RANGES=10.0.0.10/32   # IP of your API gateway

SYSTEM_OVERVIEW_ENABLED=true
NGINX_LOG_ENABLED=true
SECURE_LOG_ENABLED=false
DB_MONITOR_ENABLED=false
```

### 3.4 Start the agent

**Development (auto-reload):**

```bash
npm run dev
```

**Production:**

```bash
npm run build          # compile TypeScript → dist/
npm start              # node dist/server.js
# or with PM2:
pm2 start ecosystem.config.js
pm2 save
```

### 3.5 Verify the agent

```bash
curl http://localhost:3003/system/health
```

Expected response (no auth required):

```json
{ "hostname": "web-server-01", "uptime": 3600, "platform": "linux", ... }
```

---

## 4. Step 2 — Deploy the API Gateway (`api`)

Run this step **once** on your central management server (or the same server as the frontend).

### 4.1 Install dependencies

```bash
cd api
npm install
```

### 4.2 Create the environment file

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | Secret used to sign JWT tokens. Use a long random string. Never share this. |
| `SUPERADMIN_PASSWORD` | **Yes** | Password for the built-in `superadmin` account. |
| `PORT` | No | Port to listen on (default `4000`) |
| `JWT_EXPIRES_IN` | No | Token lifetime, e.g. `8h`, `1d`, `30m` (default `8h`) |
| `UI_API_KEY` | No | Static API key for machine-to-machine access (alternative to JWT) |

### 4.3 Example `.env` file

```env
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
JWT_EXPIRES_IN=8h
SUPERADMIN_PASSWORD=SuperSecretPass123!
```

### 4.4 Start the API gateway

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm run build          # compile TypeScript → dist/
npm start
# or with PM2:
pm2 start ecosystem.config.js
pm2 save
```

### 4.5 Verify the gateway

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@1234"}'
```

Expected response:

```json
{ "token": "<JWT>", "user": { "userid": 1, "username": "admin", ... } }
```

### 4.6 Register agents in the database

Once logged in, go to **Server Config** in the UI and add your server groups and agents, providing the URL, `SERVER_KEY`, and `SERVER_NAME` that match each agent's `.env`.

---

## 5. Step 3 — Build and Serve the Frontend

The frontend is an Angular single-page application.

### 5.1 Install dependencies

```bash
cd frontend
npm install
```

### 5.2 Configure the API URL

The default API URL is `http://localhost:4000`. To point the frontend at a different gateway:

Edit [frontend/src/app/configs/config.ts](../frontend/src/app/configs/config.ts) and update the `apiUrl` field:

```typescript
export default {
  appName: 'Server Monitoring',
  ...
  apiUrl: 'https://api.yourdomain.com',  // ← change this
}
```

### 5.3 Development server

```bash
npm start        # ng serve --port 4204
```

Open [http://localhost:4204](http://localhost:4204).

### 5.4 Production build

```bash
npm run build    # output → dist/server-monitoring/browser/
```

Serve the contents of `dist/server-monitoring/browser/` with any static web server (Nginx, Apache, Caddy, etc.).

---

## 6. PM2 Reference

Each component includes an `ecosystem.config.js` for PM2 process management.

### Start all three components

```bash
# Agent (on each monitored server)
cd server-api && pm2 start ecosystem.config.js

# API Gateway
cd api && pm2 start ecosystem.config.js

# (Frontend is typically served by Nginx — see §7)

pm2 save          # persist across reboots
pm2 startup       # generate startup script
```

### Common PM2 commands

| Command | Description |
|---|---|
| `pm2 list` | Show all running processes |
| `pm2 logs <name>` | Stream logs for an app |
| `pm2 restart <name>` | Restart an app |
| `pm2 stop <name>` | Stop an app |
| `pm2 delete <name>` | Remove from PM2 |
| `pm2 monit` | Interactive dashboard |

> After changing code in `api/` you must rebuild and restart: `npx tsc && pm2 restart api`.

---

## 7. Nginx Reverse Proxy Example

Use Nginx on the management server to expose both the API gateway and the frontend on standard ports (80/443) with TLS.

```nginx
# /etc/nginx/sites-available/server-monitoring

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name monitor.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name monitor.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/monitor.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitor.yourdomain.com/privkey.pem;

    # Frontend (Angular SPA)
    root /var/www/server-monitoring;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Gateway
    location /api/ {
        proxy_pass         http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
```

Copy the Angular build output to the web root:

```bash
cp -r frontend/dist/server-monitoring/browser/* /var/www/server-monitoring/
```

If you serve the API at `/api/` instead of the root, remember to update `apiUrl` in the frontend config accordingly:

```typescript
apiUrl: 'https://monitor.yourdomain.com/api',
```

---

## 8. Post-Installation Checklist

- [ ] `SERVER_KEY` is a long, unique random string — different on every agent
- [ ] `JWT_SECRET` is a long random string and is kept private
- [ ] `SUPERADMIN_PASSWORD` is strong and changed from any default
- [ ] Default user passwords (`admin` / `user1`) have been changed via **User Management**
- [ ] `ALLOWED_IP_RANGES` is configured on each agent to only allow the API gateway IP
- [ ] TLS/HTTPS is in place for all public-facing endpoints
- [ ] PM2 is configured to restart on system boot (`pm2 save` + `pm2 startup`)
- [ ] Firewall rules block direct access to agent port 3003 from the internet
- [ ] Feature flags are explicitly set to `false` for endpoints not in use
