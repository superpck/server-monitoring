import { Router } from 'express'
import { exec } from 'child_process'

const router = Router()

function run(cmd: string) {
  return new Promise<string>((resolve, reject) => {
    exec(cmd, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

router.get('/service', async (req, res) => {

  const name = String(req.query.name || 'nginx')
  const lines = Number(req.query.lines || 50)

  const cmd = `journalctl -u ${name} -n ${lines} --no-pager`

  try {
    const log = await run(cmd)

    res.json({
      service: name,
      log
    })

  } catch (err) {

    res.status(500).json({ status: 500, message: 'cannot read log' })

  }

})

router.get('/file', async (req, res) => {

  const path = String(req.query.path)

  const cmd = `tail -n 50 ${path}`

  try {

    const log = await run(cmd)

    res.json({ log })

  } catch {

    res.status(500).json({ status: 500, message: 'cannot read file log' })

  }

})

export default router