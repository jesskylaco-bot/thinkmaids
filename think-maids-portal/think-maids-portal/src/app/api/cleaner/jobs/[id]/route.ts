import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCommissionPercentage, calculateEarnings } from "@/lib/commission";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  // Ownership is enforced in the WHERE clause itself, on the server, using
  // the verified session's user id — not by filtering a list client-side.
  const job = db
    .prepare(`SELECT * FROM jobs WHERE id = ? AND assigned_user_id = ?`)
    .get(Number(id), user.id) as Record<string, unknown> | undefined;

  if (!job) {
    return NextResponse.json(
      { error: "Job not found or not assigned to you." },
      { status: 404 }
    );
  }

  const pct = getCommissionPercentage(user.id);
  return NextResponse.json({
    job: {
      ...job,
      estimated_commission: calculateEarnings(Number(job.job_amount) || 0, pct),
      commission_percentage: pct,
    },
  });
}
