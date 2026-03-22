import { Router } from 'express'
import os from 'os'
import si from 'systeminformation'
import { exec } from 'child_process'
import { getOrCreateAgentId, getServerFingerprint } from '../utils/server-id';

const router = Router()

router.get('/health', (_req, res) => {
  res.json({
    hostname: os.hostname(),
    uptime: os.uptime(),
    platform: process.platform,
    time: new Date()
  })
})

router.get('/identity', async (_req, res) => {
  try {
    const agentId = getOrCreateAgentId();
    const fingerprint = await getServerFingerprint();

    res.json({
      success: true,
      agentId,
      fingerprint,
      hostname: os.hostname(),
      platform: process.platform
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to build identity',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/metrics', async (_req, res) => {
  const cpu = await si.currentLoad()
  const mem = await si.mem()
  const disk = await si.fsSize()

  res.json({
    cpu: cpu.currentLoad,
    memory: mem.used / mem.total * 100,
    disk: disk[0]?.use
  })
})

router.get('/cpu', async (_req, res) => {
  const cpu = await si.currentLoad()
  res.json(cpu)
})

router.get('/memory', async (_req, res) => {
  const mem = await si.mem()
  res.json(mem)
})

router.get('/disk', async (_req, res) => {
  const disk = await si.fsSize()
  res.json(disk)
})
router.get('/load', (_req, res) => {
  const load = os.loadavg()
  res.json({
    load1: load[0],
    load5: load[1],
    load15: load[2],
    cpuCount: os.cpus().length
  })
})

function runSafe(cmd: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs }, (_err, stdout, stderr) => {
      resolve((stdout || stderr || '').trim())
    })
  })
}

// ── Config from .env ────────────────────────────────────────────────────────
// SYSTEM_OVERVIEW_ENABLED=true   — must be set to enable /system/overview

/**
 * GET /system/overview
 * ข้อมูลรวมสำหรับ admin — เทียบเท่าการรัน: date, w, uname -a,
 * who, last (logins), listening ports, running services, crontabs, env info
 */
router.get('/overview', async (_req, res) => {
  if (process.env.SYSTEM_OVERVIEW_ENABLED !== 'true') {
    res.status(403).json({ success: false, status: 403, message: 'System overview is disabled (set SYSTEM_OVERVIEW_ENABLED=true)' })
    return
  }

  const p = os.platform()
  const isLinux = p === 'linux'
  const isMac = p === 'darwin'
  const isWin = p === 'win32'

  const [
    unameRaw,
    whoRaw,
    wRaw,
    lastRaw,
    uptimeRaw,
    hostnameRaw,
    portsRaw,
    servicesRaw,
    crontabRaw,
    dnsRaw,
    timezoneRaw,
    failedServicesRaw,
    siSystem,
    siCpu,
    siMem,
    siUsers,
  ] = await Promise.all([
    // uname -a
    isWin
      ? runSafe('ver')
      : runSafe('uname -a'),

    // who — currently logged-in users
    isWin
      ? runSafe('query user 2>nul')
      : runSafe('who'),

    // w — load + logged-in users with what they're doing
    isWin
      ? Promise.resolve('')
      : runSafe('w'),

    // last — recent logins (limit 20)
    isLinux
      ? runSafe('last -n 20 --time-format iso 2>/dev/null || last -n 20')
      : isMac
        ? runSafe('last -20')
        : runSafe('wevtutil qe Security "/q:*[System[(EventID=4624)]]" /c:20 /rd:true /f:text 2>nul'),

    // uptime
    isWin
      ? runSafe('net statistics server 2>nul | findstr "since"')
      : runSafe('uptime'),

    // hostname + FQDN
    isWin
      ? runSafe('hostname')
      : runSafe('hostname -f 2>/dev/null || hostname'),

    // listening ports
    isWin
      ? runSafe('netstat -ano | findstr LISTENING')
      : runSafe('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null'),

    // running services (top-level only)
    isLinux
      ? runSafe('systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | head -40')
      : isMac
        ? runSafe('launchctl print system 2>/dev/null | grep -E "running|enabled" | head -40')
        : runSafe('sc query type= service state= running 2>nul'),

    // crontab (root)
    isLinux || isMac
      ? runSafe('crontab -l 2>/dev/null || echo "(none)"')
      : Promise.resolve('(not applicable)'),

    // DNS resolvers
    isWin
      ? runSafe('ipconfig /all 2>nul | findstr "DNS Servers"')
      : runSafe('cat /etc/resolv.conf 2>/dev/null | grep nameserver'),

    // timezone
    isWin
      ? runSafe('tzutil /g 2>nul')
      : runSafe('timedatectl 2>/dev/null || date +"%Z %z"'),

    // failed services (Linux only)
    isLinux
      ? runSafe('systemctl list-units --type=service --state=failed --no-pager --no-legend 2>/dev/null')
      : Promise.resolve(''),

    si.system(),
    si.cpu(),
    si.mem(),
    si.users(),
  ])

  const now = new Date()

  res.json({
    success: true,
    collectedAt: now.toISOString(),

    host: {
      hostname: hostnameRaw,
      platform: p,
      arch: os.arch(),
      uname: unameRaw,
      timezone: timezoneRaw,
      uptime: uptimeRaw,
    },

    hardware: {
      manufacturer: siSystem.manufacturer,
      model: siSystem.model,
      serial: siSystem.serial,
      cpu: `${siCpu.manufacturer} ${siCpu.brand} (${siCpu.cores} cores / ${siCpu.physicalCores} physical)`,
      memTotalMB: Math.round(siMem.total / 1024 / 1024),
    },

    date: {
      iso: now.toISOString(),
      local: now.toString(),
      epochMs: now.getTime(),
    },

    sessions: {
      w: wRaw,
      who: whoRaw,
      siUsers,
    },

    logins: {
      last: lastRaw,
    },

    network: {
      interfaces: os.networkInterfaces(),
      dns: dnsRaw,
      ports: portsRaw,
    },

    services: {
      running: servicesRaw,
      failed: failedServicesRaw,
    },

    crontab: crontabRaw,

    environment: {
      nodeVersion: process.version,
      nodePath: process.execPath,
      pid: process.pid,
      cwd: process.cwd(),
      user: os.userInfo().username,
    },
  })
})

export default router