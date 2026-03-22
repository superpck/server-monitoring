import { Router, RequestHandler } from 'express'
import { exec, spawn } from 'child_process'
import http from 'http'
import https from 'https'

const router = Router()

// ── Config from .env ──────────────────────────────────────────────────────────
// NGINX_LOG_ENABLED=true
// NGINX_ACCESS_LOG=/var/log/nginx/access.log   (optional)
// NGINX_ERROR_LOG=/var/log/nginx/error.log     (optional)
// NGINX_CHECK_URL=http://localhost/            (optional, for Docker / remote nginx)

function getNginxLogConfig() {
  return {
    enabled: process.env.NGINX_LOG_ENABLED === 'true',
    accessLog: process.env.NGINX_ACCESS_LOG || '/var/log/nginx/access.log',
    errorLog: process.env.NGINX_ERROR_LOG || '/var/log/nginx/error.log',
    checkUrl: process.env.NGINX_CHECK_URL || 'http://localhost',
  }
}

const nginxLogGuard: RequestHandler = (_req, res, next) => {
  if (!getNginxLogConfig().enabled) {
    res.json({ success: false, status: 503, message: 'Nginx log monitoring is disabled' })
    return
  }
  next()
}

function run(cmd: string) {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(stderr)
      else resolve(stdout)
    })
  })
}

/** HTTP ping — resolves with status code, or rejects on connection error */
function httpCheck(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 3000 }, (res) => {
      res.resume()  // drain body
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

/** Like run() but always resolves — stdout first, fallback to stderr */
function runSafe(cmd: string) {
  return new Promise<string>((resolve) => {
    exec(cmd, (_err, stdout, stderr) => {
      resolve((stdout || stderr || '').trim())
    })
  })
}

router.get('/status', async (_req, res) => {
  // Try systemctl first (Linux with systemd); fall back to ps for Docker/non-systemd
  try {
    const result = await run('systemctl status nginx --no-pager')
    res.json({ status: result, mode: 'systemctl' })
    return
  } catch {
    // systemd not available — likely running in Docker or a minimal container
  }

  try {
    const checkUrl = process.env.NGINX_CHECK_URL || 'http://localhost/'

    // HTTP check — works regardless of process namespace (same host or different container)
    const [httpStatus, procs] = await Promise.all([
      httpCheck(checkUrl).catch(() => 0),
      runSafe('pgrep nginx || pgrep -f nginx'),
    ])

    const httpOk = httpStatus > 0 && httpStatus < 500
    const running = httpOk || procs.length > 0

    // Config test: only try if nginx binary is local
    const nginxBin = (await runSafe('which nginx 2>/dev/null || find /usr/sbin /usr/local/sbin /sbin -maxdepth 1 -name nginx 2>/dev/null | head -1')).split('\n')[0].trim()
    const config = nginxBin ? await runSafe(`${nginxBin} -t 2>&1`) : '(nginx binary not local)'

    res.json({
      status: `http check: ${checkUrl} → ${httpStatus || 'connection refused'}\nnginx config: ${config}\nprocesses:\n${procs || '(none)'}`,
      running,
      httpStatus,
      mode: 'docker',
    })
  } catch (err) {
    res.status(500).json({ status: 500, message: (err as Error).message })
  }
})

// GET /nginx/log?type=error&n=50  → snapshot (เปิดได้เฉพาะ NGINX_LOG_ENABLED=true)
router.get('/log', nginxLogGuard, async (req, res) => {
  const n = parseInt(req.query.n as string, 10)
  const lines = Number.isFinite(n) && n > 0 ? n : 50
  const { accessLog, errorLog } = getNginxLogConfig()
  const type = req.query.type === 'error' ? 'error' : 'access';
  const logFile = type === 'access' ? accessLog : errorLog;

  try {
    const log = await run(`tail -n ${lines} ${logFile}`);
    return res.json({ status: 200, log, type, file: logFile.split('/').slice(-1)[0] });
  } catch {
    return res.status(500).json({ status: 500, message: `cannot read nginx ${type} log` })
  }
})

// GET /nginx/log/stream?type=access&n=50  → SSE real-time stream
router.get('/log/stream', nginxLogGuard, (req, res) => {
  const n = parseInt(req.query.n as string, 10)
  const lines = Number.isFinite(n) && n > 0 ? n : 50
  const { accessLog, errorLog } = getNginxLogConfig()
  const type = req.query.type === 'access' ? 'access' : 'error';
  const logFile = type === 'access' ? accessLog : errorLog

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const tail = spawn('tail', ['-n', String(lines), '-f', logFile])

  tail.stdout.on('data', (data: Buffer) => {
    res.write(`data: ${JSON.stringify(data.toString())}\n\n`)
  })

  tail.stderr.on('data', (data: Buffer) => {
    res.write(`event: error\ndata: ${JSON.stringify(data.toString())}\n\n`)
  })

  req.on('close', () => tail.kill())
})

export default router