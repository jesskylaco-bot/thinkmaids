import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEarningsSummary, getCommissionPercentage, calculateEarnings } from "@/lib/commission";
import CleanerShell from "@/components/CleanerShell";
import StatCard from "@/components/StatCard";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import type { Job } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");

  const db = getDb();
  const pct = getCommissionPercentage(user.id);
  const earnings = getEarningsSummary(user.id);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const allJobs = db
    .prepare(
      `SELECT * FROM jobs WHERE assigned_user_id = ? ORDER BY job_scheduled_start ASC`
    )
    .all(user.id) as Job[];

  const todaysJobs = allJobs.filter((j) => {
    const d = new Date(j.job_scheduled_start);
    return d >= todayStart && d < todayEnd;
  });

  const upcomingJobs = allJobs
    .filter((j) => new Date(j.job_scheduled_start) >= todayEnd)
    .slice(0, 5);

  const withEarnings = (j: Job): Job => ({
    ...j,
    estimated_commission: calculateEarnings(j.job_amount || 0, pct),
  });

  return (
    <CleanerShell user={user}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Today</h1>
          <p className="text-sm text-muted">
            {todaysJobs.length} job{todaysJobs.length === 1 ? "" : "s"} scheduled
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Earnings today" value={`$${earnings.today.toFixed(2)}`} />
          <StatCard label="Earnings this week" value={`$${earnings.week.toFixed(2)}`} accent />
          <StatCard label="Earnings this month" value={`$${earnings.month.toFixed(2)}`} />
          <StatCard label="Jobs today" value={String(todaysJobs.length)} accent />
        </div>

        <div className="flex flex-col gap-3">
          {todaysJobs.length === 0 ? (
            <EmptyState
              title="No jobs today"
              message="Nothing on the books for today — check Schedule for what's coming up."
            />
          ) : (
            todaysJobs.map((j) => <JobCard key={j.id} job={withEarnings(j)} />)
          )}
        </div>

        {upcomingJobs.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg">Coming up</h2>
            {upcomingJobs.map((j) => (
              <JobCard key={j.id} job={withEarnings(j)} />
            ))}
          </div>
        )}
      </div>
    </CleanerShell>
  );
}
