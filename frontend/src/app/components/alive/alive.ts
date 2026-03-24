import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs';
import { from } from 'rxjs';

import { DashboardSummary, ServerManagementService } from '../../services/server-management.service';
import { PkModal } from '../../shares/pk-modal';
import { PkIcon } from '../../shares/pk-icon';
import dayjs from 'dayjs';
import { PkTooltip } from '../../shares/pk-tooltip';

export interface AliveAgent {
  key: string;
  group: string;
  detail?: string;
  baseUrl: string;
  alive: DashboardSummary | null;
  loading: boolean;
  error: string | null;
}

export interface AliveGroup {
  group: string;
  detail: string;
  agents: AliveAgent[];
}

@Component({
  selector: 'app-alive',
  imports: [CommonModule, PkModal, DecimalPipe, PkIcon, PkTooltip],
  templateUrl: './alive.html',
  styleUrl: './alive.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alive implements OnInit {
  private readonly service = inject(ServerManagementService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly groups = signal<AliveGroup[]>([]);

  protected readonly layout = signal<'horizontal' | 'vertical'>(
    (localStorage.getItem('alive:layout') as 'horizontal' | 'vertical') ?? 'horizontal'
  );

  protected setLayout(value: 'horizontal' | 'vertical'): void {
    this.layout.set(value);
    localStorage.setItem('alive:layout', value);
  }

  protected readonly modalOpen = signal(false);
  protected readonly modalAgent = signal<AliveAgent | null>(null);
  lastProcess = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    let config = await this.service.getConfigServer();
    config = config.filter(c => c.agents && c.agents.length > 0);
    this.groups.set(
      config.map(({ group, detail, agents }) => ({
        group,
        detail,
        agents: agents.map(({ name: key, detail, url: baseUrl }) => ({
          key,
          group,
          detail,
          baseUrl,
          alive: null,
          loading: true,
          error: null,
        })),
      }))
    );
    const flat = config.flatMap(({ group, agents }) =>
      agents.map(({ name: key, agentid }) => ({ key, group, agentid }))
    );

    interval(10000)
      .pipe(
        startWith(0),
        switchMap(() =>
          from(
            Promise.allSettled(
              flat.map(({ agentid }) => this.service.dashboardSummary(agentid))
            )
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settled => {
        this.lastProcess.set(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        let flatIdx = 0;

        this.groups.update(groups =>
          groups.map(g => ({
            ...g,
            agents: g.agents.map(agent => {
              const result = settled[flatIdx++];
              const value = result.status === 'fulfilled' ? result.value : null;
              const alive = value?.success !== false ? (value as DashboardSummary | null) : null;
              const is404 = value?.status === 404 || value?.status === '404';
              const error = value?.success === false ? (is404 ? 'Not found' : (value.message ?? 'Error')) : null;
              return { ...agent, alive, loading: false, error };
            }),
          }))
        );
      });
  }

  protected openModal(agent: AliveAgent): void {
    this.modalAgent.set(agent);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  /** Returns CSS class based on percentage value */
  protected metricClass(value: number | null | undefined): string {
    if (value == null) return 'metric--null';
    if (value >= 90) return 'metric--red blink-smooth';
    if (value >= 80) return 'metric--yellow';
    if (value >= 70) return 'metric--sky';
    return 'metric--green';
  }

  /** Overall status dot color for a node card */
  protected statusClass(agent: AliveAgent): string {
    if (agent.loading) return 'status--loading';
    if (!agent.alive) return 'status--offline';
    const { cpu, memory, disk, load } = agent.alive;
    const cpuPct = cpu?.usage ?? 0;
    const memPct = memory?.usagePercent ?? 0;
    const diskPct = disk?.usagePercent ?? 0;
    const loadPct = load?.loadPercent1m ?? 0;
    const max = Math.max(cpuPct, memPct, diskPct, loadPct);
    if (max >= 90) return 'status--red';
    if (max >= 80) return 'status--yellow';
    return 'status--green';
  }

  protected formatBytes(bytes: number): string {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
    return (bytes / 1e3).toFixed(1) + ' KB';
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