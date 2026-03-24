# Frontend — Server Monitoring UI

Angular web application for monitoring server metrics via the API Gateway.

---

## Tech Stack

| Item | Details |
|------|---------|
| Framework | Angular 21 (standalone components) |
| Styling | CSS custom properties + Tailwind CSS 4 |
| State | Signals — `signal()`, `computed()`, `effect()`, `model()` |
| HTTP | `HttpClient` + `firstValueFrom()` |
| Charts | ngx-echarts (ECharts 6) |
| Date | dayjs |
| Auth | JWT → `sessionStorage`, role-based access control |
| Change Detection | `ChangeDetectionStrategy.OnPush` on every component |

---

## Folder Structure

```
src/app/
  configs/
    config.ts                    ← appName, apiUrl, tokenName, version
  guards/
    auth.guard.ts                ← redirect → /login when token missing/expired
    admin.guard.ts               ← redirect → /404 if not admin
    guest.guard.ts               ← redirect → /server-management if already logged in
    user-admin.guard.ts          ← redirect → /404 if not user-admin
  services/
    auth.service.ts              ← JWT decode, role signals, expiry watch
    auth.interceptor.ts          ← injects Authorization header on all requests
    login.service.ts             ← POST /auth/login, token storage
    server-config.service.ts     ← server agents & groups CRUD
    server-management.service.ts ← proxy calls: metrics, DB, nginx, PM2
    user-management.service.ts   ← user CRUD (admin)
    theme.service.ts             ← dark / light toggle → localStorage
  components/
    layout/                      ← shell: navbar, sidebar, user dropdown, theme toggle
    login/                       ← sign-in form
    alive/                       ← server availability tree (auto-refresh 10 s)
    server-monitor/              ← CPU, Memory, Disk, Network real-time charts
    overview-monitor/            ← system overview dashboard
    db-monitor/                  ← database metrics & slow-query viewer
    pm2-monitor/                 ← PM2 process list & controls
    nginx-monitor/               ← Nginx status & error logs
    secure-monitor/              ← SSL / security status
    server-management/           ← server selector, side-by-side monitoring
    server-config/               ← manage server agents & groups (admin)
    user-management/             ← user CRUD (user-admin)
    about/                       ← version info
    page-not-found/              ← 404 page
    pk-ui-demo/                  ← PK UI component showcase (route /pk-ui)
  shares/
    pk-icon/       ← SVG icon registry — <pk-icon name="..." [size]="N" />
    pk-tooltip/    ← Tooltip directive — [pkTooltip]="text" pkTooltipPosition="top|bottom|left|right"
    pk-modal/      ← Modal — <pk-modal title="..." [isOpen]="..." (closed)="...">
    pk-toastr/     ← Toast notifications via PkToastrService
    pk-alert/      ← Alert/confirm/input dialogs via PkAlertService (Promise-based)
    pk-tabs/       ← Tabs — <pk-tabs [tabs]="..." [(activeId)]="..." variant="line|pill">
    pk-ui.scss     ← Shared stylesheet for all PK UI components
```

---

## Routes

| Route | Component | Guard(s) | Description |
|-------|-----------|----------|-------------|
| `/login` | `Login` | `guestGuard` | Authentication entry point |
| `/` | redirect → `/server-management` | `authGuard` | Default authenticated route |
| `/server-management` | `ServerManagement` | `authGuard` | Server selector & side-by-side monitoring |
| `/monitor` | `ServerMonitor` | `authGuard` | Real-time CPU, Memory, Disk, Network charts |
| `/alive` | `Alive` | `authGuard` | Server uptime & availability tree |
| `/db-monitor` | `DbMonitor` | `authGuard` | Database performance metrics & slow queries |
| `/nginx-monitor` | `NginxMonitor` | `authGuard` | Nginx status & log viewer |
| `/pm2-monitor` | `Pm2Monitor` | `authGuard` | PM2 process list |
| `/server-config` | `ServerConfig` | `authGuard` + `adminGuard` | Server agents & groups (admin only) |
| `/user-management` | `UserManagement` | `authGuard` + `userAdminGuard` | User CRUD (user-admin only) |
| `/about` | `About` | `authGuard` | Version & app info |
| `/pk-ui` | `PkUiDemo` | `authGuard` | PK UI component showcase |
| `/404` | `PageNotFound` | — | 404 error page |

---

## PK UI Shared Components

All reusable UI components live in `src/app/shares/`. Import from their `index.ts`.

### pk-icon
```html
<pk-icon name="check" />
<pk-icon name="trash" [size]="20" [strokeWidth]="1.5" />
```

### pk-tooltip
```html
<button [pkTooltip]="'Save'" pkTooltipPosition="top">Save</button>
<span [pkTooltip]="'Info'" [pkTooltipDelay]="500">Hover</span>
```

### pk-modal
```html
<pk-modal title="Confirm" [isOpen]="open()" size="md" (closed)="open.set(false)">
  <p>Content here</p>
</pk-modal>
```

### pk-toastr
```ts
private readonly toastr = inject(PkToastrService);
this.toastr.success('Saved!');
this.toastr.error('Failed.', 'Error', 5000);
```
Requires `<pk-toastr />` in the root shell (`app.html`).

### pk-alert
```ts
private readonly alert = inject(PkAlertService);
await this.alert.success('Done!');
const ok = await this.alert.confirm('Are you sure?', { confirmText: 'Yes' });
const val = await this.alert.input('Enter name:', { placeholder: 'Name...' });
```
Requires `<pk-alert />` in the root shell (`app.html`).

### pk-tabs
```html
<pk-tabs [tabs]="tabs" [(activeId)]="activeTab" variant="line">
  <div *pkTabPanel="'overview'">Overview content</div>
  <div *pkTabPanel="'details'">Details content</div>
</pk-tabs>
```
```ts
tabs: PkTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'details',  label: 'Details'  },
  { id: 'logs',     label: 'Logs', disabled: true },
];
activeTab = signal('overview');
```

---

## Configuration

Edit `src/app/configs/config.ts`:

```ts
export default {
  appName: 'Server Monitoring',
  version: '...',           // synced from package.json
  subVersion: '...',
  tokenName: 'server-monitoring-token',  // sessionStorage key for JWT
  apiUrl: 'http://localhost:4000',       // API Gateway URL
}
```

---

## Development

```bash
cd frontend
npm install
npm start          # ng serve --port 4204 -o
```

Open browser: `http://localhost:4204`

**Production build:**
```bash
npm run build      # output → dist/  (--base-href ./ --output-hashing none)
```

---

## Auth Flow

```
User fills login form
    ↓
LoginService.login(username, password)  →  POST {apiUrl}/auth/login
API Gateway validates credentials       →  returns signed JWT
    ↓
JWT stored in sessionStorage
AuthService decodes payload: { sub, role, user_admin, name, exp }
    ↓
authGuard checks token validity before every route
adminGuard / userAdminGuard enforce role-based access
AuthInterceptor injects Authorization: Bearer <token> on all HTTP requests
```

**Role signals (AuthService):**
- `isAdmin()` — `role === 'admin'`
- `isUserAdmin()` — `user_admin === true`
- `displayName()` — `name ?? sub`

---

## Theme

Dark / light mode via `ThemeService`. Toggle in the navbar.  
Sets `data-theme="light"` on `<html>` and persists to `localStorage`.  
All colors defined as CSS custom properties in `src/styles.css`.
