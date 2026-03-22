import { Router, Request, Response } from 'express'
import { auth } from '../middleware/auth.middleware'
import { agents } from '../config'
import type { AgentPublic } from '../types'

const router = Router()

/**
 * GET /agents
 * Returns the list of configured agents without server_key.
 * Used by the UI to populate the dropdown / server list.
 */
router.get('/', auth, (_req: Request, res: Response) => {
  const list: AgentPublic[] = agents.map(({ id, name, group, url }) => ({ id, name, group, url }))
  res.json(list)
})

export default router
