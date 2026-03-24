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
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, interval } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { PkModal } from '../../shares/pk-modal';
import { PkTooltip } from '../../shares/pk-tooltip';


import { DashboardSummary, NginxLogEntry, ServerManagementService } from '../../services/server-management.service';
import { ServerContextService } from '../server-management/server-context.service';

export interface ServerEntry {
  key: string;
  groupid?: number;
  group: string;
  groupDetail?: string;
  detail?: string;
  baseUrl: string;
  agentid: number;
  data: DashboardSummary | null;
  error: boolean;
}

@Component({
  selector: 'app-server-monitor',
  imports: [NgxEchartsDirective, DatePipe, PkModal, PkTooltip],
  templateUrl: './server-monitor.html',
  styleUrl: './server-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerMonitor implements OnInit {
  private readonly service = inject(ServerManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly serverContext = this.injector.get(ServerContextService, null);

  protected readonly allServers = signal<ServerEntry[]>([]);
  
  protected readonly servers = computed(() => {
    const selected = this.serverContext?.selectedServer();
    if (selected) {
      return this.allServers().filter(s => s.agentid === selected.agentid);
    }
    return this.allServers();
  });
  
  protected readonly loading = signal(true);

  protected readonly nginxModalOpen = signal(false);
  protected readonly nginxModalTitle = signal('');
  protected readonly nginxLoading = signal(false);
  protected readonly nginxAccessLogs = signal<NginxLogEntry[]>([]);
  protected readonly nginxErrorLogs = signal<NginxLogEntry[]>([]);
  protected readonly nginxLogTab = signal<'access' | 'error'>('error');
  protected readonly nginxLogs = computed(() =>
    this.nginxLogTab() === 'access' ? this.nginxAccessLogs() : this.nginxErrorLogs()
  );
  protected readonly nginxAgentid = signal<number>(0);

  constructor() {
    // Reset modal data when server changes
    effect(() => {
      const selected = this.serverContext?.selectedServer();
      if (selected) {
        this.resetModalData();
      }
    });
  }

  private resetModalData(): void {
    this.nginxModalOpen.set(false);
    this.nginxAccessLogs.set([]);
    this.nginxErrorLogs.set([]);
  }

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
          data: null,
          error: false,
        }))
      )
    );
    const serverEntries = config.flatMap(({ group, agents }) =>
      agents.map(({ name: key, url: baseUrl, agentid, groupid }) => ({ key, group, baseUrl, agentid, groupid }))
    );
    interval(5000)
      .pipe(
        startWith(0),
        switchMap(() =>
          from(
            Promise.allSettled(
              serverEntries.map(({ key, group, baseUrl, agentid }) =>
                this.service.getDashboardSummary(agentid).then(data => ({ key, group, baseUrl, agentid, data, error: data === null }))
            )
          )
        ).pipe(
            map(settled =>
              serverEntries.map(({ key, group, baseUrl, agentid }, i) => {
                const result = settled[i];
                return result.status === 'fulfilled'
                  ? result.value
                  : { key, group, baseUrl, agentid, data: null, error: true };
              })
            )
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((results) => {
        this.allServers.set(results);
        this.loading.set(false);
      });
  }

  protected async openNginxLog(key: string, agentid: number): Promise<void> {
    this.nginxModalTitle.set(`${key} — Nginx Log`);
    this.nginxAgentid.set(agentid);
    this.nginxAccessLogs.set([]);
    this.nginxErrorLogs.set([]);
    this.nginxLoading.set(true);
    this.nginxModalOpen.set(true);
    await this.loadNginxLog(agentid);
  }

  protected async reloadNginxLog(): Promise<void> {
    if (!this.nginxAgentid()) return;
    this.nginxAccessLogs.set([]);
    this.nginxErrorLogs.set([]);
    this.nginxLoading.set(true);
    await this.loadNginxLog(this.nginxAgentid());
  }

  private async loadNginxLog(agentid: number): Promise<void> {
    const [access, error] = await Promise.allSettled([
      this.service.getNginxLog(agentid, 'access'),
      this.service.getNginxLog(agentid, 'error'),
    ]);
    this.nginxAccessLogs.set(access.status === 'fulfilled' ? access.value ?? [] : []);
    this.nginxErrorLogs.set(error.status === 'fulfilled' ? error.value ?? [] : []);
    this.nginxLoading.set(false);
  }

  protected gaugeOption(value: number): EChartsOption {
    const v = Math.max(0, Math.min(100, value));
    const color = v >= 90 ? '#ef4444' : v >= 80 ? '#f59e0b' : v >= 70 ? '#00b3ff' : '#22c55e';
    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          radius: '90%',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: { show: true, width: 10 },
          axisLine: {
            lineStyle: { width: 10, color: [[1, 'rgba(148,163,184,0.15)']] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 16,
            fontWeight: 'bolder',
            color,
            formatter: '{value}%',
            offsetCenter: [0, '20%'],
          },
          itemStyle: { color },
          data: [{ value: +v.toFixed(1) }],
        },
      ],
    };
  }

  protected loadBarOption(load: DashboardSummary['load']): EChartsOption {
    return {
      backgroundColor: 'transparent',
      grid: { left: 30, right: 36, top: 5, bottom: 18 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(100,116,139,0.12)' } },
      },
      yAxis: {
        type: 'category',
        data: ['15m', '5m', '1m'],
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 12,
          data: [load.load15, load.load5, load.load1],
          itemStyle: { color: '#38bdf8', borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: '#94a3b8',
            fontSize: 10,
            formatter: (p: { value: unknown }) => Number(p.value).toFixed(2),
          },
        },
      ],
    };
  }

  protected formatBytes(bytes: number): string {
    if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(2)} TB`;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  protected formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
}
