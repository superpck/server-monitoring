import { Router } from 'express'
import { dbMonitorGuard, getInstances, fetchMetrics, fetchActiveQueries } from '../middleware/dbMonitor.middleware'

const router = Router()

// All routes require DB_MONITOR_ENABLED=true in .env
router.use(dbMonitorGuard)

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/database/status
 * Ping every enabled DB instance and return up/down status with latency.
 */
router.get('/status', async (_req, res) => {
  const instances = getInstances()

  const results = await Promise.allSettled(
    instances.map(async inst => {
      const start = Date.now()
      await fetchMetrics(inst)
      return {
        id: inst.id,
        vendor: inst.vendor,
        host: inst.host,
        port: inst.port,
        status: 'up',
        latency_ms: Date.now() - start,
      }
    })
  )

  const data = results.map((r, i) => {
    const inst = instances[i]
    if (r.status === 'fulfilled') return r.value
    return {
      id: inst.id,
      vendor: inst.vendor,
      host: inst.host,
      port: inst.port,
      status: 'down',
      error: (r.reason as Error).message,
      message: (r.reason as Error).message,
    }
  })

  res.json(data)
})

/**
 * GET /api/database/metrics
 * Return detailed metrics for every enabled DB instance.
 */
router.get('/metrics', async (_req, res) => {
  try {
    const instances = getInstances()

    const results = await Promise.allSettled(
      instances.map(async inst => ({
        id: inst.id,
        vendor: inst.vendor,
        host: inst.host,
        port: inst.port,
        metrics: await fetchMetrics(inst),
      }))
    )

    const data = results.map((r, i) => {
      const inst = instances[i]
      if (r.status === 'fulfilled') return { ...r.value, status: 'ok' }
      return {
        id: inst.id,
        vendor: inst.vendor,
        host: inst.host,
        port: inst.port,
        status: 'error',
        error: (r.reason as Error).message,
        message: (r.reason as Error).message,
      }
    })

    res.json(data)
  } catch (error) {
    throw new Error('Failed to fetch database metrics: ' + (error as Error).message);
  }
})

/**
 * GET /api/database/sql
 * Return active / running SQL queries across all enabled DB instances.
 * Optional query param: ?id=<instance-id>  — filter to one instance only
 */
router.get('/sql', async (req, res) => {
  const filterById = req.query.id ? String(req.query.id) : null

  let instances = getInstances()
  if (filterById) instances = instances.filter(i => i.id === filterById)

  const results = await Promise.allSettled(
    instances.map(async inst => ({
      id: inst.id,
      vendor: inst.vendor,
      host: inst.host,
      port: inst.port,
      queries: await fetchActiveQueries(inst),
    }))
  )

  const data = results.map((r, i) => {
    const inst = instances[i]
    if (r.status === 'fulfilled') return { ...r.value, status: 'ok' }
    return {
      id: inst.id,
      vendor: inst.vendor,
      host: inst.host,
      port: inst.port,
      status: 'error',
      error: (r.reason as Error).message,
      message: (r.reason as Error).message,
    }
  })

  res.json(data)
})

export default router
