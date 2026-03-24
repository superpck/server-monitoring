import { PkToastrService } from './../../shares/pk-toastr/pk-toastr.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  Injector,
  computed,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, from } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { PkModal } from '../../shares/pk-modal';
import { PkTooltip } from '../../shares/pk-tooltip';


import {
  DbMetric,
  DbMetricError,
  DbMonitoringDisabled,
  DbMetricsResponse,
  DbSqlQuery,
  DbSqlEntry,
  ServerManagementService,
} from '../../services/server-management.service';
import { CommonModule } from '@angular/common';
import { ServerContextService } from '../server-management/server-context.service';
import dayjs from 'dayjs';

export const TRACKED_METRICS = [
  'Threads_connected',
  'Threads_running',
  'Connections',
  'Max_connections',
  'Questions',
  'Slow_queries',
] as const;

export type TrackedMetric = (typeof TRACKED_METRICS)[number];

const MAX_HISTORY = 360; // 15 min @ 10 s intervals

const METRIC_COLOR: Record<TrackedMetric, string> = {
  Connections: '#38bdf8',
  Questions: '#a78bfa',
  Slow_queries: '#f87171',
  Threads_connected: '#4ade80',
  Threads_running: '#fbbf24',
  Max_connections: '#f87171',
};

export interface DbServerEntry {
  key: string;
  groupid?: number;
  group: string;
  groupDetail?: string;
  detail?: string;
  baseUrl: string;
  agentid: number;
  response: DbMetricsResponse | null;
  fetchError: boolean;
}

@Component({
  selector: 'app-db-monitor',
  imports: [NgxEchartsDirective, PkModal, PkTooltip, CommonModule],
  templateUrl: './db-monitor.html',
  styleUrl: './db-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DbMonitor implements OnInit {
  private readonly service = inject(ServerManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(PkToastrService);
  private readonly injector = inject(Injector);
  private readonly serverContext = this.injector.get(ServerContextService, null);

  /** history[`serverKey::dbId`][metric] = [...numeric values] */
  private readonly history = new Map<string, Record<TrackedMetric, number[]>>();

  protected readonly trackedMetrics = TRACKED_METRICS;
  protected readonly metricColor = METRIC_COLOR;

  protected readonly allServers = signal<DbServerEntry[]>([]);

  protected readonly servers = computed(() => {
    const selected = this.serverContext?.selectedServer();
    if (selected) {
      return this.allServers().filter(s => s.agentid === selected.agentid);
    }
    return this.allServers();
  });

  protected readonly loading = signal(true);

  private autoReloadTimer: ReturnType<typeof setInterval> | null = null;
  lastProcess = signal<string | null>(null);

  constructor() {
    // Reset history when server changes
    effect(() => {
      const selected = this.serverContext?.selectedServer();
      if (selected) {
        this.resetHistoryData();
      }
    });
  }

  private resetHistoryData(): void {
    this.history.clear();
  }

  protected readonly autoReloadOptions = [0, 5, 10, 15, 20, 30, 60, 120];
  protected readonly modalOpen = signal(false);
  protected readonly modalTitle = signal('');
  protected readonly sqlLoading = signal(false);
  protected readonly sqlQueries = signal<DbSqlQuery[]>([]);
  protected readonly sqlEntry = signal<DbSqlEntry | null>(null);
  protected readonly sqlAgentid = signal<number>(0);
  protected readonly sqlDbId = signal('');
  protected readonly sqlServerKey = signal('');
  protected readonly sqlAutoReload = signal<number>(
    Number(localStorage.getItem('db-monitor:sql-auto-reload') ?? 0)
  );

  async ngOnInit(): Promise<void> {
    const config = await this.service.getConfigServer();
    this.allServers.set(
      config.flatMap(({ group, detail, agents }) =>
        agents.map((element: any) => ({
          key: element.name,
          groupid: element.groupid,
          group,
          groupDetail: detail,
          detail: element.detail,
          baseUrl: element.url,
          agentid: element.agentid,
          response: null,
          fetchError: false,
        }))
      )
    );
    const serverEntries = config.flatMap(({ group, agents }) =>
      agents.map(({ name: key, url: baseUrl, agentid, groupid }: any) => ({ key, group, baseUrl, agentid, groupid }))
    );
    interval(10000)
      .pipe(
        startWith(0),
        switchMap(() =>
          from(
            Promise.allSettled(
              serverEntries.map(({ agentid }) =>
                this.service.databaseMetrics(agentid)
              )
            )
          ).pipe(
            map(settled =>
              serverEntries.map(({ key, group, baseUrl, agentid }, i) => {
                const result = settled[i];
                const response = result.status === 'fulfilled' ? result.value : null;
                return { key, group, baseUrl, agentid, response, fetchError: response === null };
              })
            )
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((results) => {
        this.lastProcess.set(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        for (const entry of results) {
          if (!entry.response || !Array.isArray(entry.response)) continue;
          for (const db of entry.response) {
            if (db.status !== 'ok') continue;
            const histKey = `${entry.key}::${db.id}`;
            // const histKey2 = (`${entry.group}${entry?.agentid}${entry.key}${db.id}`).replace(/\s/g, '');
            // console.log(histKey, histKey2);
            if (!this.history.has(histKey)) {
              this.history.set(histKey, {
                Connections: [],
                Questions: [],
                Slow_queries: [],
                Threads_connected: [],
                Threads_running: [],
                Max_connections: [],
              });
            }
            const h = this.history.get(histKey)!;
            const statusMap = (db as DbMetric).metrics?.status ?? {};
            const connectionsMap = (db as DbMetric).metrics?.connections ?? {};
            for (const m of TRACKED_METRICS) {
              let val = 0;
              if (m == 'Max_connections') {
                val = Number(connectionsMap['max'] ?? 0);
              } else {
                val = Number(statusMap[m] ?? 0);
              }
              h[m].push(val);
              if (h[m].length > MAX_HISTORY) h[m].shift();
            }
          }
        }
        this.allServers.set(results);
        this.loading.set(false);
      });
    this.destroyRef.onDestroy(() => this.clearAutoReloadTimer());
  }

  protected isDisabled(response: DbMetricsResponse | null): response is DbMonitoringDisabled {
    return response !== null && !Array.isArray(response);
  }

  protected isDbArray(response: DbMetricsResponse | null): response is (DbMetric | DbMetricError)[] {
    return Array.isArray(response);
  }

  protected isOkDb(db: DbMetric | DbMetricError): db is DbMetric {
    return db.status === 'ok';
  }

  protected dbError(db: DbMetric | DbMetricError): string {
    return (db as DbMetricError).error ?? '';
  }

  protected formatDbUptime(raw: string | undefined): string {
    const secs = Number(raw ?? 0);
    const y = Math.floor(secs / (365 * 86400));
    const mo = Math.floor((secs % (365 * 86400)) / (30 * 86400));
    const d = Math.floor((secs % (30 * 86400)) / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (y > 0) return `${y}y ${mo}m ${d}d`;
    if (mo > 0) return `${mo}m ${d}d`;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }

  protected currentValue(serverKey: string, dbId: string, metric: TrackedMetric): number {
    const arr = this.history.get(`${serverKey}::${dbId}`)?.[metric];
    return arr && arr.length > 0 ? arr[arr.length - 1] : 0;
  }

  protected formatMetricValue(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return `${value}`;
  }

  protected modalChartOption(serverKey: string, dbId: string): EChartsOption {
    const connData = this.history.get(`${serverKey}::${dbId}`)?.['Threads_connected'] ?? [];
    const runData = this.history.get(`${serverKey}::${dbId}`)?.['Threads_running'] ?? [];
    const maxConns = this.currentValue(serverKey, dbId, 'Max_connections');
    const stackedMax = connData.reduce((acc, v, i) => Math.max(acc, v + (runData[i] ?? 0)), 0);
    const yMax = Math.max(maxConns, stackedMax, 1);
    const connColor = '#4ade80';
    const runColor = '#eab403';
    const maxColor = METRIC_COLOR['Max_connections'];
    const now = Date.now();
    const totalPoints = connData.length;
    const xLabels = connData.map((_, i) => {
      const secondsAgo = (totalPoints - 1 - i) * 10;
      const t = new Date(now - secondsAgo * 1000);
      const hh = t.getHours().toString().padStart(2, '0');
      const mm = t.getMinutes().toString().padStart(2, '0');
      const ss = t.getSeconds().toString().padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    });
    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 12, bottom: 32, containLabel: false },
      tooltip: {
        trigger: 'axis',
        confine: true,
        appendToBody: true,
        axisPointer: { type: 'line', lineStyle: { color: connColor, width: 1, type: 'dashed' } },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: connColor + '66',
        borderWidth: 1,
        padding: [5, 10],
        textStyle: { color: '#e2e8f0', fontSize: 11, fontFamily: 'ui-monospace, monospace' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number; value: number; seriesName: string; color: string }[];
          if (!list || list.length === 0) return '';
          const time = xLabels[list[0].dataIndex] ?? '';
          return `<span style="color:#94a3b8;font-size:10px">${time}</span><br/>`
            + list.map(p =>
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px"></span>`
              + `<span style="color:${p.color};font-weight:600">${p.seriesName}</span>: `
              + `<span style="font-weight:700">${this.formatMetricValue(p.value)}</span>`
            ).join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.15)' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#475569',
          fontSize: 10,
          interval: Math.floor(totalPoints / 6) || 0,
          fontFamily: 'ui-monospace, monospace',
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        // max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#475569',
          fontSize: 10,
          fontFamily: 'ui-monospace, monospace',
          formatter: (v: number) => this.formatMetricValue(v),
        },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.07)', type: 'dashed' } },
      },
      series: [
        {
          name: 'Threads_running',
          type: 'line',
          stack: 'threads',
          data: runData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: runColor, width: 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: runColor + '55' },
                { offset: 1, color: runColor + '00' },
              ],
            },
          },
        },
        {
          name: 'Threads_connected',
          type: 'line',
          stack: 'threads',
          data: connData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: connColor, width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: connColor + '55' },
                { offset: 1, color: connColor + '00' },
              ],
            },
          },
          markLine: maxConns > 0 ? {
            silent: true,
            symbol: 'none',
            data: [{ yAxis: maxConns }],
            lineStyle: { color: maxColor, type: 'dashed', width: 1.5, opacity: 0.7 },
            label: {
              formatter: `Max: ${this.formatMetricValue(maxConns)}`,
              color: maxColor,
              fontSize: 10,
              fontFamily: 'ui-monospace, monospace',
            },
          } : undefined,
        },
      ],
    };
  }

  protected sparklineOption(serverKey: string, dbId: string, metric: TrackedMetric): EChartsOption {
    const data = this.history.get(`${serverKey}::${dbId}`)?.[metric] ?? [];
    const color = METRIC_COLOR[metric];
    return {
      backgroundColor: 'transparent',
      grid: { left: 0, right: 0, top: 2, bottom: 2, containLabel: false },
      tooltip: {
        trigger: 'axis',
        confine: true,
        appendToBody: true,
        axisPointer: { type: 'line', lineStyle: { color, width: 1, type: 'dashed' } },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: color + '66',
        borderWidth: 1,
        padding: [5, 10],
        textStyle: { color: '#e2e8f0', fontSize: 11, fontFamily: 'ui-monospace, monospace' },
        formatter: (params: unknown) => {
          const list = params as { dataIndex: number; value: number }[];
          if (!list || list.length === 0) return '';
          const p = list[0];
          const totalPoints = data.length;
          const secondsAgo = (totalPoints - 1 - p.dataIndex) * 10;
          const t = new Date(Date.now() - secondsAgo * 1000);
          const hh = t.getHours().toString().padStart(2, '0');
          const mm = t.getMinutes().toString().padStart(2, '0');
          const ss = t.getSeconds().toString().padStart(2, '0');
          const timeLabel = secondsAgo === 0 ? 'now' : `${hh}:${mm}:${ss}`;
          return `<span style="color:${color};font-weight:700">${metric}</span><br/>`
            + `<span style="font-size:13px;font-weight:700">${this.formatMetricValue(p.value)}</span>`
            + ` <span style="color:#475569">(${timeLabel})</span>`;
        },
      },
      xAxis: { type: 'category', show: false, boundaryGap: false },
      yAxis: { type: 'value', show: false, scale: false, min: 0 },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          symbol: 'none',
          lineStyle: { color, width: 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + '55' },
                { offset: 1, color: color + '00' },
              ],
            },
          },
        },
      ],
    };
  }

  protected async openDbModal(serverKey: string, agentid: number, db: DbMetric | DbMetricError): Promise<void> {
    this.modalTitle.set(`${db.id} — Active Queries`);
    this.sqlServerKey.set(serverKey);
    this.sqlAgentid.set(agentid);
    this.sqlDbId.set(db.id);
    this.sqlQueries.set([]);
    this.sqlLoading.set(true);
    this.modalOpen.set(true);
    this.restartAutoReloadTimer();
    await this.getDbSql(agentid, db.id);
  }

  protected closeModal(): void {
    this.clearAutoReloadTimer();
    this.modalOpen.set(false);
  }

  protected setAutoReload(seconds: number): void {
    this.sqlAutoReload.set(seconds);
    localStorage.setItem('db-monitor:sql-auto-reload', String(seconds));
    this.restartAutoReloadTimer();
  }

  private clearAutoReloadTimer(): void {
    if (this.autoReloadTimer !== null) {
      clearInterval(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
  }

  private restartAutoReloadTimer(): void {
    this.clearAutoReloadTimer();
    const seconds = this.sqlAutoReload();
    if (this.modalOpen() && seconds > 0) {
      this.autoReloadTimer = setInterval(() => { void this.reloadSql(); }, seconds * 1000);
    }
  }

  protected async getDbSql(agentid: number, dbId: string): Promise<void> {
    this.sortColumn.set('');
    this.sortDirection.set('asc');
    try {
      const result: any = await this.service.getDatabaseSql(agentid);
      const entry = result?.find((e: any) => e.id === dbId) ?? null;
      let queries = entry?.queries ?? [];
      queries = queries.sort((a: DbSqlQuery, b: DbSqlQuery) => b.time_sec - a.time_sec);
      this.sqlEntry.set(entry);
      this.sqlQueries.set(queries);
      this.sqlLoading.set(false);
    } catch {
      this.toast.error(`Failed to fetch SQL queries for ${dbId}.`);
      this.sqlEntry.set(null);
      this.sqlQueries.set([]);
      this.sqlLoading.set(false);
      this.toast.error(`Failed to fetch SQL queries for ${dbId}.`, '');
    }
  }

  protected async reloadSql(): Promise<void> {
    if (!this.sqlAgentid() || !this.sqlDbId()) return;
    // this.sqlQueries.set([]);
    this.sqlLoading.set(true);
    await this.getDbSql(this.sqlAgentid(), this.sqlDbId());
  }

  protected truncateQuery(query: string): string {
    return query.length > 120 ? query.slice(0, 120) + '…' : query;
  }

  protected readonly sortColumn = signal('');
  protected readonly sortDirection = signal<'asc' | 'desc'>('asc');

  protected sortQueries(columnName: keyof DbSqlQuery): void {
    const queries = this.sqlQueries();

    // Toggle direction if same column
    if (this.sortColumn() === columnName) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(columnName);
      this.sortDirection.set('asc');
    }

    const direction = this.sortDirection();
    const sorted = [...queries].sort((a, b) => {
      const valA = a[columnName];
      const valB = b[columnName];

      // Handle null/undefined
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    this.sqlQueries.set(sorted);
  }
}