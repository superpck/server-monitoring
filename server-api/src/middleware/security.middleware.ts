import { Request, Response, NextFunction } from 'express'
import { randomString } from '../utils/util'
import dayjs from 'dayjs'

// ── IP helpers ────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : forwarded?.[0]?.trim() ?? req.socket.remoteAddress ?? ''
  return raw.replace(/^::ffff:/, '')
}

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0
}

function cidrMatch(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr
  const [range, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  if (isNaN(bits) || bits < 0 || bits > 32) return false
  const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask)
}

function isIpAllowed(ip: string, ranges: string[]): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) return true
  return ranges.some(r => cidrMatch(ip, r.trim()))
}

// ── Security guard middleware ─────────────────────────────────────────────────

/**
 * Validates incoming requests against SERVER_KEY, SERVER_NAME, and (optionally) ALLOWED_IP_RANGES.
 *
 * Environment variables read:
 *   SERVER_KEY          – required; requests must supply X-Server-Key matching this value
 *   SERVER_NAME         – optional; when set, requests must supply X-Server-Name matching this value
 *   ALLOWED_IP_RANGES   – optional; comma-separated CIDR list, e.g. "10.0.0.0/8,192.168.0.1/32"
 *                         When set, only requests from those IP ranges are accepted.
 *
 * If SERVER_KEY is not configured the middleware passes all requests through so the
 * agent can still be used in development without auth.
 */
export function securityGuard(req: Request, res: Response, next: NextFunction): void {
  const serverKey  = process.env.SERVER_KEY || randomString(32);
  const serverName = process.env.SERVER_NAME || randomString(32);

  // No SERVER_KEY configured — skip auth (dev mode)
  if (!serverKey) {
    next()
    return
  }

  // ── 1. Validate X-Server-Key ─────────────────────────────────────────────
  const requestKey = req.headers['x-server-key']
  if (!requestKey || requestKey !== serverKey) {
    res.status(401).json({ status: 401, message: 'Invalid or missing Server key' })
    return
  }

  // ── 2. Validate X-Server-Name (only when SERVER_NAME is configured) ───────
  if (serverName) {
    const requestName = req.headers['x-server-name']
    if (!requestName || requestName !== serverName) {
      res.status(401).json({ status: 401, message: 'Invalid or missing Server name' })
      return
    }
  }

  // ── 3. Validate source IP (only when ALLOWED_IP_RANGES is configured) ────
  const allowedRanges = process.env.ALLOWED_IP_RANGES
  if (allowedRanges) {
    const clientIp = getClientIp(req)
    const ranges = allowedRanges.split(',')
    if (!isIpAllowed(clientIp, ranges)) {
      console.warn(dayjs().format('HH:mm:ss'), `[security] Blocked request from ${clientIp} — not in ALLOWED_IP_RANGES`)
      res.status(403).json({ status: 403, error: 'Forbidden', message: `Access denied — IP ${clientIp} is not in the allowed range` })
      return
    }
  }

  next()
}
