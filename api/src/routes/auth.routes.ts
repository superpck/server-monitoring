import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { SUPERADMIN_PASSWORD, JWT_SECRET, JWT_EXPIRES_IN } from '../config'
import { randomString, verifyPassword } from '../utils/util'
import db from '../db/database'

const router = Router()

interface UserRow {
  userid: number
  username: string
  name: string
  role: string
  user_admin: number
  password: string
}

/**
 * POST /auth/login
 * Body: { username: string, password: string }
 *
 * Checks DB users first, then falls back to superadmin from .env.
 * Returns a signed JWT on success.
 */
router.post('/login', (req: Request, res: Response) => {
  if (!JWT_SECRET) {
    res.status(503).json({ error: 'Service Unavailable', message: 'JWT_SECRET is not configured' })
    return
  }

  const { username, password } = req.body as { username?: string; password?: string }

  if (!username || !password) {
    res.status(400).json({ error: 'Bad Request', message: 'username and password are required' })
    return
  }

  type Role = 'admin' | 'monitor'
  let role: Role | null = null
  let userAdmin = 0
  let userid = -1
  let name='';

  // ── 1. superadmin from .env (reserved, not in DB) ─────────────────────────
  if (username === 'superadmin' && SUPERADMIN_PASSWORD !== '' && password === SUPERADMIN_PASSWORD) {
    role = 'admin';
    name = 'Super Admin';
    userAdmin = 1;
  }

  // ── 2. DB users ───────────────────────────────────────────────────────────
  if (!role) {
    const row = db
      .prepare<[string], UserRow>('SELECT userid, username, name, role, user_admin, password FROM users WHERE username = ?')
      .get(username)
    if (row && verifyPassword(password, row.password)) {
      role = row.role as Role;
      userAdmin = row.user_admin || 0;
      userid = row.userid;
      name = row.name;
    }
  }

  if (!role) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' })
    return
  }

  const token = jwt.sign({ userid, sub: username, role, user_admin: userAdmin, name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  })

  res.json({ status: 200, token, expiresIn: JWT_EXPIRES_IN })
})

router.get('/random-string/:len', (req: Request, res: Response) => {
  const len = Number(req.params['len'])
  if (isNaN(len) || len <= 10 || len > 1024) {
    res.status(400).json({ error: 'Bad Request', message: 'len must be a number between 10 and 1024' })
    return
  }
  res.send(randomString(len))
})

export default router
