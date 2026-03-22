import path from 'path'
import dotenv from 'dotenv'
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
  debug: false,
})

import express from 'express'
import cors from 'cors'
import routes from './routes'
import { loggerMiddleware } from './middleware/logger.middleware'
import dayjs from 'dayjs'

const app = express()

app.use(cors())
app.use(express.json())
app.use(loggerMiddleware)

app.use('/', routes)

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

const PORT = Number(process.env.PORT || 4000)

const server = app.listen(PORT, () => {
  console.log(dayjs().format('HH:mm:ss'), `API Gateway running on port ${PORT}`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${PORT} is already in use`)
  } else {
    console.error('[server] Server error:', err.message)
  }
  process.exit(1)
})
