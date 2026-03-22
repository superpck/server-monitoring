import { RequestHandler } from 'express'
import mysql from 'mysql2/promise'
import { Client as PgClient } from 'pg'
import * as mssql from 'mssql'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbVendor = 'mysql' | 'mariadb' | 'percona' | 'pgsql' | 'mssql'

export interface DbInstance {
  id: string
  vendor: DbVendor
  enabled?: boolean
  host: string
  port: number
  user: string
  password: string
  database: string
}

// ── Config from .env ──────────────────────────────────────────────────────────

/**
 * Returns enabled DB instances from DB_INSTANCES env var (JSON array).
 * Returns [] if DB_MONITOR_ENABLED !== 'true' or parsing fails.
 */
export function getInstances(): DbInstance[] {
  if (process.env.DB_MONITOR_ENABLED !== 'true') return []
  const raw = process.env.DB_INSTANCES;

  if (!raw) return []
  try {
    const list = JSON.parse(raw) as DbInstance[]
    return list.filter(inst => inst.enabled !== false)
  } catch {
    console.error('[dbMonitor] Failed to parse DB_INSTANCES — invalid JSON')
    console.error('[dbMonitor] Hint: If the value contains special characters such as # (e.g. in passwords), wrap the entire value in single quotes in your .env file:')
    console.error("  DB_INSTANCES='[{\"password\":\"#secret--#\", ...}]'")
    return []
  }
}

// ── Guard middleware ──────────────────────────────────────────────────────────

/**
 * Blocks any database monitoring route when DB_MONITOR_ENABLED !== 'true'.
 */
export const dbMonitorGuard: RequestHandler = (_req, res, next) => {
  if (process.env.DB_MONITOR_ENABLED !== 'true') {
    res.json({ success: false, status: 503, message: 'Database monitoring is disabled' })
    return
  }
  next()
}

// ── Per-vendor metric fetchers ────────────────────────────────────────────────

async function getMysqlMetrics(inst: DbInstance) {
  const conn = await mysql.createConnection({
    host: inst.host,
    port: inst.port,
    user: inst.user,
    password: inst.password,
    database: inst.database,
    connectTimeout: 5000,
  })
  try {
    const [statusRows] = await conn.query<mysql.RowDataPacket[]>(
      `SHOW GLOBAL STATUS WHERE Variable_name IN
        ('Threads_connected','Threads_running','Questions','Uptime',
         'Connections','Slow_queries','Aborted_connects')`
    )
    const status: Record<string, string> = {}
    for (const row of statusRows) status[row.Variable_name] = row.Value

    const [varRows] = await conn.query<mysql.RowDataPacket[]>(
      `SHOW VARIABLES WHERE Variable_name = 'max_connections'`
    )
    const maxConnections = Number(varRows[0]?.Value ?? 0)
    const threadsConnected = Number(status['Threads_connected'] ?? 0)

    const [verRows] = await conn.query<mysql.RowDataPacket[]>('SELECT VERSION() AS version')
    return {
      version: verRows[0]?.version as string,
      status,
      connections: {
        current: threadsConnected,
        running: Number(status['Threads_running'] ?? 0),
        max: maxConnections,
        usage_pct: maxConnections > 0 ? Math.round((threadsConnected / maxConnections) * 100) : null,
      },
    }
  } finally {
    await conn.end()
  }
}

async function getPgsqlMetrics(inst: DbInstance) {
  const client = new PgClient({
    host: inst.host,
    port: inst.port,
    user: inst.user,
    password: inst.password,
    database: inst.database,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()
  try {
    const [verRes, connRes, maxRes, dbRes] = await Promise.all([
      client.query<{ version: string }>('SELECT version()'),
      client.query<{ connections: number }>(
        `SELECT count(*)::int AS connections FROM pg_stat_activity`
      ),
      client.query<{ setting: string }>(
        `SELECT setting FROM pg_settings WHERE name = 'max_connections'`
      ),
      client.query(
        `SELECT numbackends, xact_commit, xact_rollback,
                blks_read, blks_hit, tup_returned, tup_fetched
         FROM pg_stat_database WHERE datname = $1`,
        [inst.database]
      ),
    ])
    const current = connRes.rows[0]?.connections ?? 0
    const max = Number(maxRes.rows[0]?.setting ?? 0)
    return {
      version: verRes.rows[0]?.version ?? null,
      connections: {
        current,
        max,
        usage_pct: max > 0 ? Math.round((current / max) * 100) : null,
      },
      stats: dbRes.rows[0] ?? null,
    }
  } finally {
    await client.end()
  }
}

async function getMssqlMetrics(inst: DbInstance) {
  const pool = await mssql.connect({
    server: inst.host,
    port: inst.port,
    user: inst.user,
    password: inst.password,
    database: inst.database,
    options: { trustServerCertificate: true },
    connectionTimeout: 5000,
  })
  try {
    const [verResult, connResult, maxResult] = await Promise.all([
      pool.request().query<{ version: string }>('SELECT @@VERSION AS version'),
      pool
        .request()
        .query<{ connections: number }>(
          'SELECT COUNT(*) AS connections FROM sys.dm_exec_sessions WHERE is_user_process = 1'
        ),
      pool
        .request()
        .query<{ max: number }>(
          `SELECT CAST(value_in_use AS INT) AS max
           FROM sys.configurations WHERE name = 'user connections'`
        ),
    ])
    const current = connResult.recordset[0]?.connections ?? 0
    // SQL Server 0 = unlimited (physical max ~32767)
    const max = maxResult.recordset[0]?.max ?? 0
    return {
      version: (verResult.recordset[0]?.version ?? '').split('\n')[0],
      connections: {
        current,
        max: max === 0 ? 32767 : max,
        usage_pct: Math.round((current / (max === 0 ? 32767 : max)) * 100),
      },
    }
  } finally {
    await pool.close()
  }
}

// ── Per-vendor active query fetchers ─────────────────────────────────────────

async function getMysqlActiveQueries(inst: DbInstance) {
  const conn = await mysql.createConnection({
    host: inst.host,
    port: inst.port,
    user: inst.user,
    password: inst.password,
    database: inst.database,
    connectTimeout: 5000,
  })
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT ID         AS id,
              USER       AS user,
              HOST       AS host,
              DB         AS db,
              COMMAND    AS command,
              TIME       AS time_sec,
              STATE      AS state,
              INFO       AS query
       FROM information_schema.PROCESSLIST
       WHERE COMMAND != 'Sleep'
         AND USER NOT IN ('system user', 'event_scheduler', 'replicator')
       ORDER BY TIME DESC`
    )
    return rows
  } finally {
    await conn.end()
  }
}

async function getPgsqlActiveQueries(inst: DbInstance) {
  const client = new PgClient({
    host: inst.host,
    port: inst.port,
    user: inst.user,
    password: inst.password,
    database: inst.database,
    connectionTimeoutMillis: 5000,
  })
  await client.connect()
  try {
    const { rows } = await client.query(
      `SELECT pid,
              usename          AS user,
              application_name AS application,
              client_addr      AS client,
              state,
              wait_event_type,
              wait_event,
              EXTRACT(EPOCH FROM (now() - query_start))::int AS duration_sec,
              query
       FROM pg_stat_activity
       WHERE state != 'idle'
         AND query NOT ILIKE '%pg_stat_activity%'
         AND usename NOT IN ('event_scheduler', 'replicator')
         AND usename NOT LIKE 'pg_%'
       ORDER BY duration_sec DESC NULLS LAST`
    )
    return rows
  } finally {
    await client.end()
  }
}

async function getMssqlActiveQueries(inst: DbInstance) {
  const pool = await mssql.connect({
    server: inst.host,
    port: inst.port,
    user: inst.user,
    password: inst.password,
    database: inst.database,
    options: { trustServerCertificate: true },
    connectionTimeout: 5000,
  })
  try {
    const result = await pool.request().query(
      `SELECT r.session_id                                          AS id,
              s.login_name                                          AS [user],
              r.status,
              r.command,
              r.wait_type,
              r.wait_time                                           AS wait_ms,
              r.cpu_time                                            AS cpu_ms,
              r.total_elapsed_time                                  AS elapsed_ms,
              SUBSTRING(qt.text, (r.statement_start_offset/2)+1,
                ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(qt.text)
                  ELSE r.statement_end_offset END - r.statement_start_offset)/2)+1
              )                                                     AS query
       FROM   sys.dm_exec_requests r
       JOIN   sys.dm_exec_sessions s ON s.session_id = r.session_id
       CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) qt
       WHERE  r.session_id != @@SPID
         AND  s.is_user_process = 1
         AND  s.login_name NOT IN ('event_scheduler', 'replicator')
       ORDER  BY r.total_elapsed_time DESC`
    )
    return result.recordset
  } finally {
    await pool.close()
  }
}

// ── Public dispatcher ─────────────────────────────────────────────────────────

export async function fetchActiveQueries(inst: DbInstance) {
  if (['mysql', 'mariadb', 'percona'].includes(inst.vendor)) {
    return getMysqlActiveQueries(inst)
  }
  if (inst.vendor === 'pgsql') return getPgsqlActiveQueries(inst)
  if (inst.vendor === 'mssql') return getMssqlActiveQueries(inst)
  throw new Error(`Unsupported vendor: ${inst.vendor}`)
}

export async function fetchMetrics(inst: DbInstance) {
  if (['mysql', 'mariadb', 'percona'].includes(inst.vendor)) {
    return getMysqlMetrics(inst)
  }
  if (inst.vendor === 'pgsql') return getPgsqlMetrics(inst)
  if (inst.vendor === 'mssql') return getMssqlMetrics(inst)
  throw new Error(`Unsupported vendor: ${inst.vendor}`)
}
