import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Single shared SQLite connection. Uses Node's built-in node:sqlite module
// (no native build step), stored as a file under /data so it persists
// across restarts and is trivial to back up or swap out later.
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "think-maids.db");

declare global {
  // eslint-disable-next-line no-var
  var __tmDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin','cleaner')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commission_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      percentage REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Maps a raw "Assigned employees" string from a Housecall Pro export
    -- (which can be misspelled, e.g. "Francesa Torres") to a real user.
    -- This is what lets the importer match cleaners correctly even when
    -- the export text is inconsistent, and lets an admin fix bad matches.
    CREATE TABLE IF NOT EXISTS employee_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_number TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      service_type TEXT,
      job_created_date TEXT,
      job_scheduled_start TEXT,
      job_scheduled_end TEXT,
      assigned_employee_raw TEXT,
      assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      job_amount REAL DEFAULT 0,
      due_amount REAL DEFAULT 0,
      notes TEXT,
      special_instructions TEXT,
      tags TEXT,
      is_recurring INTEGER DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'csv_import',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_assigned_user ON jobs(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(job_scheduled_start);

    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      imported_by INTEGER REFERENCES users(id),
      total_rows INTEGER NOT NULL DEFAULT 0,
      created_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      errors TEXT
    );
  `);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__tmDb) {
    globalThis.__tmDb = createConnection();
  }
  return globalThis.__tmDb;
}
