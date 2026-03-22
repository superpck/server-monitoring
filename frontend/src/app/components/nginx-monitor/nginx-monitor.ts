import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { startWith } from 'rxjs';
import { CommonModule } from '@angular/common';

import {
  ServerManagementService,
  NginxStatusInfo,
  NginxLogEntry,
  NginxStatusResponse,
} from '../../services/server-management.service';
import { ServerContextService } from '../server-management/server-context.service';
import { PkIcon } from '../../shares/pk-icon';

@Component({
  selector: 'app-nginx-monitor',
  imports: [CommonModule, PkIcon],
  templateUrl: './nginx-monitor.html',
  styleUrl: './nginx-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NginxMonitor implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(ServerManagementService);
  private readonly serverContext = inject(ServerContextService);

  protected readonly selectedServer = this.serverContext.selectedServer;
  protected readonly nginxStatusInfo = signal<NginxStatusInfo | null>(null);
  protected readonly nginxStatusRaw = signal<string | null>(null);
  protected readonly nginxLogs = signal<NginxLogEntry[]>([]);
  protected readonly statusLoading = signal(true);
  protected readonly logsLoading = signal(true);
  protected readonly statusDisabled = signal(false);
  protected readonly logsDisabled = signal(false);
  protected readonly statusError = signal<string | null>(null);
  protected readonly logsError = signal<string | null>(null);
  protected readonly showRawStatus = signal(false);

  protected readonly hasData = computed(() =>
    this.nginxStatusInfo() !== null || this.nginxLogs().length > 0
  );

  constructor() {
    // Reset data when server changes
    effect(() => {
      const server = this.selectedServer();
      if (server) {
        this.resetData();
      }
    });
  }

  private resetData(): void {
    this.nginxStatusInfo.set(null);
    this.nginxStatusRaw.set(null);
    this.nginxLogs.set([]);
    this.statusError.set(null);
    this.logsError.set(null);
    this.showRawStatus.set(false);
  }

  ngOnInit(): void {
    // Auto-refresh every 10 seconds for status
    interval(10000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadNginxStatus();
      });

    // Auto-refresh every 15 seconds for logs
    interval(15000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadNginxLogs();
      });
  }

  private async loadNginxStatus(): Promise<void> {
    const server = this.selectedServer();
    if (!server) {
      this.statusError.set('No server selected');
      this.statusLoading.set(false);
      return;
    }

    try {
      this.statusLoading.set(true);
      this.statusError.set(null);

      const response = await this.service.getNginxStatus(server.agentid);
      if (response && response.status) {
        this.nginxStatusRaw.set(response.status);
        const parsed = this.service.parseNginxStatus(response.status);
        this.nginxStatusInfo.set(parsed);
        this.statusDisabled.set(false);
      } else if (response?.success === false && response.message) {
        this.nginxStatusInfo.set(null);
        this.nginxStatusRaw.set(null);
        this.statusDisabled.set(true);
        this.statusError.set(response.message);
      } else {
        this.nginxStatusInfo.set(null);
        this.nginxStatusRaw.set(null);
        this.statusError.set('Failed to load Nginx status');
      }

      const currentInfo = this.nginxStatusInfo();
      const currentRaw = this.nginxStatusRaw() || '';
      if (currentInfo?.active == '' && currentRaw.includes('http://localhost → 200')) {
        this.nginxStatusInfo.set({ ...currentInfo, active: 'http://localhost → 200' });
      }
    } catch (err) {
      this.statusError.set('Failed to load Nginx status');
      this.nginxStatusInfo.set(null);
      this.nginxStatusRaw.set(null);
      console.error('Error loading Nginx status:', err);
    } finally {
      this.statusLoading.set(false);
    }
  }

  private async loadNginxLogs(): Promise<void> {
    const server = this.selectedServer();
    if (!server) {
      this.logsError.set('No server selected');
      this.logsLoading.set(false);
      return;
    }

    try {
      this.logsLoading.set(true);
      this.logsError.set(null);

      const logs = await this.service.getNginxLog(server.agentid);

      if (logs) {
        this.nginxLogs.set(logs);
        this.logsDisabled.set(false);
      } else {
        this.nginxLogs.set([]);
        this.logsDisabled.set(true);
        this.logsError.set('Nginx log monitoring is disabled');
      }
    } catch (err) {
      this.logsError.set('Failed to load Nginx logs');
      this.nginxLogs.set([]);
      // console.error('Error loading Nginx logs:', err);
    } finally {
      this.logsLoading.set(false);
    }
  }

  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  protected formatNumber(num: number): string {
    return num.toLocaleString();
  }

  protected toggleRawStatus(): void {
    this.showRawStatus.update(v => !v);
  }

  protected getStatusBadgeClass(active: string): string {
    if (active.includes('active (running)')) return 'status-badge-success';
    if (active.includes('inactive') || active.includes('dead')) return 'status-badge-error';
    return 'status-badge-default';
  }

  protected getLogLevelClass(level: string): string {
    switch (level.toLowerCase()) {
      case 'error':
      case 'emerg':
      case 'alert':
      case 'crit':
        return 'log-level-error';
      case 'warn':
        return 'log-level-warning';
      case 'info':
      case 'notice':
        return 'log-level-info';
      default:
        return 'log-level-default';
    }
  }
}
