import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();
  const cleanerId = searchParams.get("cleanerId")?.trim();

  const db = getDb();
  let sql = `
    SELECT j.*, u.name as cleaner_name
    FROM jobs j
    LEFT JOIN users u ON u.id = j.assigned_user_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (q) {
    sql += ` AND (j.customer_name LIKE ? OR j.job_number LIKE ? OR j.address LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    sql += ` AND j.status = ?`;
    params.push(status);
  }
  if (cleanerId) {
    sql += ` AND j.assigned_user_id = ?`;
    params.push(Number(cleanerId));
  }

  sql += ` ORDER BY j.job_scheduled_start DESC LIMIT 500`;

  const jobs = db.prepare(sql).all(...params);
  return NextResponse.json({ jobs });
}
