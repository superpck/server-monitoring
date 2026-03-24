import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { hashPassword } from '../utils/util'

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

// ── Users table ───────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userid     INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL DEFAULT '',
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'monitor' CHECK(role IN ('admin', 'monitor')),
    user_admin INTEGER NOT NULL DEFAULT 0
  );
`)

// Seed default users on first run (admin / Admin@1234, user1 / User1@1234)
const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
if (userCount === 0) {
  const insert = db.prepare('INSERT INTO users (username, name, password, role, user_admin) VALUES (?, ?, ?, ?, ?)')
  insert.run('admin', 'Admin Example', hashPassword('Admin@1234'), 'admin', 1)
  insert.run('user1', 'User Example', hashPassword('User1@1234'), 'monitor', 0)
}

export default db
