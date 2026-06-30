import Papa from "papaparse";
import { getDb } from "./db";

export type ImportRowError = {
  row: number;
  jobNumber?: string;
  message: string;
};

export type ImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: ImportRowError[];
  unmatchedEmployees: string[];
};

// Housecall Pro exports wrap numeric-looking IDs in an Excel "treat as text"
// formula: ="2" instead of just 2. Strip that wrapper if present.
function cleanJobNumber(raw: string): string {
  const trimmed = (raw || "").trim();
  const match = trimmed.match(/^="?([^"]*)"?$/);
  return (match ? match[1] : trimmed).trim();
}

function cleanCurrency(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Best-effort split of a combined "street, city, state zip" address string
// into parts. The export doesn't provide these separately, so this is a
// convenience parse for display — the full original string is always kept
// in `address` regardless of whether the split succeeds.
function splitAddress(full: string): { city: string; state: string; zip: string } {
  const parts = (full || "").split(",").map((p) => p.trim());
  if (parts.length < 2) return { city: "", state: "", zip: "" };
  const last = parts[parts.length - 1]; // "Washington, DC 20003" -> last chunk "DC 20003"
  const city = parts.length >= 3 ? parts[parts.length - 2] : "";
  const stateZipMatch = last.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/);
  return {
    city,
    state: stateZipMatch?.[1] ?? "",
    zip: stateZipMatch?.[2] ?? "",
  };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Looks up (or remembers) which user a raw "Assigned employees" string from
// the export maps to, via the employee_aliases table. Unmatched names are
// reported back so an admin can map them manually instead of jobs silently
// going unassigned.
function matchEmployee(rawName: string): number | null {
  const db = getDb();
  const name = rawName.trim();
  if (!name) return null;

  const aliasRow = db
    .prepare("SELECT user_id FROM employee_aliases WHERE alias = ?")
    .get(normalizeName(name)) as { user_id: number | null } | undefined;
  if (aliasRow) return aliasRow.user_id;

  // Try an exact (case-insensitive) match against existing users first.
  const userRow = db
    .prepare("SELECT id FROM users WHERE lower(name) = ? AND role = 'cleaner'")
    .get(normalizeName(name)) as { id: number } | undefined;

  if (userRow) {
    db.prepare(
      "INSERT OR IGNORE INTO employee_aliases (alias, user_id) VALUES (?, ?)"
    ).run(normalizeName(name), userRow.id);
    return userRow.id;
  }

  // Remember the alias as unmatched so the admin UI can list it for mapping.
  db.prepare(
    "INSERT OR IGNORE INTO employee_aliases (alias, user_id) VALUES (?, NULL)"
  ).run(normalizeName(name));
  return null;
}

export type RawJobRow = {
  "Job #"?: string;
  "Job description"?: string;
  "Job status"?: string;
  "Customer name"?: string;
  "Address"?: string;
  "Job created date"?: string;
  "Job scheduled start date"?: string;
  "Assigned employees"?: string;
  "Job amount"?: string;
  "Due amount"?: string;
  // Optional fields a future/different export might include — read them
  // when present so the importer doesn't need to change shape later.
  "Job scheduled end date"?: string;
  "Service type"?: string;
  "Phone"?: string;
  "Email"?: string;
  "Notes"?: string;
  "Special instructions"?: string;
  "Tags"?: string;
  "Recurring"?: string;
  [key: string]: string | undefined;
};

export function importCsv(
  csvText: string,
  filename: string,
  importedBy: number | null
): ImportSummary {
  const db = getDb();
  const parsed = Papa.parse<RawJobRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const summary: ImportSummary = {
    totalRows: parsed.data.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
    unmatchedEmployees: [],
  };

  const unmatched = new Set<string>();

  const upsert = db.prepare(`
    INSERT INTO jobs (
      job_number, description, status, customer_name, address, city, state, zip,
      service_type, job_created_date, job_scheduled_start, job_scheduled_end,
      assigned_employee_raw, assigned_user_id, job_amount, due_amount,
      notes, special_instructions, tags, is_recurring, source, updated_at
    ) VALUES (
      @job_number, @description, @status, @customer_name, @address, @city, @state, @zip,
      @service_type, @job_created_date, @job_scheduled_start, @job_scheduled_end,
      @assigned_employee_raw, @assigned_user_id, @job_amount, @due_amount,
      @notes, @special_instructions, @tags, @is_recurring, 'csv_import', datetime('now')
    )
    ON CONFLICT(job_number) DO UPDATE SET
      description = excluded.description,
      status = excluded.status,
      customer_name = excluded.customer_name,
      address = excluded.address,
      city = excluded.city,
      state = excluded.state,
      zip = excluded.zip,
      service_type = excluded.service_type,
      job_created_date = excluded.job_created_date,
      job_scheduled_start = excluded.job_scheduled_start,
      job_scheduled_end = excluded.job_scheduled_end,
      assigned_employee_raw = excluded.assigned_employee_raw,
      assigned_user_id = excluded.assigned_user_id,
      job_amount = excluded.job_amount,
      due_amount = excluded.due_amount,
      notes = excluded.notes,
      special_instructions = excluded.special_instructions,
      tags = excluded.tags,
      is_recurring = excluded.is_recurring,
      updated_at = datetime('now')
  `);

  const existsStmt = db.prepare("SELECT id FROM jobs WHERE job_number = ?");

  parsed.data.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-indexing
    try {
      const jobNumber = cleanJobNumber(row["Job #"] || "");
      const customerName = (row["Customer name"] || "").trim();

      if (!jobNumber) {
        summary.failed++;
        summary.errors.push({ row: rowNum, message: "Missing Job # — row skipped" });
        return;
      }
      if (!customerName) {
        summary.failed++;
        summary.errors.push({
          row: rowNum,
          jobNumber,
          message: "Missing Customer name — row skipped",
        });
        return;
      }

      const address = (row["Address"] || "").trim();
      const { city, state, zip } = splitAddress(address);

      const rawEmployee = (row["Assigned employees"] || "").trim();
      let assignedUserId: number | null = null;
      if (rawEmployee && rawEmployee.toLowerCase() !== "think maids") {
        assignedUserId = matchEmployee(rawEmployee);
        if (assignedUserId === null) unmatched.add(rawEmployee);
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
        service_type: row["Service type"] || row["Job description"] || "",
        job_created_date: row["Job created date"] || "",
        job_scheduled_start: row["Job scheduled start date"] || "",
        job_scheduled_end: row["Job scheduled end date"] || "",
        assigned_employee_raw: rawEmployee,
        assigned_user_id: assignedUserId,
        job_amount: cleanCurrency(row["Job amount"]),
        due_amount: cleanCurrency(row["Due amount"]),
        notes: row["Notes"] || "",
        special_instructions: row["Special instructions"] || "",
        tags: row["Tags"] || "",
        is_recurring: row["Recurring"] ? 1 : 0,
      });

      if (alreadyExists) summary.updated++;
      else summary.created++;
    } catch (err) {
      summary.failed++;
      summary.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "Unknown error processing row",
      });
    }
  });

  summary.unmatchedEmployees = Array.from(unmatched);

  db.prepare(
    `INSERT INTO import_history
      (filename, imported_by, total_rows, created_count, updated_count, failed_count, errors)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    filename,
    importedBy,
    summary.totalRows,
    summary.created,
    summary.updated,
    summary.failed,
    JSON.stringify(summary.errors)
  );

  return summary;
}
