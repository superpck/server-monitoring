import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';

import {
  ServerManagementService,
  SystemOverviewResponse,
} from '../../services/server-management.service';
import { ServerContextService } from '../server-management/server-context.service';
import { PkIcon } from '../../shares/pk-icon';

@Component({
  selector: 'app-overview-monitor',
  imports: [PkIcon],
  templateUrl: './overview-monitor.html',
  styleUrl: './overview-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewMonitor implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(ServerManagementService);
  private readonly serverContext = inject(ServerContextService);

  protected readonly selectedServer = this.serverContext.selectedServer;

  protected readonly data = signal<SystemOverviewResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly disabled = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const server = this.selectedServer();
      if (server) {
        this.resetData();
        this.load();
      }
    });
  }

  private resetData(): void {
    this.data.set(null);
    this.error.set(null);
    this.disabled.set(false);
  }

  ngOnInit(): void {
    if (this.selectedServer()) {
      this.load();
    }
  }

  protected async load(): Promise<void> {
    const server = this.selectedServer();
    if (!server) return;
    this.loading.set(true);
    this.error.set(null);

    const res = await this.service.getSystemOverview(server.agentid);
    this.loading.set(false);

    if (!res) { this.error.set('Failed to load system overview'); return; }
    if (!res.success) {
      this.disabled.set(true);
      return;
    }
    this.data.set(res);
  }

  protected memGB(mb: number): string {
    return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB';
  }

  protected lines(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split('\n').filter(l => l.trim());
  }
}
