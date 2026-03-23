import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

const dataDir = path.resolve(__dirname, '../../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'servers.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS server_group (
    groupid    INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT    NOT NULL,
    detail     TEXT    NOT NULL DEFAULT '',
    seq        INTEGER NOT NULL DEFAULT 100
  );

  CREATE TABLE IF NOT EXISTS server_agent (
    agentid     INTEGER PRIMARY KEY AUTOINCREMENT,
    groupid     INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    detail      TEXT    NOT NULL DEFAULT '',
    url         TEXT    NOT NULL,
    server_name TEXT    NOT NULL DEFAULT '',
    server_key  TEXT    NOT NULL DEFAULT '',
    isactive    INTEGER NOT NULL DEFAULT 1,
    seq         INTEGER NOT NULL DEFAULT 100,
    FOREIGN KEY (groupid) REFERENCES server_group(groupid) ON DELETE CASCADE
  );
`)

// Migrate existing DB: add columns if they don't exist yet
const agentCols = (db.prepare(`PRAGMA table_info(server_agent)`).all() as { name: string }[]).map(c => c.name)
if (!agentCols.includes('server_name')) {
  db.exec(`ALTER TABLE server_agent ADD COLUMN server_name TEXT NOT NULL DEFAULT ''`)
}
if (!agentCols.includes('server_key')) {
  db.exec(`ALTER TABLE server_agent ADD COLUMN server_key TEXT NOT NULL DEFAULT ''`)
}
if (!agentCols.includes('seq')) {
  db.exec(`ALTER TABLE server_agent ADD COLUMN seq INTEGER NOT NULL DEFAULT 100`)
}

const groupCols = (db.prepare(`PRAGMA table_info(server_group)`).all() as { name: string }[]).map(c => c.name)
if (!groupCols.includes('seq')) {
  db.exec(`ALTER TABLE server_group ADD COLUMN seq INTEGER NOT NULL DEFAULT 100`)
}

export default db
