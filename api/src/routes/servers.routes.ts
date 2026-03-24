import { Router, Request, Response } from 'express'
import { JwtPayload } from 'jsonwebtoken'
import { auth, requireAdmin, optionalAuth } from '../middleware/auth.middleware'
import db from '../db/database'

const router = Router()

interface GroupRow {
  groupid: number
  group: string
  detail: string
  seq: number
}

interface AgentRow {
  agentid: number
  groupid: number
  name: string
  detail: string
  url: string
  server_name: string
  isactive: number
  seq: number
}

// ── GET /servers — all groups with their agents ──────────────────────────────
router.get('/', optionalAuth, (req: Request, res: Response) => {
  const groups = db
    .prepare<[], GroupRow>('SELECT groupid, group_name as "group", detail, seq FROM server_group ORDER BY seq, groupid')
    .all()

  let agents = db
    .prepare<[], AgentRow>('SELECT agentid, groupid, name, detail, url, server_name, isactive, seq FROM server_agent ORDER BY seq, agentid')
    .all()

  // ── Apply user access filter for non-admin authenticated users ────────────
  const user = req.user as JwtPayload | null;
  console.log(user);
  if (user && typeof user === 'object' && user['role'] !== 'admin' && user['userid'] > 0) {
    const access = db
      .prepare<[number], { access_type: string }>('SELECT access_type FROM user_access WHERE userid = ?')
      .get(user['userid'] as number)

    if (access?.access_type === 'partial') {
      const allowed = db
        .prepare<[number], { agentid: number }>('SELECT agentid FROM user_access_agent WHERE userid = ?')
        .all(user['userid'] as number)
        .map((r) => r.agentid)

      agents = agents.filter((a) => allowed.includes(a.agentid))
    }
    // access_type === 'all' or no entry → no filtering needed
  }

  const result = groups
    .map((g) => ({ ...g, agents: agents.filter((a) => a.groupid === g.groupid) }))
    .filter((g) => g.agents.length > 0)

  res.json({ status: 200, groups: result })
})

// ── POST /servers/groups ──────────────────────────────────────────────────────
router.post('/groups', auth, requireAdmin, (req: Request, res: Response) => {
  const { group, detail = '', seq = 100 } = req.body as { group?: string; detail?: string; seq?: number }
  if (!group?.trim()) {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'group name is required' })
    return
  }
  const result = db
    .prepare('INSERT INTO server_group (group_name, detail, seq) VALUES (?, ?, ?)')
    .run(group.trim(), detail, seq)
  res.status(201).json({ status: 201, groupid: result.lastInsertRowid, group: group.trim(), detail, seq, agents: [] })
})

// ── PUT /servers/groups/:groupid ──────────────────────────────────────────────
router.put('/groups/:groupid', auth, requireAdmin, (req: Request, res: Response) => {
  const groupid = Number(req.params['groupid'])
  const { group, detail, seq } = req.body as { group?: string; detail?: string; seq?: number }

  const existing = db.prepare('SELECT groupid FROM server_group WHERE groupid = ?').get(groupid)
  if (!existing) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'Group not found' })
    return
  }

  db.prepare(
    'UPDATE server_group SET group_name = COALESCE(?, group_name), detail = COALESCE(?, detail), seq = COALESCE(?, seq) WHERE groupid = ?'
  ).run(group?.trim() ?? null, detail ?? null, seq ?? null, groupid)

  res.json({ status: 200, success: true })
})

// ── DELETE /servers/groups/:groupid ──────────────────────────────────────────
router.delete('/groups/:groupid', auth, requireAdmin, (req: Request, res: Response) => {
  const groupid = Number(req.params['groupid'])
  const result = db.prepare('DELETE FROM server_group WHERE groupid = ?').run(groupid)
  if (result.changes === 0) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'Group not found' })
    return
  }
  res.json({ status: 200, success: true })
})

// ── POST /servers/agents ──────────────────────────────────────────────────────
router.post('/agents', auth, requireAdmin, (req: Request, res: Response) => {
  const { groupid, name, detail = '', url, server_name = '', server_key = '', isactive = 1, seq = 100 } = req.body as {
    groupid?: number
    name?: string
    detail?: string
    url?: string
    server_name?: string
    server_key?: string
    isactive?: number
    seq?: number
  }

  if (!groupid || !name?.trim() || !url?.trim()) {
    res.status(400).json({ status: 400, error: 'Bad Request', message: 'groupid, name, and url are required' })
    return
  }

  const group = db.prepare('SELECT groupid FROM server_group WHERE groupid = ?').get(groupid)
  if (!group) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'Group not found' })
    return
  }

  const result = db
    .prepare('INSERT INTO server_agent (groupid, name, detail, url, server_name, server_key, isactive, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(groupid, name.trim(), detail, url.trim(), server_name, server_key, isactive ? 1 : 0, seq)

  res.status(201).json({
    agentid: result.lastInsertRowid,
    groupid,
    name: name.trim(),
    detail,
    url: url.trim(),
    server_name,
    isactive: isactive ? 1 : 0,
    seq,
  })
})

// ── PUT /servers/agents/:agentid ──────────────────────────────────────────────
router.put('/agents/:agentid', auth, requireAdmin, (req: Request, res: Response) => {
  const agentid = Number(req.params['agentid'])
  const { name, detail, url, server_name, server_key, groupid, isactive, seq } = req.body as {
    name?: string
    detail?: string
    url?: string
    server_name?: string
    server_key?: string
    groupid?: number,
    isactive?: number
    seq?: number
  }

  const existing = db.prepare('SELECT agentid FROM server_agent WHERE agentid = ?').get(agentid)
  if (!existing) {
    res.status(404).json({ error: 'Agent not found' })
    return
  }

  db.prepare(`
    UPDATE server_agent
    SET name        = COALESCE(?, name),
        detail      = COALESCE(?, detail),
        url         = COALESCE(?, url),
        server_name = COALESCE(?, server_name),
        server_key  = COALESCE(?, server_key),
        groupid     = COALESCE(?, groupid),
        isactive    = COALESCE(?, isactive),
        seq         = COALESCE(?, seq)
    WHERE agentid = ?
  `).run(name?.trim() ?? null, detail ?? null, url?.trim() ?? null, server_name ?? null, server_key?.trim() || null, groupid ?? null, isactive ?? null, seq ?? null, agentid)

  res.json({ status: 200, success: true })
})

// ── DELETE /servers/agents/:agentid ──────────────────────────────────────────
router.delete('/agents/:agentid', auth, requireAdmin, (req: Request, res: Response) => {
  const agentid = Number(req.params['agentid'])
  const result = db.prepare('DELETE FROM server_agent WHERE agentid = ?').run(agentid)
  if (result.changes === 0) {
    res.status(404).json({ error: 'Agent not found' })
    return
  }
  res.json({ status: 200, success: true })
})

// ── PATCH /servers/agents/:agentid/toggle ────────────────────────────────────
router.patch('/agents/:agentid/toggle', auth, requireAdmin, (req: Request, res: Response) => {
  const agentid = Number(req.params['agentid'])
  const agent = db
    .prepare<number, { isactive: number }>('SELECT isactive FROM server_agent WHERE agentid = ?')
    .get(agentid)

  if (!agent) {
    res.status(404).json({ status: 404, error: 'Not Found', message: 'Agent not found' })
    return
  }

  const newState = agent.isactive === 1 ? 0 : 1
  db.prepare('UPDATE server_agent SET isactive = ? WHERE agentid = ?').run(newState, agentid)
  res.json({ status: 200, agentid, isactive: newState })
})

export default router
