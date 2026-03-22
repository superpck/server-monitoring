import { JwtPayload } from 'jsonwebtoken'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload | string | null
    }
  }
}

export interface AgentConfig {
  id: string
  name: string
  group: string
  url: string
  server_key: string
}

/** Agent config exposed to UI — server_key is never sent to clients */
export type AgentPublic = Omit<AgentConfig, 'server_key'>
