/**
 * Secure / Auth log endpoints
 *
 * Env:
 *   SECURE_LOG_ENABLED=true   — must be set to enable this module
 *   SECURE_LOG_LINES=100      — default tail lines (1–500)
 *
 * GET /secure/sources          — list available log sources for this platform
 * GET /secure/log?source=auth&n=100  — tail a log source
 */

import { Router, RequestHandler } from 'express'
import { exec } from 'child_process'
import { existsSync } from 'fs'
import { platform } from 'os'

const router = Router()

// ── Types ────────────────────────────────────────────────────────────────────

interface LogSource {
  id: string
  label: string
  file?: string           // for file-based logs
  cmd?: string            // for command-based logs (e.g. macOS `log show`)
  available: boolean
  note?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function runSafe(cmd: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve) => {
    const child = exec(cmd, { timeout: timeoutMs }, (_err, stdout, stderr) => {
      resolve((stdout || stderr || '').trim())
    })
    child.on('error', () => resolve(''))
  })
}

async function fileAvailable(path: string): Promise<boolean> {
  if (!existsSync(path)) return false
  // Check read permission
  const out = await runSafe(`test -r ${path} && echo ok`)
  return out === 'ok'
}

/** Detect Linux distro family: 'rhel' | 'debian' | 'unknown' */
async function detectLinuxFamily(): Promise<'rhel' | 'debian' | 'unknown'> {
  if (existsSync('/etc/redhat-release') || existsSync('/etc/fedora-release')) return 'rhel'
  if (existsSync('/etc/debian_version') || existsSync('/etc/lsb-release')) return 'debian'
  // Fallback: parse /etc/os-release
  const osRelease = await runSafe('cat /etc/os-release 2>/dev/null')
  const id = (osRelease.match(/^ID(?:_LIKE)?=(.+)/m)?.[1] ?? '').toLowerCase()
  if (/rhel|centos|fedora|rocky|alma|oracle/.test(id)) return 'rhel'
  if (/debian|ubuntu|mint|pop/.test(id)) return 'debian'
  return 'unknown'
}

// ── Source definitions per platform ─────────────────────────────────────────

const RHEL_SOURCES: Omit<LogSource, 'available'>[] = [
  { id: 'auth',     label: 'Auth / Secure',   file: '/var/log/secure' },
  { id: 'messages', label: 'System Messages',  file: '/var/log/messages' },
  { id: 'audit',    label: 'Audit Log',        file: '/var/log/audit/audit.log' },
]

const DEBIAN_SOURCES: Omit<LogSource, 'available'>[] = [
  { id: 'auth',     label: 'Auth Log',         file: '/var/log/auth.log' },
  { id: 'syslog',   label: 'Syslog',           file: '/var/log/syslog' },
  { id: 'kern',     label: 'Kernel Log',       file: '/var/log/kern.log' },
]

const MACOS_SOURCES: Omit<LogSource, 'available'>[] = [
  {
    id: 'auth',
    label: 'Auth / Security (last 1h)',
    cmd: `log show --style syslog --last 1h --predicate 'subsystem == "com.apple.securityd" OR subsystem == "com.apple.authorization" OR category == "security"' 2>/dev/null | tail -n {n}`,
    note: 'Uses macOS Unified Log. Requires full-disk access in some configurations.',
  },
  {
    id: 'system',
    label: 'System Log (last 1h)',
    cmd: `log show --style syslog --last 1h 2>/dev/null | tail -n {n}`,
  },
  {
    id: 'system-file',
    label: 'System Log File',
    file: '/var/log/system.log',
    note: 'Not present on macOS 12+ (Monterey and later).',
  },
]

const WINDOWS_SOURCES: Omit<LogSource, 'available'>[] = [
  {
    id: 'security',
    label: 'Security Event Log',
    cmd: `wevtutil qe Security /c:{n} /rd:true /f:text 2>nul`,
    note: 'Requires Administrator privileges.',
  },
  {
    id: 'system',
    label: 'System Event Log',
    cmd: `wevtutil qe System /c:{n} /rd:true /f:text 2>nul`,
  },
]

// ── Resolve sources for current host ────────────────────────────────────────

async function resolveSources(): Promise<LogSource[]> {
  const os = platform()

  if (os === 'darwin') {
    return Promise.all(
      MACOS_SOURCES.map(async (s) => ({
        ...s,
        available: s.file ? await fileAvailable(s.file) : true,  // cmd-based: assume available
      }))
    )
  }

  if (os === 'win32') {
    // Check if wevtutil exists
    const hasWevtutil = (await runSafe('where wevtutil 2>nul')).length > 0
    return WINDOWS_SOURCES.map((s) => ({ ...s, available: hasWevtutil }))
  }

  if (os === 'linux') {
    const family = await detectLinuxFamily()
    const defs = family === 'debian' ? DEBIAN_SOURCES : RHEL_SOURCES  // rhel as default for unknown
    return Promise.all(
      defs.map(async (s) => ({
        ...s,
        available: s.file ? await fileAvailable(s.file) : true,
      }))
    )
  }

  return []
}

// ── Config from .env ────────────────────────────────────────────────────────
// SECURE_LOG_ENABLED=true   — must be set to enable /secure/* routes

// ── Guard ─────────────────────────────────────────────────────────────────────

const guard: RequestHandler = (_req, res, next) => {
  if (process.env.SECURE_LOG_ENABLED !== 'true') {
    res.status(403).json({ success: false, status: 403, message: 'Secure log monitoring is disabled (set SECURE_LOG_ENABLED=true)' })
    return
  }
  next()
}

// ── Routes ───────────────────────────────────────────────────────────────────

/** GET /secure/sources — list available log sources */
router.get('/sources', guard, async (_req, res) => {
  try {
    const sources = await resolveSources()
    res.json({
      success: true,
      platform: platform(),
      sources: sources.map(({ id, label, available, note, file }) => ({ id, label, available, file, note })),
    })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

/** GET /secure/log?source=auth&n=100 — tail a log source */
router.get('/log', guard, async (req, res) => {
  const sourceId = String(req.query.source || 'auth')
  const defaultLines = Math.min(500, Math.max(1, parseInt(process.env.SECURE_LOG_LINES ?? '100', 10)))
  const n = Number.isFinite(+req.query.n!) && +req.query.n! > 0
    ? Math.min(500, Math.max(1, +req.query.n!))
    : defaultLines

  try {
    const sources = await resolveSources()
    const source = sources.find((s) => s.id === sourceId)

    if (!source) {
      const ids = sources.map((s) => s.id).join(', ')
      res.status(400).json({ success: false, message: `Unknown source "${sourceId}". Available: ${ids}` })
      return
    }

    if (!source.available) {
      res.json({ success: false, source: source.id, label: source.label, message: 'Log source is not available on this host', log: '' })
      return
    }

    let log: string
    if (source.file) {
      log = await runSafe(`tail -n ${n} ${source.file}`)
    } else if (source.cmd) {
      // Replace {n} placeholder with actual line count
      log = await runSafe(source.cmd.replace(/{n}/g, String(n)))
    } else {
      log = ''
    }

    if (!log) {
      res.json({ success: false, source: source.id, label: source.label, message: 'Empty or unreadable log', log: '' })
      return
    }

    res.json({ success: true, source: source.id, label: source.label, log })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

export default router
