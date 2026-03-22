import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ADMIN_PASSWORD, USER_MONITOR_PASSWORD, JWT_SECRET, JWT_EXPIRES_IN } from '../config'
import { randomString } from '../utils/util'

const router = Router()

/**
 * POST /auth/login
 * Body: { username: string, password: string }
 *
 * Returns a signed JWT on success.
 * The token should be sent on subsequent requests as:
 *   Authorization: Bearer <token>
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

  if (username === 'admin' && ADMIN_PASSWORD !== '' && password === ADMIN_PASSWORD) {
    role = 'admin'
  } else if (username === 'monitor' && USER_MONITOR_PASSWORD !== '' && password === USER_MONITOR_PASSWORD) {
    role = 'monitor'
  }

  if (!role) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' })
    return
  }

  const token = jwt.sign({ sub: username, role }, JWT_SECRET, {
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
