// Seeds the database with an admin account, the active cleaner accounts,
// and imports the sample Housecall Pro export so the app has real data
// to look at right after setup.
//
// Run with: npm run seed
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import Papa from "papaparse";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "think-maids.db");
const CSV_PATH = path.join(__dirname, "..", "sample-data", "think-maids-housecall-export.csv");

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

function upsertUser(name, email, plainPassword, role, commissionPercentage) {
  const existing = db
    .prepare("SELECT id FROM users WHERE lower(email) = ?")
    .get(email.toLowerCase());
  const hash = bcrypt.hashSync(plainPassword, 10);
  let id;
  if (existing) {
    id = existing.id;
    db.prepare("UPDATE users SET name = ?, password_hash = ?, role = ?, active = 1 WHERE id = ?").run(
      name,
      hash,
      role,
      id
    );
  } else {
    const result = db
      .prepare(
        "INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)"
      )
      .run(name, email.toLowerCase(), hash, role);
    id = Number(result.lastInsertRowid);
  }
  if (commissionPercentage !== undefined) {
    db.prepare(
      `INSERT INTO commission_settings (user_id, percentage) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET percentage = excluded.percentage`
    ).run(id, commissionPercentage);
  }
  // Pre-register aliases so the importer matches even slightly-misspelled
  // export names (the real export has "Francesa Torres" without the second c).
  return id;
}

console.log("Seeding admin and cleaner accounts...");
upsertUser("Jess (Admin)", "admin@thinkmaids.com", "ChangeMe123!", "admin");
const roseId = upsertUser("Rose Belle", "rose@thinkmaids.com", "ChangeMe123!", "cleaner", 65);
const francescaId = upsertUser(
  "Francesca Torres",
  "francesca@thinkmaids.com",
  "ChangeMe123!",
  "cleaner",
  63
);

// Map known export-name variants to the right account, including the
// misspelling that shows up in the real Housecall Pro export.
const aliasMap = [
  ["rose belle", roseId],
  ["francesa torres", francescaId],
  ["francesca torres", francescaId],
];
for (const [alias, userId] of aliasMap) {
  db.prepare(
    `INSERT INTO employee_aliases (alias, user_id) VALUES (?, ?)
     ON CONFLICT(alias) DO UPDATE SET user_id = excluded.user_id`
  ).run(alias, userId);
}

// Former cleaners — kept as inactive aliases (no login) so their historical
// jobs still import and display a name, without being assignable going forward.
for (const formerName of ["samantha ayling", "vilma argueta", "yolanda padilla"]) {
  db.prepare(
    `INSERT OR IGNORE INTO employee_aliases (alias, user_id) VALUES (?, NULL)`
  ).run(formerName);
}

console.log("Importing sample CSV...");
if (fs.existsSync(CSV_PATH)) {
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  function cleanJobNumber(raw) {
    const trimmed = (raw || "").trim();
    const match = trimmed.match(/^="?([^"]*)"?$/);
    return (match ? match[1] : trimmed).trim();
  }
  function cleanCurrency(raw) {
    if (!raw) return 0;
    const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  function splitAddress(full) {
    const parts = (full || "").split(",").map((p) => p.trim());
    if (parts.length < 2) return { city: "", state: "", zip: "" };
    const last = parts[parts.length - 1];
    const city = parts.length >= 3 ? parts[parts.length - 2] : "";
    const stateZipMatch = last.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/);
    return { city, state: stateZipMatch?.[1] ?? "", zip: stateZipMatch?.[2] ?? "" };
  }

  const upsert = db.prepare(`
    INSERT INTO jobs (
      job_number, description, status, customer_name, address, city, state, zip,
      service_type, job_created_date, job_scheduled_start, assigned_employee_raw,
      assigned_user_id, job_amount, due_amount, source, updated_at
    ) VALUES (
      @job_number, @description, @status, @customer_name, @address, @city, @state, @zip,
      @service_type, @job_created_date, @job_scheduled_start, @assigned_employee_raw,
      @assigned_user_id, @job_amount, @due_amount, 'csv_import', datetime('now')
    )
    ON CONFLICT(job_number) DO UPDATE SET
      description=excluded.description, status=excluded.status, customer_name=excluded.customer_name,
      address=excluded.address, city=excluded.city, state=excluded.state, zip=excluded.zip,
      service_type=excluded.service_type, job_created_date=excluded.job_created_date,
      job_scheduled_start=excluded.job_scheduled_start, assigned_employee_raw=excluded.assigned_employee_raw,
      assigned_user_id=excluded.assigned_user_id, job_amount=excluded.job_amount, due_amount=excluded.due_amount,
      updated_at=datetime('now')
  `);
  const existsStmt = db.prepare("SELECT id FROM jobs WHERE job_number = ?");
  const aliasLookup = db.prepare("SELECT user_id FROM employee_aliases WHERE alias = ?");

  let created = 0,
    updated = 0,
    failed = 0;

  for (const row of parsed.data) {
    const jobNumber = cleanJobNumber(row["Job #"] || "");
    const customerName = (row["Customer name"] || "").trim();
    if (!jobNumber || !customerName) {
      failed++;
      continue;
    }
    const address = (row["Address"] || "").trim();
    const { city, state, zip } = splitAddress(address);
    const rawEmployee = (row["Assigned employees"] || "").trim();
    let assignedUserId = null;
    if (rawEmployee && rawEmployee.toLowerCase() !== "think maids") {
      const aliasRow = aliasLookup.get(rawEmployee.toLowerCase());
      assignedUserId = aliasRow ? aliasRow.user_id : null;
      if (!aliasRow) {
        db.prepare(
          "INSERT OR IGNORE INTO employee_aliases (alias, user_id) VALUES (?, NULL)"
        ).run(rawEmployee.toLowerCase());
      }
    }
    const alreadyExists = !!existsStmt.get(jobNumber);
    upsert.run({
      job_number: jobNumber,
      description: row["Job description"] || "",
      status: row["Job status"] || "",
      customer_name: customerName,
      address,
      city,
      state,
      zip,
      service_type: row["Job description"] || "",
      job_created_date: row["Job created date"] || "",
      job_scheduled_start: row["Job scheduled start date"] || "",
      assigned_employee_raw: rawEmployee,
      assigned_user_id: assignedUserId,
      job_amount: cleanCurrency(row["Job amount"]),
      due_amount: cleanCurrency(row["Due amount"]),
    });
    if (alreadyExists) updated++;
    else created++;
  }

  db.prepare(
    `INSERT INTO import_history (filename, imported_by, total_rows, created_count, updated_count, failed_count, errors)
     VALUES (?, NULL, ?, ?, ?, ?, '[]')`
  ).run("think-maids-housecall-export.csv (seed)", parsed.data.length, created, updated, failed);

  console.log(`Imported ${created} new jobs, updated ${updated}, failed ${failed}.`);
} else {
  console.log("No sample CSV found at " + CSV_PATH + " — skipping import.");
}

console.log("\nDone. Login with:");
console.log("  Admin:      admin@thinkmaids.com / ChangeMe123!");
console.log("  Cleaner:    rose@thinkmaids.com / ChangeMe123!");
console.log("  Cleaner:    francesca@thinkmaids.com / ChangeMe123!");
console.log("\n⚠ Change these passwords before using this with real data.");

db.close();
