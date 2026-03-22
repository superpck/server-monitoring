import path from 'path'
import dotenv from 'dotenv'
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
  debug: false
})

import express from 'express'
import cors from 'cors'
import routes from './routes'
import { securityGuard } from './middleware/security.middleware'
import dayjs from 'dayjs'

const app = express()
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  const raw = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || req.ip;
  const clientIp = Array.isArray(raw) ? raw[0] : (raw || '');
  console.log(dayjs().format(`HH:mm:ss`), `${clientIp} ${req.method} ${req.url}`)

  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
      return originalJson({ ...(body as object), clientIp});
    }
    return originalJson(body);
  }
  next()
})

// Validate X-Server-Key and (optionally) source IP before any route handler
app.use(securityGuard)

app.use('/', routes)

const PORT = Number(process.env.PORT || 3000)

const server = app.listen(PORT, () => {
  console.log(dayjs().format(`HH:mm:ss`), `Local API running on port ${PORT}`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use — another process may be running`, err.message)
  } else {
    console.error('[server] Server error:', err.message)
  }
  process.exit(1)
})