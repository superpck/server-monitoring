import { AgentConfig } from './types'

// ── Admin credentials & JWT ───────────────────────────────────────────────────
export const ADMIN_PASSWORD        = process.env.ADMIN_PASSWORD ?? ''
export const USER_MONITOR_PASSWORD = process.env.USER_MONITOR_PASSWORD ?? ''
export const JWT_SECRET            = process.env.JWT_SECRET ?? ''
export const JWT_EXPIRES_IN        = (process.env.JWT_EXPIRES_IN ?? '8h') as string

if (!ADMIN_PASSWORD) console.error('[config] ADMIN_PASSWORD is not set')
if (!JWT_SECRET)     console.error('[config] JWT_SECRET is not set — login will fail')

// ── Machine-to-machine static key (optional fallback) ────────────────────────

export const UI_API_KEY = process.env.UI_API_KEY ?? ''

// ── Agents ────────────────────────────────────────────────────────────────────

function parseAgents(): AgentConfig[] {
  const raw = process.env.AGENTS
  if (!raw) {
    console.warn('[config] AGENTS env var is not set — no agents configured')
    return []
  }
  try {
    const list = JSON.parse(raw) as AgentConfig[]
    if (!Array.isArray(list)) throw new Error('AGENTS must be a JSON array')
    for (const a of list) {
      if (!a.id || !a.url || !a.server_key) {
        throw new Error(`Agent entry missing required fields (id, url, server_key): ${JSON.stringify(a)}`)
      }
    }
    return list
  } catch (err: any) {
    console.error('[config] Failed to parse AGENTS:', err.message)
    console.error('[config] Hint: wrap the value in single quotes in .env if it contains special chars')
    return []
  }
}

export const agents: AgentConfig[] = parseAgents()

export function getAgentById(id: string): AgentConfig | undefined {
  return agents.find(a => a.id === id)
}
