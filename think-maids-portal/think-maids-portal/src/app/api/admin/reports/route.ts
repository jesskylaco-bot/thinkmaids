import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calculateEarnings } from "@/lib/commission";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();

  const revenue = db
    .prepare(
      `SELECT
        COALESCE(SUM(job_amount), 0) as total_revenue,
        COALESCE(SUM(due_amount), 0) as total_due,
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled_jobs,
        SUM(CASE WHEN status = 'In progress' THEN 1 ELSE 0 END) as in_progress_jobs
       FROM jobs`
    )
    .get();

  const cleaners = db
    .prepare(
      `SELECT u.id, u.name, cs.percentage as commission_percentage,
              COUNT(j.id) as job_count,
              COALESCE(SUM(j.job_amount), 0) as total_job_amount
       FROM users u
       LEFT JOIN commission_settings cs ON cs.user_id = u.id
       LEFT JOIN jobs j ON j.assigned_user_id = u.id
       WHERE u.role = 'cleaner' AND u.active = 1
       GROUP BY u.id
       ORDER BY total_job_amount DESC`
    )
    .all() as {
    id: number;
    name: string;
    commission_percentage: number | null;
    job_count: number;
    total_job_amount: number;
  }[];

  const payroll = cleaners.map((c) => ({
    id: c.id,
    name: c.name,
    commissionPercentage: c.commission_percentage ?? 0,
    jobCount: c.job_count,
    totalJobAmount: c.total_job_amount,
    estimatedPayout: calculateEarnings(c.total_job_amount, c.commission_percentage ?? 0),
  }));

  return NextResponse.json({ revenue, payroll });
}
