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
import { NgxEchartsModule } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';

import { ServerManagementService, Pm2Process } from '../../services/server-management.service';
import { ServerContextService } from '../server-management/server-context.service';
import { PkIcon } from '../../shares/pk-icon';

interface HistoricalDataPoint {
  timestamp: number;
  cpuByProcess: Map<string, number>;
  memoryByProcess: Map<string, number>;
}

@Component({
  selector: 'app-pm2-monitor',
  imports: [CommonModule, NgxEchartsModule, PkIcon],
  templateUrl: './pm2-monitor.html',
  styleUrl: './pm2-monitor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pm2Monitor implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(ServerManagementService);
  private readonly serverContext = inject(ServerContextService);

  protected readonly selectedServer = this.serverContext.selectedServer;
  protected readonly processes = signal<Pm2Process[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly cpuCores = signal<number>(1);
  
  private readonly historicalData: HistoricalDataPoint[] = [];
  private readonly maxDataPoints = 120; // 10 minutes * 60 seconds / 5 seconds
  protected readonly hasHistoricalData = signal(false);
  
  protected readonly cpuChartOption = signal<EChartsOption>({});
  protected readonly memoryChartOption = signal<EChartsOption>({});
  
  protected readonly totalCpu = computed(() => {
    const procs = this.processes();
    return procs.reduce((sum, p) => sum + p.cpu, 0);
  });
  
  protected readonly avgCpu = computed(() => {
    const cores = this.cpuCores();
    return cores > 0 ? this.totalCpu() / cores : 0;
  });
  
  protected readonly totalMemory = computed(() => {
    const procs = this.processes();
    return procs.reduce((sum, p) => sum + p.memory / (1024 * 1024), 0);
  });
  
  protected readonly totalMemoryFormatted = computed(() => {
    const mb = this.totalMemory();
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  });
  constructor() {
    // Reset historical data when server changes
    effect(() => {
      const server = this.selectedServer();
      if (server) {
        this.resetHistoricalData();
        this.loadCpuCores();
      }
    });
  }

  ngOnInit(): void {
    // Auto-refresh every 5 seconds
    interval(5000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadPm2Processes();
      });
  }

  private resetHistoricalData(): void {
    this.historicalData.length = 0;
    this.hasHistoricalData.set(false);
    this.cpuChartOption.set({});
    this.memoryChartOption.set({});
  }

  private async loadCpuCores(): Promise<void> {
    const server = this.selectedServer();
    if (!server) return;

    try {
      const summary = await this.service.getDashboardSummary(server.agentid);
      if (summary?.cpu?.cores) {
        this.cpuCores.set(summary.cpu.cores);
      }
    } catch (err) {
      console.error('Error loading CPU cores:', err);
    }
  }

  private async loadPm2Processes(): Promise<void> {
    const server = this.selectedServer();
    if (!server) {
      this.error.set('No server selected');
      this.loading.set(false);
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      const response = await this.service.getPm2Processes(server.agentid);
      
      if (response?.success && response.processes) {
        this.processes.set(response.processes);
        this.updateHistoricalData(response.processes);
        this.updateCharts();
      } else {
        this.processes.set([]);
        this.error.set('Failed to load PM2 processes');
      }
    } catch (err) {
      this.error.set('Failed to load PM2 processes');
      this.processes.set([]);
      console.error('Error loading PM2 processes:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private updateHistoricalData(processes: Pm2Process[]): void {
    const now = Date.now();
    const cpuByProcess = new Map<string, number>();
    const memoryByProcess = new Map<string, number>();

    processes.forEach(proc => {
      cpuByProcess.set(proc.name, proc.cpu);
      memoryByProcess.set(proc.name, proc.memory / (1024 * 1024)); // Convert to MB
    });

    this.historicalData.push({
      timestamp: now,
      cpuByProcess,
      memoryByProcess,
    });

    // Keep only last 10 minutes of data
    if (this.historicalData.length > this.maxDataPoints) {
      this.historicalData.shift();
    }
    
    this.hasHistoricalData.set(this.historicalData.length > 0);
  }

  private updateCharts(): void {
    if (this.historicalData.length === 0) return;

    const processNames = Array.from(new Set(
      this.historicalData.flatMap(d => Array.from(d.cpuByProcess.keys()))
    ));

    // CPU Chart
    const cpuSeries = processNames.map(name => ({
      name,
      type: 'line' as const,
      smooth: true,
      data: this.historicalData.map(d => d.cpuByProcess.get(name) || 0),
    }));

    const timestamps = this.historicalData.map(d => 
      new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );

    this.cpuChartOption.set({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: processNames,
        bottom: 0,
        textStyle: { color: 'var(--text-primary)' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '60px',
        top: '30px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timestamps,
        axisLabel: { color: 'var(--text-secondary)' },
      },
      yAxis: {
        type: 'value',
        name: 'CPU %',
        axisLabel: { 
          color: 'var(--text-secondary)',
          formatter: '{value}%',
        },
      },
      series: cpuSeries,
    });

    // Memory Chart
    const memorySeries = processNames.map(name => ({
      name,
      type: 'line' as const,
      smooth: true,
      data: this.historicalData.map(d => d.memoryByProcess.get(name) || 0),
    }));

    this.memoryChartOption.set({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((item: any) => {
            result += `${item.marker} ${item.seriesName}: ${item.value.toFixed(1)} MB<br/>`;
          });
          return result;
        },
      },
      legend: {
        data: processNames,
        bottom: 0,
        textStyle: { color: 'var(--text-primary)' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '60px',
        top: '30px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: timestamps,
        axisLabel: { color: 'var(--text-secondary)' },
      },
      yAxis: {
        type: 'value',
        name: 'Memory (MB)',
        axisLabel: { 
          color: 'var(--text-secondary)',
          formatter: '{value} MB',
        },
      },
      series: memorySeries,
    });
  }

  protected formatMemory(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  protected formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'online':
        return 'status-online';
      case 'stopped':
        return 'status-stopped';
      case 'errored':
        return 'status-error';
      default:
        return 'status-unknown';
    }
  }
}
