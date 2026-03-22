import { Router, Request, Response } from 'express';
import os from 'os';
import si from 'systeminformation';

const router = Router();

function getHealthStatus(params: {
  cpuUsage: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  disks?: any,
  loadAvg?: number[],
  load1: number;
  cpus?: any,
  cpuCount: number;
}): 'healthy' | 'warning' | 'critical' {
  const { cpuUsage, memoryUsagePercent, disks, diskUsagePercent, load1, cpus, cpuCount } = params;

  const loadRatio = cpuCount > 0 ? load1 / cpuCount : 0;

  if (
    cpuUsage >= 90 ||
    memoryUsagePercent >= 85 ||
    diskUsagePercent >= 85 ||
    loadRatio >= 1.5
  ) {
    return 'critical';
  }

  if (
    cpuUsage >= 70 ||
    memoryUsagePercent >= 75 ||
    diskUsagePercent >= 85 ||
    loadRatio >= 1
  ) {
    return 'warning';
  }

  return 'healthy';
}

/**
 * endpoint หลักสำหรับ dashboard
 * Angular เรียกครั้งเดียว ได้ข้อมูลหลักครบ
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const [
      cpuLoad,
      mem,
      disks,
      netStats,
      system,
      time,
      currentLoad,
      processes
    ] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.system(),
      si.time(),
      si.currentLoad(),
      si.processes()
    ]);

    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    const cpuCount = cpus.length;

    let primaryDisk = disks.find(d => d.mount === '/System/Volumes/Data') ||
      disks.find(d => d.mount === '/' || d.mount === 'C:\\') ||
      disks[0] || null;
    const primaryNet: any = netStats[0] || null;

    const cpuUsage = Number((cpuLoad.currentLoad || 0).toFixed(2));
    const memoryUsagePercent = Number(((mem.used / mem.total) * 100).toFixed(2));
    const diskUsagePercent = Number((primaryDisk?.use || 0).toFixed(2));

    const load1 = Number((loadAvg[0] || 0).toFixed(2));
    const load5 = Number((loadAvg[1] || 0).toFixed(2));
    const load15 = Number((loadAvg[2] || 0).toFixed(2));

    const loadPercent1m = Number((((loadAvg[0] || 0) / (cpuCount || 1)) * 100).toFixed(2));

    const health = getHealthStatus({
      cpuUsage,
      memoryUsagePercent,
      diskUsagePercent,
      load1,
      cpuCount
    });

    res.json({
      success: true,
      server: {
        agentId: null,
        hostname: os.hostname(),
        serverName: process.env.SERVER_NAME || os.hostname(),
        platform: process.platform,
        release: os.release(),
        uptimeSeconds: time.uptime,
        bootTime: time.current - time.uptime,
        manufacturer: system.manufacturer,
        model: system.model,
        version: process.env.npm_package_version || '1.0.0'
      },
      status: {
        health,
        updatedAt: new Date().toISOString()
      },
      cpus,
      cpu: {
        usage: cpuUsage,
        cores: cpuCount
      },
      loadAvg,
      load: {
        load1,
        load5,
        load15,
        loadPercent1m
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        available: mem.available,
        usagePercent: memoryUsagePercent
      },
      disks,
      disk: primaryDisk
        ? {
          fs: primaryDisk.fs,
          mount: primaryDisk.mount,
          type: primaryDisk.type,
          size: primaryDisk.size,
          used: primaryDisk.used,
          available: primaryDisk.available,
          usagePercent: diskUsagePercent,
          // disks
        }
        : null,
      network: primaryNet
        ? {
          iface: primaryNet.iface,
          rxBytes: primaryNet.rxBytes ?? primaryNet.rx_bytes,
          txBytes: primaryNet.txBytes ?? primaryNet.tx_bytes,
          rxSec: primaryNet.rxSec ?? primaryNet.rx_sec,
          txSec: primaryNet.txSec ?? primaryNet.tx_sec
        }
        : null,
      process: {
        all: processes.all,
        running: processes.running,
        blocked: processes.blocked,
        sleeping: processes.sleeping
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message ?? 'Failed to build dashboard summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * endpoint เบา ๆ สำหรับหน้า list หลาย server
 */
router.get('/quick', async (_req: Request, res: Response) => {
  try {
    const [cpuLoad, mem, disks] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize()
    ]);

    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const primaryDisk = disks[0] || null;

    const cpuUsage = Number((cpuLoad.currentLoad || 0).toFixed(2));
    const memoryUsagePercent = Number(((mem.used / mem.total) * 100).toFixed(2));
    const diskUsagePercent = Number((primaryDisk?.use || 0).toFixed(2));

    const health = getHealthStatus({
      cpuUsage,
      memoryUsagePercent,
      diskUsagePercent,
      load1: loadAvg[0] || 0,
      cpuCount
    });

    res.json({
      success: true,
      hostname: os.hostname(),
      serverName: process.env.SERVER_NAME || os.hostname(),
      platform: process.platform,
      health,
      cpuUsage,
      load1: Number((loadAvg[0] || 0).toFixed(2)),
      memoryUsagePercent,
      diskUsagePercent,
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message ?? 'Failed to build quick dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * endpoint สำหรับคำนวณ health อย่างเดียว
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const [cpuLoad, mem, disks] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize()
    ]);

    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const primaryDisk = disks[0] || null;

    const cpuUsage = Number((cpuLoad.currentLoad || 0).toFixed(2));
    const memoryUsagePercent = Number(((mem.used / mem.total) * 100).toFixed(2));
    const diskUsagePercent = Number((primaryDisk?.use || 0).toFixed(2));

    const health = getHealthStatus({
      cpuUsage,
      memoryUsagePercent,
      diskUsagePercent,
      load1: loadAvg[0] || 0,
      cpuCount
    });

    res.json({
      success: true,
      health,
      metrics: {
        cpuUsage,
        memoryUsagePercent,
        diskUsagePercent,
        load1: Number((loadAvg[0] || 0).toFixed(2)),
        cpuCount
      },
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message ?? 'Failed to calculate dashboard health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;