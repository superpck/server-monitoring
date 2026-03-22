import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, of, timeout } from 'rxjs';
import { ServerConfigService, ServerConfigGroup } from './server-config.service';
import config from '../configs/config';

export interface DbMetric {
  id: string;
  key?: string;
  vendor?: string;
  host?: string;
  port?: number;
  metrics?: {
    version: string;
    status: Record<string, string>;
    connections?: Record<string, string>;
  };
  status: 'ok';
}

export interface DbMetricError {
  id: string;
  vendor: string;
  host: string;
  port: number;
  status: 'error';
  error: string;
}

export interface DbMonitoringDisabled {
  error: string;
}

export type DbMetricsResponse = (DbMetric | DbMetricError)[] | DbMonitoringDisabled;

export interface DbSqlQuery {
  id: number;
  user: string;
  host: string;
  db: string;
  command: string;
  time_sec: number;
  state: string;
  query: string;
}

export interface DbSqlEntry {
  id: string;
  vendor: string;
  host: string;
  port: number;
  queries: DbSqlQuery[];
  status: string;
}

export interface NginxLogEntry {
  datetime: string;
  level: string;
  pid: string;
  message: string;
  client: string;
  request: string;
  host: string;
}

export interface NginxStatusInfo {
  active: string;      // e.g., "active (running)"
  since: string;       // start time
  mainPid: string;     // master process PID
  memory: string;      // memory usage
  cpu: string;         // CPU time
  workers: number;     // number of worker processes
}

export interface NginxStatusResponse {
  success: boolean;
  status?: string;     // raw systemd status output
  message?: string;
  error?: string;
}

export interface NginxLogResponse {
  success: boolean;
  log?: string;
  message?: string;
  status?: number;
}

export interface SecureSource {
  id: string;
  label: string;
  available: boolean;
  file?: string;
  note?: string;
}

export interface SecureSourcesResponse {
  success: boolean;
  platform: string;
  sources: SecureSource[];
  message?: string;
}

export interface SecureLogResponse {
  success: boolean;
  source: string;
  label: string;
  log: string;
  message?: string;
}

export interface SystemOverviewResponse {
  success: boolean;
  collectedAt: string;
  host: {
    hostname: string;
    platform: string;
    arch: string;
    uname: string;
    timezone: string;
    uptime: string;
  };
  hardware: {
    manufacturer: string;
    model: string;
    serial: string;
    cpu: string;
    memTotalMB: number;
  };
  date: { iso: string; local: string; epochMs: number };
  sessions: { w: string; who: string; siUsers: any[] };
  logins: { last: string };
  network: { interfaces: any; dns: string; ports: string };
  services: { running: string; failed: string };
  crontab: string;
  environment: { nodeVersion: string; nodePath: string; pid: number; cwd: string; user: string };
  message?: string;
}

export interface Pm2Process {
  id: number;
  name: string;
  status: 'online' | 'stopping' | 'stopped' | 'launching' | 'errored';
  pid: number;
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
  unstable_restarts: number;
  created_at: number;
  watch: boolean;
  exec_mode: string;
}

export interface Pm2Response {
  success: boolean;
  processes: Pm2Process[];
}

export interface DashboardSummary {
  success: boolean;
  server: {
    agentId: string | null;
    hostname: string;
    serverName: string;
    platform: string;
    release: string;
    uptimeSeconds: number;
    bootTime: number;
    manufacturer: string;
    model: string;
    version: string;
  };
  status: { health: string; updatedAt: string };
  cpu: { usage: number; cores: number };
  load: { load1: number; load5: number; load15: number; loadPercent1m: number };
  memory: { total: number; used: number; free: number; available: number; usagePercent: number };
  disk: { fs: string; mount: string; type: string; size: number; used: number; available: number; usagePercent: number };
  network: { iface: string; rxBytes: number; txBytes: number; rxSec: number | null; txSec: number | null };
  process: { all: number; running: number; blocked: number; sleeping: number };
}

@Injectable({ providedIn: 'root' })
export class ServerManagementService {
  private readonly http = inject(HttpClient);
  private readonly serverConfig = inject(ServerConfigService);

  getConfigServer(): Promise<ServerConfigGroup[]> {
    return this.serverConfig.getAll();
  }

  getDashboardSummary(agentid: number): Promise<DashboardSummary | null> {
    return firstValueFrom(
      this.http
        .get<DashboardSummary>(`${config.apiUrl}/proxy/${agentid}/dashboard/summary`)
        .pipe(catchError((err) => of(null)))
    );
  }

  async dashboardSummary(agentid: number): Promise<any | null> {
    try {
      const result: any = await firstValueFrom(
        this.http.get<DashboardSummary>(`${config.apiUrl}/proxy/${agentid}/dashboard/summary`)
      );
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error?.error || error,
        message: error?.error?.message || error.message || 'Unknown error',
        status: error?.error?.status || error.status || '500',
      };
    }
  }

  async getNginxLog(agentid: number, type: 'access' | 'error' = 'error'): Promise<NginxLogEntry[] | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<NginxLogResponse>(`${config.apiUrl}/proxy/${agentid}/nginx/log`, { params: { type } }).pipe(timeout(10000))
      );
      const log: any = res?.log || null;
      if (!log) return null;
      return type === 'access' ? this.parseNginxAccessLog(log) : this.parseNginxLog(log);
    } catch {
      return null;
    }
  }

  private parseNginxAccessLog(raw: string): NginxLogEntry[] {
    // Standard combined log: $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
    const lineRegex = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*?)"\s+(\d+)\s+(\S+)/gm;
    const entries: NginxLogEntry[] = [];
    let match: RegExpExecArray | null;
    while ((match = lineRegex.exec(raw)) !== null) {
      const [, client, datetime, request, statusStr, bytes] = match;
      const status = parseInt(statusStr, 10);
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      entries.push({
        datetime,
        level,
        pid: '-',
        message: `${statusStr}  ${bytes === '-' ? '0' : bytes} bytes`,
        client,
        request,
        host: '-',
      });
    }
    return entries.reverse();
  }

  private parseNginxLog(raw: string): NginxLogEntry[] {
    const lineRegex = /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (\S+): (.*)/g;
    const entries: NginxLogEntry[] = [];
    let match: RegExpExecArray | null;
    while ((match = lineRegex.exec(raw)) !== null) {
      const [, datetime, level, pid, rest] = match;
      const clientMatch = rest.match(/client:\s*([^,]+)/);
      const requestMatch = rest.match(/request:\s*"([^"]+)"/);
      const hostMatch = rest.match(/host:\s*"([^"]+)"/);
      entries.push({
        datetime,
        level,
        pid,
        message: rest.split(',')[0].trim(),
        client: clientMatch?.[1]?.trim() ?? '',
        request: requestMatch?.[1]?.trim() ?? '',
        host: hostMatch?.[1]?.trim() ?? '',
      });
    }
    return entries.reverse();
  }

  async getDatabaseSql(agentid: number): Promise<DbSqlEntry[] | null> {
    try {
      return await firstValueFrom(
        this.http.get<DbSqlEntry[]>(`${config.apiUrl}/proxy/${agentid}/database/sql`).pipe(timeout(8000))
      );
    } catch {
      return null;
    }
  }

  async databaseMetrics(agentid: number): Promise<any> {
    try {
      const result: DbMetricsResponse = await firstValueFrom(this.http
        .get<DbMetricsResponse>(`${config.apiUrl}/proxy/${agentid}/database/metrics`));
      return result;
    } catch (error: any) {
      return error.error ?? error;
    }
  }

  async getPm2Processes(agentid: number): Promise<Pm2Response | null> {
    try {
      return await firstValueFrom(
        this.http
          .get<Pm2Response>(`${config.apiUrl}/proxy/${agentid}/monitor/pm2`)
          .pipe(timeout(10000), catchError(() => of(null)))
      );
    } catch {
      return null;
    }
  }

  async getNginxStatus(agentid: number): Promise<NginxStatusResponse | null> {
    try {
      return await firstValueFrom(
        this.http
          .get<NginxStatusResponse>(`${config.apiUrl}/proxy/${agentid}/nginx/status`)
          .pipe(timeout(10000), catchError(() => of(null)))
      );
    } catch {
      return null;
    }
  }
  parseNginxStatus(statusText: string): NginxStatusInfo | null {
    try {
      const info: NginxStatusInfo = {
        active: '',
        since: '',
        mainPid: '',
        memory: '',
        cpu: '',
        workers: 0,
      };

      // Extract Active status
      const activeMatch = statusText.match(/Active: ([^\n]+)/);
      if (activeMatch) {
        const activeLine = activeMatch[1];
        const statusMatch = activeLine.match(/^(\w+ \([^)]+\))/);
        if (statusMatch) info.active = statusMatch[1];
        const sinceMatch = activeLine.match(/since ([^;]+)/);
        if (sinceMatch) info.since = sinceMatch[1].trim();
      }

      // Extract Main PID
      const pidMatch = statusText.match(/Main PID: (\d+)/);
      if (pidMatch) info.mainPid = pidMatch[1];

      // Extract Memory
      const memoryMatch = statusText.match(/Memory: ([^\n]+)/);
      if (memoryMatch) info.memory = memoryMatch[1].trim();

      // Extract CPU
      const cpuMatch = statusText.match(/CPU: ([^\n]+)/);
      if (cpuMatch) info.cpu = cpuMatch[1].trim();

      // Count worker processes
      const workerMatches = statusText.match(/nginx: worker process/g);
      info.workers = workerMatches ? workerMatches.length : 0;

      return info;
    } catch (error) {
      console.error('Error parsing nginx status:', error);
      return null;
    }
  }

  getDatabaseMetrics(baseUrl: string): Observable<DbMetricsResponse | null> {
    return this.http
      .get<DbMetricsResponse>(`${baseUrl}/database/metrics`)
      .pipe(
        timeout(8000),
        catchError((err) => {
          const httpErr = err instanceof HttpErrorResponse ? err : null;
          let body = httpErr?.error ?? null;
          if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { /* not JSON */ }
          }
          if (body && typeof body === 'object' && 'error' in body) {
            return of(body as DbMonitoringDisabled);
          }
          return of(null);
        })
      );
  }

  async getSecureSources(agentid: number): Promise<SecureSourcesResponse | null> {
    try {
      return await firstValueFrom(
        this.http.get<SecureSourcesResponse>(`${config.apiUrl}/proxy/${agentid}/secure/sources`).pipe(timeout(8000), catchError(() => of(null)))
      );
    } catch { return null; }
  }

  async getSecureLog(agentid: number, source: string, n = 100): Promise<SecureLogResponse | null> {
    try {
      return await firstValueFrom(
        this.http.get<SecureLogResponse>(`${config.apiUrl}/proxy/${agentid}/secure/log`, { params: { source, n } }).pipe(timeout(15000), catchError(() => of(null)))
      );
    } catch { return null; }
  }

  async getSystemOverview(agentid: number): Promise<SystemOverviewResponse | null> {
    try {
      return await firstValueFrom(
        this.http.get<SystemOverviewResponse>(`${config.apiUrl}/proxy/${agentid}/system/overview`).pipe(timeout(15000), catchError(() => of(null)))
      );
    } catch { return null; }
  }
}
