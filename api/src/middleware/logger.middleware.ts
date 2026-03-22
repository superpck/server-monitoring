import { Request, Response, NextFunction } from 'express'
import dayjs from 'dayjs'

export function loggerMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
  console.log(dayjs().format('HH:mm:ss'), `${ip} ${req.method} ${req.url}`)
  next()
}
