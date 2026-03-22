import { Router } from 'express'
import { Request, Response } from 'express'
import authRoutes from './auth.routes'
import agentsRoutes from './agents.routes'
import proxyRoutes from './proxy.routes'
import serversRoutes from './servers.routes'
import { auth } from '../middleware/auth.middleware'

const router = Router()

router.use('/auth', authRoutes)
router.use('/agents', auth, agentsRoutes)
router.use('/proxy', auth, proxyRoutes)
router.use('/servers', auth, serversRoutes)

router.use((_req: Request, res: Response) => {
  // res.status(404).json({ status: 404, message: 'Not Found' })
  res.status(404).send()
})

export default router
