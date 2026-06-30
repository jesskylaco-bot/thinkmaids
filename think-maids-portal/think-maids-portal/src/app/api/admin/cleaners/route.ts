import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const cleaners = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
              cs.percentage as commission_percentage,
              (SELECT COUNT(*) FROM jobs j WHERE j.assigned_user_id = u.id) as job_count
       FROM users u
       LEFT JOIN commission_settings cs ON cs.user_id = u.id
       WHERE u.role = 'cleaner'
       ORDER BY u.active DESC, u.name ASC`
    )
    .all();
  return NextResponse.json({ cleaners });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, commissionPercentage } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE lower(email) = ?")
    .get(String(email).toLowerCase().trim());
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, active)
       VALUES (?, ?, ?, 'cleaner', 1)`
    )
    .run(name.trim(), String(email).toLowerCase().trim(), passwordHash);

  const newId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO commission_settings (user_id, percentage) VALUES (?, ?)`
  ).run(newId, Number(commissionPercentage) || 0);

  // If a job import already referenced this name via an alias, attach it now.
  db.prepare(
    `UPDATE employee_aliases SET user_id = ? WHERE alias = ? AND user_id IS NULL`
  ).run(newId, name.trim().toLowerCase());
  db.prepare(
    `UPDATE jobs SET assigned_user_id = ? WHERE assigned_user_id IS NULL AND lower(assigned_employee_raw) = ?`
  ).run(newId, name.trim().toLowerCase());

  return NextResponse.json({ id: newId });
}
