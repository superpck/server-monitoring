import { Router, Request, Response } from 'express'
import axios, { AxiosError } from 'axios'
import { auth } from '../middleware/auth.middleware'
import { getAgentById } from '../config'
import db from '../db/database'
import dayjs from 'dayjs'

const router = Router()

// Headers that must NOT be forwarded to the upstream agent
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  // Strip the UI's Authorization header — we'll replace it with server_key
  'authorization',
  // Strip host so axios uses the agent's host
  'host',
])

/**
 * ALL /proxy/:agentId/*path
 *
 * Proxies the request to the target agent and injects X-Server-Key.
 * The :agentId must match an id in the AGENTS config.
 *
 * Example:
 *   GET /proxy/dev-server/dashboard/summary
 *   → GET http://localhost:3003/dashboard/summary
 *       with header  X-Server-Key: <server_key>
 */
router.all('/:agentId/*path', auth, async (req: Request, res: Response) => {
  const agentId = Array.isArray(req.params['agentId']) ? req.params['agentId'][0] : req.params['agentId']
  // Express 5 wildcard params join segments with commas — derive the real path from req.path instead
  const agentPrefix = `/${agentId}/`
  const subPath: string = req.path.startsWith(agentPrefix) ? req.path.slice(agentPrefix.length) : ''

  // Look up agent: first from env AGENTS config, then from SQLite by numeric agentid
  let agent: { url: string; server_key: string; server_name?: string } | undefined = getAgentById(agentId)
  if (!agent) {
    const numId = Number(agentId)
    if (!isNaN(numId) && Number.isInteger(numId)) {
      const row = db
        .prepare<[number], { url: string; server_key: string; server_name: string }>(
          'SELECT url, server_key, server_name FROM server_agent WHERE agentid = ? AND isactive = 1'
        )
        .get(numId)
      if (row) agent = row
    }
  }

  if (!agent) {
    res.status(404).json({ error: 'Not Found', message: `Agent '${agentId}' is not configured` })
    return
  }

  // Build target URL — preserve query string
  const query = Object.keys(req.query).length
    ? '?' + new URLSearchParams(req.query as Record<string, string>).toString()
    : ''
  const targetUrl = `${agent.url}/${subPath}${query}`;

  // Forward safe request headers
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && typeof value === 'string') {
      forwardHeaders[key] = value
    }
  }
  forwardHeaders['x-server-key'] = agent.server_key;
  forwardHeaders['x-server-name'] = agent.server_name || 'unknown__agent';

  try {
    const upstream: any = await axios({
      method: req.method as any,
      url: targetUrl,
      headers: forwardHeaders,
      data: ['GET', 'HEAD', 'DELETE'].includes(req.method.toUpperCase()) ? undefined : req.body,
      responseType: 'stream',
      timeout: 30_000,
      // Don't throw on non-2xx so we can pass the status through
      validateStatus: () => true,
    });

    // Forward upstream response headers (exclude hop-by-hop)
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) {
        res.setHeader(key, value as string);
      }
    }
    res.status(upstream.status)
    upstream.data.pipe(res)
  } catch (err: any) {
    const axiosErr = err as AxiosError
    const status = axiosErr.response?.status || err.status || '';
    const message = axiosErr?.message || axiosErr?.code || 'Proxy error';
    console.error(dayjs().format('HH:mm:ss'), `[proxy] Unexpected error forwarding to ID ${agentId}: ${status} ${message}`);

    if (axiosErr.code === 'ECONNREFUSED') {
      return res.status(502).json({ status: 502, error: 'Bad Gateway', message: `Agent not found` })
    }
    if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
      return res.status(504).json({ status: 504, error: 'Gateway Timeout', message: `Agent '${agentId}' did not respond in time` })
    }
    res.status(500).json({
      status: 500, error: 'Internal Server Error',
      message
    });
  }
})

export default router
