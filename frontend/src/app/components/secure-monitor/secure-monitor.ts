import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { startWith } from 'rxjs';

import {
  SecureLogResponse,
  SecureSource,
  ServerManagementService,
} from '../../services/server-management.service';
import { ServerContextService } from '../server-management/server-context.service';
import { PkIcon } from '../../shares/pk-icon';

@Component({
  selector: 'app-secure-monitor',
  imports: [PkIcon],
  templateUrl: './secure-monitor.html',
  styleUrl: './secure-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecureMonitor implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(ServerManagementService);
  private readonly serverContext = inject(ServerContextService);

  protected readonly selectedServer = this.serverContext.selectedServer;

  protected readonly sources = signal<SecureSource[]>([]);
  protected readonly activeSource = signal<string>('auth');
  protected readonly logResponse = signal<SecureLogResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly sourcesLoading = signal(true);
  protected readonly disabled = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly platform = signal('');

  constructor() {
    effect(() => {
      if (this.selectedServer()) {
        this.resetData();
      }
    });
  }

  private resetData(): void {
    this.sources.set([]);
    this.logResponse.set(null);
    this.error.set(null);
    this.disabled.set(false);
    this.loading.set(true);
    this.sourcesLoading.set(true);
  }

  ngOnInit(): void {
    interval(60000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAll());
  }

  private async loadAll(): Promise<void> {
    const server = this.selectedServer();
    if (!server) return;

    this.sourcesLoading.set(true);
    const res = await this.service.getSecureSources(server.agentid);
    this.sourcesLoading.set(false);

    if (!res) { this.error.set('Failed to load secure log sources'); this.loading.set(false); return; }
    if (!res.success) { this.disabled.set(true); this.loading.set(false); return; }

    this.platform.set(res.platform);
    this.sources.set(res.sources);
    this.disabled.set(false);

    // Pick first available source if current selection is unavailable
    const available = res.sources.find(s => s.available);
    if (available && !res.sources.find(s => s.id === this.activeSource() && s.available)) {
      this.activeSource.set(available.id);
    }

    await this.loadLog();
  }

  protected async selectSource(id: string): Promise<void> {
    this.activeSource.set(id);
    await this.loadLog();
  }

  protected async reload(): Promise<void> {
    await this.loadLog();
  }

  private async loadLog(): Promise<void> {
    const server = this.selectedServer();
    if (!server) return;
    this.loading.set(true);
    this.error.set(null);
    const res = await this.service.getSecureLog(server.agentid, this.activeSource());
    if (res) {
      this.logResponse.set(res);
    } else {
      this.error.set('Failed to load log');
    }
    this.loading.set(false);
  }

  protected activeSources(): SecureSource[] {
    return this.sources();
  }

  protected logLines(): string[] {
    const raw = this.logResponse()?.log ?? '';
    return raw ? raw.split('\n').filter(l => l.trim()) : [];
  }

  protected lineClass(line: string): string {
    const l = line.toLowerCase();
    if (l.includes('failed') || l.includes('error') || l.includes('invalid') || l.includes('denied')) return 'line--error';
    if (l.includes('warn') || l.includes('suspicious')) return 'line--warn';
    if (l.includes('accepted') || l.includes('opened') || l.includes('session opened')) return 'line--success';
    return '';
  }
}
