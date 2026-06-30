import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { calculateEarnings } from "@/lib/commission";
import AdminShell from "@/components/AdminShell";
import StatCard from "@/components/StatCard";

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

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
    .get() as {
    total_revenue: number;
    total_due: number;
    total_jobs: number;
    completed_jobs: number;
    scheduled_jobs: number;
    in_progress_jobs: number;
  };

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

  return (
    <AdminShell user={user}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Reports</h1>
          <p className="text-sm text-muted">Revenue summary, payroll estimates, and cleaner performance.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total revenue" value={`$${revenue.total_revenue.toFixed(2)}`} accent />
          <StatCard label="Outstanding" value={`$${revenue.total_due.toFixed(2)}`} />
          <StatCard label="Completed jobs" value={String(revenue.completed_jobs)} />
          <StatCard label="Scheduled jobs" value={String(revenue.scheduled_jobs)} />
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-display text-lg">Payroll estimate by cleaner</h2>
            <p className="text-xs text-muted">All-time job totals × current commission rate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-dim text-left text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Cleaner</th>
                  <th className="px-4 py-2 font-medium text-right">Jobs</th>
                  <th className="px-4 py-2 font-medium text-right">Job total</th>
                  <th className="px-4 py-2 font-medium text-right">Rate</th>
                  <th className="px-4 py-2 font-medium text-right">Est. payout</th>
                </tr>
              </thead>
              <tbody>
                {cleaners.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 tabular text-right">{c.job_count}</td>
                    <td className="px-4 py-2 tabular text-right">
                      ${c.total_job_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 tabular text-right">
                      {c.commission_percentage ?? 0}%
                    </td>
                    <td className="px-4 py-2 tabular text-right font-semibold text-primary">
                      ${calculateEarnings(c.total_job_amount, c.commission_percentage ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {cleaners.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      No active cleaners yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
