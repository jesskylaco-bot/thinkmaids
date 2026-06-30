import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const cleanerId = Number(id);
  const body = await req.json();
  const db = getDb();

  if (typeof body.name === "string" || typeof body.email === "string") {
    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (typeof body.name === "string") {
      updates.push("name = ?");
      values.push(body.name.trim());
    }
    if (typeof body.email === "string") {
      updates.push("email = ?");
      values.push(body.email.toLowerCase().trim());
    }
    values.push(cleanerId);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }

  if (typeof body.active === "boolean") {
    db.prepare("UPDATE users SET active = ? WHERE id = ?").run(
      body.active ? 1 : 0,
      cleanerId
    );
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    const hash = await hashPassword(body.password);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, cleanerId);
  }

  if (
    body.commissionPercentage !== undefined &&
    body.commissionPercentage !== null &&
    body.commissionPercentage !== ""
  ) {
    db.prepare(
      `INSERT INTO commission_settings (user_id, percentage, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET percentage = excluded.percentage, updated_at = datetime('now')`
    ).run(cleanerId, Number(body.commissionPercentage));
  }

  const cleaner = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.active, cs.percentage as commission_percentage
       FROM users u LEFT JOIN commission_settings cs ON cs.user_id = u.id
       WHERE u.id = ?`
    )
    .get(cleanerId);

  return NextResponse.json({ cleaner });
}
