import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCommissionPercentage, calculateEarnings } from "@/lib/commission";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  // Security note: this query is hard-scoped to the logged-in user's id from
  // the verified session — never to a client-supplied id — so a cleaner can
  // never request another cleaner's jobs by changing a parameter.
  const jobs = db
    .prepare(
      `SELECT * FROM jobs WHERE assigned_user_id = ? ORDER BY job_scheduled_start ASC`
    )
    .all(user.id) as Record<string, unknown>[];

  const pct = getCommissionPercentage(user.id);
  const enriched = jobs.map((j) => ({
    ...j,
    estimated_commission: calculateEarnings(Number(j.job_amount) || 0, pct),
  }));

  return NextResponse.json({ jobs: enriched, commissionPercentage: pct });
}
