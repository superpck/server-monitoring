import { Router } from 'express'
import si from 'systeminformation'
import pm2 from 'pm2'

const router = Router()

// ── PM2 ───────────────────────────────────────────────────────────────────────

router.get('/pm2', (_req, res) => {
  try {
    pm2.connect(true, (connectErr) => {
      if (connectErr) {
        res.status(500).json({ success: false, message: connectErr.message })
        return
      }
      pm2.list((listErr, list) => {
        pm2.disconnect()
        if (listErr) {
          res.status(500).json({ success: false, message: listErr.message })
          return
        }
        const processes = list.map((p) => ({
          id: p.pm_id,
          name: p.name,
          status: p.pm2_env?.status,
          pid: p.pid,
          cpu: p.monit?.cpu,
          memory: p.monit?.memory,
          uptime: (p.pm2_env as any)?.pm_uptime,
          restarts: p.pm2_env?.restart_time,
          unstable_restarts: (p.pm2_env as any)?.unstable_restarts,
          created_at: (p.pm2_env as any)?.created_at,
          watch: (p.pm2_env as any)?.watch,
          exec_mode: (p.pm2_env as any)?.exec_mode,
        }))
        res.json({ success: true, processes })
      })
    });
  } catch (error: any) {
    console.error('[PM2] Error fetching process list:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
})

router.get('/network', async (_req, res) => {
  const data = await si.networkStats()
  res.json(data)
})

router.get('/docker', async (_req, res) => {
  const containers = await si.dockerContainers()
  res.json(containers)
})

router.get('/process', async (_req, res) => {
  const processes = await si.processes()
  res.json(processes)
})

export default router