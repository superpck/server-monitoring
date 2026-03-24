import { Router, Request, Response } from 'express'
import db from '../db/database'
import { hashPassword } from '../utils/util'

const router = Router()

interface UserRow {
  userid: number
  username: string
  name: string
  role: string
  user_admin: number
}

// ── GET /users ────────────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  const users = db
    .prepare<[], UserRow>('SELECT userid, username, name, role, user_admin FROM users ORDER BY userid')
    .all()
  res.json({ status: 200, users })
})

// ── GET /users/:userid ────────────────────────────────────────────────────────
router.get('/:userid', (req: Request, res: Response) => {
  const userid = Number(req.params['userid'])
  const user = db
    .prepare<[number], UserRow>('SELECT userid, username, name, role, user_admin FROM users WHERE userid = ?')
    .get(userid)
  if (!user) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'User not found' })
    return
  }
  res.json({ status: 200, user })
})

// ── POST /users ───────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const { username, name = '', password, role = 'monitor', user_admin = 0 } = req.body as {
    username?: string
    name?: string
    password?: string
    role?: string
    user_admin?: number
  }

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'username and password are required' })
    return
  }

  if (username.trim().toLowerCase() === 'superadmin') {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'Username "superadmin" is reserved' })
    return
  }

  if (role !== 'admin' && role !== 'monitor') {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'role must be "admin" or "monitor"' })
    return
  }

  const existing = db.prepare('SELECT userid FROM users WHERE username = ?').get(username.trim())
  if (existing) {
    res.status(409).json({ status: 409, error: 'Conflict', message: 'Username already exists' })
    return
  }

  const result = db
    .prepare('INSERT INTO users (username, name, password, role, user_admin) VALUES (?, ?, ?, ?, ?)')
    .run(username.trim(), name, hashPassword(password.trim()), role, user_admin ? 1 : 0)

  res.status(201).json({
    status: 201,
    userid: result.lastInsertRowid,
    username: username.trim(),
    name,
    role,
    user_admin: user_admin ? 1 : 0,
  })
})

// ── PUT /users/:userid ────────────────────────────────────────────────────────
router.put('/:userid', (req: Request, res: Response) => {
  const userid = Number(req.params['userid'])
  const { name, role, user_admin, password } = req.body as {
    name?: string
    role?: string
    user_admin?: number
    password?: string
  }

  const existing = db.prepare('SELECT userid FROM users WHERE userid = ?').get(userid)
  if (!existing) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'User not found' })
    return
  }

  if (role !== undefined && role !== 'admin' && role !== 'monitor') {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'role must be "admin" or "monitor"' })
    return
  }

  const hashed = password?.trim() ? hashPassword(password.trim()) : null

  db.prepare(`
    UPDATE users
    SET name       = COALESCE(?, name),
        role       = COALESCE(?, role),
        user_admin = COALESCE(?, user_admin),
        password   = COALESCE(?, password)
    WHERE userid = ?
  `).run(name ?? null, role ?? null, user_admin ?? null, hashed, userid)

  res.json({ status: 200, success: true })
})

// ── DELETE /users/:userid ─────────────────────────────────────────────────────
router.delete('/:userid', (req: Request, res: Response) => {
  const userid = Number(req.params['userid'])
  const result = db.prepare('DELETE FROM users WHERE userid = ?').run(userid)
  if (result.changes === 0) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'User not found' })
    return
  }
  res.json({ status: 200, success: true })
})

// ── GET /users/:userid/access ─────────────────────────────────────────────────
router.get('/:userid/access', (req: Request, res: Response) => {
  const userid = Number(req.params['userid'])
  const user = db
    .prepare<[number], { userid: number; role: string }>('SELECT userid, role FROM users WHERE userid = ?')
    .get(userid)
  if (!user) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'User not found' })
    return
  }
  // admin always sees everything — no access record needed
  if (user.role === 'admin') {
    res.json({ status: 200, access_type: 'all', agents: [] })
    return
  }
  const access = db
    .prepare<[number], { access_type: string }>('SELECT access_type FROM user_access WHERE userid = ?')
    .get(userid)
  const access_type = access?.access_type ?? 'all'
  const agents = (
    db
      .prepare<[number], { agentid: number }>('SELECT agentid FROM user_access_agent WHERE userid = ?')
      .all(userid)
  ).map((r) => r.agentid)
  res.json({ status: 200, access_type, agents })
})

// ── PUT /users/:userid/access ─────────────────────────────────────────────────
// Body: { access_type: 'all' | 'partial', agents?: number[] }
// Only applicable to non-admin users.
router.put('/:userid/access', (req: Request, res: Response) => {
  const userid = Number(req.params['userid'])
  const { access_type, agents = [] } = req.body as { access_type?: string; agents?: number[] }

  const user = db
    .prepare<[number], { userid: number; role: string }>('SELECT userid, role FROM users WHERE userid = ?')
    .get(userid)
  if (!user) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'User not found' })
    return
  }
  if (user.role === 'admin') {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'Access control does not apply to admin users' })
    return
  }
  if (access_type !== 'all' && access_type !== 'partial') {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'access_type must be "all" or "partial"' })
    return
  }

  const upsertAccess = db.prepare<[number, string]>(`
    INSERT INTO user_access (userid, access_type) VALUES (?, ?)
    ON CONFLICT(userid) DO UPDATE SET access_type = excluded.access_type
  `)
  const deleteAgents = db.prepare<[number]>('DELETE FROM user_access_agent WHERE userid = ?')
  const insertAgent  = db.prepare<[number, number]>('INSERT OR IGNORE INTO user_access_agent (userid, agentid) VALUES (?, ?)')

  db.transaction(() => {
    upsertAccess.run(userid, access_type)
    deleteAgents.run(userid)
    if (access_type === 'partial') {
      for (const agentid of agents) {
        insertAgent.run(userid, Number(agentid))
      }
    }
  })()

  res.json({ status: 200, success: true })
})

export default router
