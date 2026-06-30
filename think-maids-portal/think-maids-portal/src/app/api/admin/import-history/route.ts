import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ih.*, u.name as imported_by_name
       FROM import_history ih
       LEFT JOIN users u ON u.id = ih.imported_by
       ORDER BY ih.imported_at DESC LIMIT 25`
    )
    .all();
  return NextResponse.json({ history: rows });
}
