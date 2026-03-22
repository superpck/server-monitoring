# server-api

Agent API that runs on each target server. Collects and exposes server metrics to the central management API (`api/`).

---

## Installation

```bash
npm install
cp .env.example .env   # edit values as needed
npm run dev            # development (nodemon)
npm start              # production (pm2 or node dist/server.js)
```

---

## Environment Variables (`.env`)

### Authentication / Security

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3003` | Port the server listens on |
| `SERVER_KEY` | *(random)* | Secret key — clients must send matching `X-Server-Key` header |
| `SERVER_NAME` | *(random)* | Server name — clients must send matching `X-Server-Name` header |
| `ALLOWED_IP_RANGES` | *(empty = all IPs)* | Comma-separated CIDR list, e.g. `10.0.0.0/8,192.168.100.1/32` |

### Feature Flags

| Variable | Default | Description |
|---|---|---|
| `SYSTEM_OVERVIEW_ENABLED` | `false` | Enable `GET /system/overview` |
| `SECURE_LOG_ENABLED` | `false` | Enable `GET /secure/*` (auth/audit log) |
| `NGINX_LOG_ENABLED` | `false` | Enable `GET /nginx/log` and `GET /nginx/log/stream` |

### Nginx Log Paths (when `NGINX_LOG_ENABLED=true`)

| Variable | Default |
|---|---|
| `NGINX_ACCESS_LOG` | `/var/log/nginx/access.log` |
| `NGINX_ERROR_LOG` | `/var/log/nginx/error.log` |
| `NGINX_CHECK_URL` | `http://localhost/` |

### Database Monitor (when `DB_MONITOR_ENABLED=true`)

| Variable | Description |
|---|---|
| `DB_MONITOR_ENABLED` | Set to `true` to enable `/database/*` |
| `DB_<ID>_VENDOR` | `mysql` / `mariadb` / `percona` / `pgsql` / `mssql` |
| `DB_<ID>_HOST` | hostname / IP |
| `DB_<ID>_PORT` | port |
| `DB_<ID>_USER` | username |
| `DB_<ID>_PASSWORD` | password |
| `DB_<ID>_NAME` | database name |

### Secure Log Lines

| Variable | Default | Description |
|---|---|---|
| `SECURE_LOG_LINES` | `100` | Maximum number of lines to return (1–500) |

---

## API Endpoints

Required headers for every request (when `SERVER_KEY` is set):

```
X-Server-Key:  <SERVER_KEY>
X-Server-Name: <SERVER_NAME>
```

---

### Dashboard · `/dashboard`

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | Server overview (CPU, Memory, Disk, Load, Network, Processes) |

---

### System · `/system`

| Method | Path | Description |
|---|---|---|
| GET | `/system/health` | hostname, uptime, platform, time |
| GET | `/system/identity` | agentId, fingerprint, hostname, platform |
| GET | `/system/metrics` | CPU %, Memory %, Disk % |
| GET | `/system/cpu` | CPU load details |
| GET | `/system/memory` | Memory details |
| GET | `/system/disk` | Disk details |
| GET | `/system/load` | Load average 1/5/15 min |
| GET | `/system/overview` | ⚠️ Requires `SYSTEM_OVERVIEW_ENABLED=true` — uname, who, w, last logins, open ports, services, crontab, DNS |

---

### Monitor · `/monitor`

| Method | Path | Description |
|---|---|---|
| GET | `/monitor/pm2` | All PM2 processes |
| GET | `/monitor/network` | Network stats (rx/tx bytes/sec) |
| GET | `/monitor/docker` | Docker container list |
| GET | `/monitor/process` | All running processes |

---

### Nginx · `/nginx`

| Method | Path | Query | Description |
|---|---|---|---|
| GET | `/nginx/status` | — | Nginx status (systemctl or Docker mode) |
| GET | `/nginx/log` | `type=access\|error`, `n=50` | ⚠️ Requires `NGINX_LOG_ENABLED=true` — log snapshot |
| GET | `/nginx/log/stream` | `type=access\|error`, `n=50` | ⚠️ SSE real-time log stream |

---

### Logs · `/logs`

| Method | Path | Query | Description |
|---|---|---|---|
| GET | `/logs/service` | `name=nginx`, `lines=50` | journalctl log for a service |
| GET | `/logs/file` | `path=/var/log/...` | Tail a log file by path |

---

### Database · `/database`

> Requires `DB_MONITOR_ENABLED=true`

| Method | Path | Description |
|---|---|---|
| GET | `/database/status` | Ping all DB instances — up/down + latency |
| GET | `/database/metrics` | Metrics (connections, queries, cache hit, etc.) |
| GET | `/database/sql` | Active/recent SQL queries |

---

### Secure Log · `/secure`

> Requires `SECURE_LOG_ENABLED=true`

| Method | Path | Query | Description |
|---|---|---|---|
| GET | `/secure/sources` | — | Available log sources on this platform with availability status |
| GET | `/secure/log` | `source=auth`, `n=100` | Read log from the specified source |

#### Log Sources by Platform

| Platform | ID | File / Command |
|---|---|---|
| RHEL / CentOS / Rocky | `auth` | `/var/log/secure` |
| RHEL / CentOS / Rocky | `messages` | `/var/log/messages` |
| RHEL / CentOS / Rocky | `audit` | `/var/log/audit/audit.log` |
| Debian / Ubuntu | `auth` | `/var/log/auth.log` |
| Debian / Ubuntu | `syslog` | `/var/log/syslog` |
| Debian / Ubuntu | `kern` | `/var/log/kern.log` |
| macOS | `auth` | `log show` (Unified Log, security subsystem) |
| macOS | `system` | `log show` (all, last 1h) |
| macOS | `system-file` | `/var/log/system.log` (macOS ≤ 11) |
| Windows | `security` | `wevtutil qe Security` |
| Windows | `system` | `wevtutil qe System` |

---

## curl Examples

```bash
BASE=http://localhost:3003
KEY=your-server-key
NAME=your-server-name

# Health check (no auth required)
curl $BASE/system/health

# Dashboard summary
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" $BASE/dashboard/summary

# System overview (requires SYSTEM_OVERVIEW_ENABLED=true)
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" $BASE/system/overview

# PM2 processes
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" $BASE/monitor/pm2

# Nginx status
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" $BASE/nginx/status

# Nginx error log (requires NGINX_LOG_ENABLED=true)
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" "$BASE/nginx/log?type=error&n=100"

# journalctl log for nginx
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" "$BASE/logs/service?name=nginx&lines=50"

# Secure log sources (requires SECURE_LOG_ENABLED=true)
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" $BASE/secure/sources

# Auth log — last 50 lines
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" "$BASE/secure/log?source=auth&n=50"

# Database status (ต้องเปิด DB_MONITOR_ENABLED=true)
curl -H "X-Server-Key: $KEY" -H "X-Server-Name: $NAME" $BASE/database/status
```
