import { Router } from 'express'

import systemRoutes from './system.routes'
import logRoutes from './log.routes'
import nginxRoutes from './nginx.routes'
import monitorRoutes from './monitor.routes'
import dashboardRoutes from './dashboard.routes'
import databaseRoutes from './database.routes'
import secureRoutes from './secure.routes'

const router = Router()

router.use('/system', systemRoutes)
router.use('/logs', logRoutes)
router.use('/nginx', nginxRoutes)
router.use('/monitor', monitorRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/database', databaseRoutes)
router.use('/secure', secureRoutes)

export default router