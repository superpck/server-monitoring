import { Request } from 'express'

/**
 * Extracts the real client IP from the request.
 * Handles IPv6-mapped IPv4 addresses (::ffff:1.2.3.4).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : forwarded?.[0]?.trim() ?? req.socket.remoteAddress ?? ''
  // Strip IPv6-mapped IPv4 prefix
  return raw.replace(/^::ffff:/, '')
}

/** Converts a dotted-decimal IPv4 string to a 32-bit unsigned integer. */
function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0
}

/**
 * Tests whether `ip` falls inside the given CIDR range.
 * Supports plain IPs (no mask) as well as /0–/32.
 */
export function cidrMatch(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) {
    return ip === cidr
  }
  const [range, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  if (isNaN(bits) || bits < 0 || bits > 32) return false
  const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask)
}

/**
 * Returns true when `ip` matches at least one entry in `ranges`.
 * Loopback addresses (127.x.x.x, ::1) always pass.
 */
export function isIpAllowed(ip: string, ranges: string[]): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) return true
  return ranges.some(r => cidrMatch(ip, r.trim()))
}
