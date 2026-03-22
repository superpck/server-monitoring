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
    groupid   INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT    NOT NULL,
    detail    TEXT    NOT NULL DEFAULT ''
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
    FOREIGN KEY (groupid) REFERENCES server_group(groupid) ON DELETE CASCADE
  );
`)

// Migrate existing DB: add columns if they don't exist yet
const cols = (db.prepare(`PRAGMA table_info(server_agent)`).all() as { name: string }[]).map(c => c.name)
if (!cols.includes('server_name')) {
  db.exec(`ALTER TABLE server_agent ADD COLUMN server_name TEXT NOT NULL DEFAULT ''`)
}
if (!cols.includes('server_key')) {
  db.exec(`ALTER TABLE server_agent ADD COLUMN server_key TEXT NOT NULL DEFAULT ''`)
}

export default db
