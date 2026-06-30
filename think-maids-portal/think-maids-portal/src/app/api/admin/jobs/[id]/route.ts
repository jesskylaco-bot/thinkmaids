import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const db = getDb();
  const job = db
    .prepare(
      `SELECT j.*, u.name as cleaner_name FROM jobs j
       LEFT JOIN users u ON u.id = j.assigned_user_id WHERE j.id = ?`
    )
    .get(Number(id));
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "description",
    "status",
    "customer_name",
    "customer_phone",
    "customer_email",
    "address",
    "city",
    "state",
    "zip",
    "service_type",
    "job_scheduled_start",
    "job_scheduled_end",
    "assigned_user_id",
    "job_amount",
    "due_amount",
    "notes",
    "special_instructions",
    "tags",
  ];

  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const db = getDb();
  values.push(Number(id));
  db.prepare(
    `UPDATE jobs SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`
  ).run(...values);

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(Number(id));
  return NextResponse.json({ job });
}
