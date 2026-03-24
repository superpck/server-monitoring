import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  signal,
  inject,
} from '@angular/core';

import { ServerManagementService } from '../../services/server-management.service';
import { ServerMonitor } from '../server-monitor/server-monitor';
import { DbMonitor } from '../db-monitor/db-monitor';
import { Pm2Monitor } from '../pm2-monitor/pm2-monitor';
import { NginxMonitor } from '../nginx-monitor/nginx-monitor';
import { SecureMonitor } from '../secure-monitor/secure-monitor';
import { OverviewMonitor } from '../overview-monitor/overview-monitor';
import { ServerContextService, ServerGroup, ServerItem } from './server-context.service';
import { PkIcon } from '../../shares/pk-icon';
import { PkTabs, PkTabPanel, type PkTab } from '../../shares/pk-tabs';

const SIDEBAR_BREAKPOINT = 1024;

@Component({
  selector: 'app-server-management',
  imports: [ServerMonitor, DbMonitor, Pm2Monitor, NginxMonitor, SecureMonitor, OverviewMonitor, PkIcon, PkTabs, PkTabPanel],
  templateUrl: './server-management.html',
  styleUrl: './server-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ServerContextService],
})
export class ServerManagement implements OnInit {
  private readonly service = inject(ServerManagementService);
  private readonly serverContext = inject(ServerContextService);

  protected readonly groups = signal<ServerGroup[]>([]);

  ngOnInit(): void {
    this.service.getConfigServer().then(config => {
      this.groups.set(
        config.map(({ group, agents }) => ({
          group,
          agents: (agents ?? []).map(({ name, url, agentid }) => ({ name, url, agentid })),
        }))
      );
    }).catch(err => console.error('[ServerManagement] getConfigServer failed:', err));
  }

  protected readonly totalAgents = computed(() =>
    this.groups().reduce((sum, g) => sum + g.agents.length, 0)
  );

  protected readonly selectedServer = this.serverContext.selectedServer;
  protected readonly sidebarVisible = signal(
    typeof window !== 'undefined' ? window.innerWidth > SIDEBAR_BREAKPOINT : true
  );

  protected readonly hasSelectedServer = computed(() => this.selectedServer() !== null);

  protected selectServer(server: ServerItem): void {
    this.serverContext.selectedServer.set(server);
    if (typeof window !== 'undefined' && window.innerWidth <= SIDEBAR_BREAKPOINT) {
      this.sidebarVisible.set(false);
    }
  }

  protected toggleSidebar(): void {
    this.sidebarVisible.update(v => !v);
  }

  protected readonly monitorTabs: PkTab[] = [
    { id: 'overview',  label: 'Agent Overview' },
    { id: 'server',    label: 'System Monitor' },
    { id: 'pm2',       label: 'PM2 Monitor' },
    { id: 'nginx',     label: 'Nginx Monitor' },
    { id: 'db',        label: 'Database Monitor' },
    { id: 'log',       label: 'Log Monitor' },
  ];
  protected readonly activeMonitorTab = signal('overview');
}
