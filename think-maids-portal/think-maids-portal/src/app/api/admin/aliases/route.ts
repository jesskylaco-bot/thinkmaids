import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const unmatched = db
    .prepare(
      `SELECT a.id, a.alias,
              (SELECT COUNT(*) FROM jobs j WHERE lower(j.assigned_employee_raw) = a.alias) as job_count
       FROM employee_aliases a
       WHERE a.user_id IS NULL
       ORDER BY job_count DESC`
    )
    .all();
  return NextResponse.json({ unmatched });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { aliasId, userId } = await req.json();
  if (!aliasId || !userId) {
    return NextResponse.json({ error: "aliasId and userId are required." }, { status: 400 });
  }

  const db = getDb();
  const alias = db
    .prepare("SELECT alias FROM employee_aliases WHERE id = ?")
    .get(Number(aliasId)) as { alias: string } | undefined;
  if (!alias) return NextResponse.json({ error: "Alias not found." }, { status: 404 });

  db.prepare("UPDATE employee_aliases SET user_id = ? WHERE id = ?").run(
    Number(userId),
    Number(aliasId)
  );
  db.prepare(
    `UPDATE jobs SET assigned_user_id = ? WHERE lower(assigned_employee_raw) = ?`
  ).run(Number(userId), alias.alias);

  return NextResponse.json({ ok: true });
}
