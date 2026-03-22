import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { JWT_SECRET, UI_API_KEY } from '../config'

/**
 * Validates Authorization: Bearer <token> where token is either:
 *   1. A valid JWT signed with JWT_SECRET  (issued by POST /auth/login)
 *   2. The static UI_API_KEY              (machine-to-machine fallback)
 */
export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization']
  req.user = null
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing Authorization header' })
    return
  }

  const token = header.slice('Bearer '.length)

  // ── 1. Try JWT ────────────────────────────────────────────────────────────
  if (JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.user = decoded;
      next()
      return
    } catch {
      // Not a valid JWT — fall through to static key check
    }
  }

  // ── 2. Try static UI_API_KEY ──────────────────────────────────────────────
  if (UI_API_KEY && token === UI_API_KEY) {
    next()
    return
  }

  res.status(401).json({
    status: 401,
    message: 'Unauthorized'
  })
}

/**
 * Requires the authenticated user to have role === 'admin'.
 * Must be used AFTER the `auth` middleware.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as JwtPayload | null
  if (!user || user['role'] !== 'admin') {
    res.status(403).json({ status: 403, message: 'Forbidden' })
    return
  }
  next()
}