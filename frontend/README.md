# Frontend — Server Monitoring UI

Angular web application for monitoring server metrics via the API Gateway.

---

## Tech Stack

| Item | Details |
|------|---------|
| Framework | Angular (Standalone components) |
| Styling | CSS custom properties + Tailwind CSS |
| State | Signals — `signal()`, `computed()`, `effect()` |
| HTTP | `HttpClient` + `firstValueFrom()` |
| Charts | ngx-echarts |
| Auth | JWT via `LoginService` → `sessionStorage` |
| Change Detection | `ChangeDetectionStrategy.OnPush` on every component |

---

## Folder Structure

```
src/app/
  configs/
    config.ts           ← appName, apiUrl, tokenName, version
  guards/
    auth.guard.ts       ← redirect → /login when no token
    guest.guard.ts      ← redirect → /monitor when already logged in
  services/
    login.service.ts        ← POST /auth/login, stores JWT
    server-management.service.ts  ← getConfigServer(), proxy calls
    theme.service.ts        ← dark / light toggle
  components/
    login/              ← login page (glassy dark UI)
    layout/             ← shell layout + sidebar + theme toggle
    alive/              ← tree view of online/offline status
    server-monitor/     ← CPU, Memory, Disk, Network charts
    db-monitor/         ← Database metrics
    pm2-monitor/        ← PM2 process list
    nginx-monitor/      ← Nginx status & logs
    server-management/  ← server selector + side-by-side view
    about/              ← system info
    page-not-found/
  shares/
    pk-icon/            ← Reusable SVG icon component (15 icons)
    pk-alert/           ← Alert component
    pk-modal/           ← Modal component
    pk-toastr/          ← Toast notification
    pk-tooltip/         ← Tooltip directive
```

---

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `Login` | Sign in with admin password via the API Gateway |
| `/monitor` | `ServerMonitor` | CPU, Memory, Disk, Network charts |
| `/alive` | `Alive` | Tree view of all agent statuses (auto-refresh every 10s) |
| `/db` | `DbMonitor` | Database connections & queries |
| `/pm2` | `Pm2Monitor` | PM2 process manager |
| `/nginx` | `NginxMonitor` | Nginx status & error logs |
| `/management` | `ServerManagement` | Side-by-side multi-server view |
| `/about` | `About` | Version info and server groups |

---

## Configuration

Edit `src/app/configs/config.ts`:

```ts
export default {
  appName: 'Server Management',
  version: '1.0.0',
  subVersion: '2026.-3.11-1',
  tokenName: 'server-management-token',
  apiUrl: 'http://localhost:4000',   // ← URL of the API Gateway
}
```

Server groups are configured in `ServerManagementService.getConfigServer()` in
`src/app/services/server-management.service.ts`.

---

## Getting Started

```bash
cd frontend
npm install
npm start          # ng serve --port 4204
```

Open browser: `http://localhost:4204`

**Production build:**
```bash
npm run build      # output → dist/
```

---

## Auth Flow

```
User fills login form
    ↓
LoginService.login(username, password)
    ↓  POST {apiUrl}/auth/login
API Gateway validates → returns JWT
    ↓
JWT stored in sessionStorage
    ↓
AuthGuard checks token before every route
```

---

## Theme

Supports dark / light mode via `ThemeService`.  
Toggle button in the navbar — sets `data-theme="light"` on `:root`.  
All colors are defined via CSS custom properties in `src/styles.css`.

---

## Credits

Built with [Angular](https://angular.dev) · [ngx-echarts](https://github.com/xieziyu/ngx-echarts) · [Tailwind CSS](https://tailwindcss.com)

Code assisted by **GitHub Copilot** (Claude Sonnet) — architecture design, component implementation, security middleware, CSS theming, and documentation.
