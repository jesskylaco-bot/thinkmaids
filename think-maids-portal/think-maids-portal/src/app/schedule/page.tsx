import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getCommissionPercentage, calculateEarnings } from "@/lib/commission";
import CleanerShell from "@/components/CleanerShell";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import type { Job } from "@/lib/types";

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");

  const db = getDb();
  const pct = getCommissionPercentage(user.id);

  const jobs = db
    .prepare(
      `SELECT * FROM jobs WHERE assigned_user_id = ? ORDER BY job_scheduled_start ASC`
    )
    .all(user.id) as Job[];

  const now = new Date();
  const upcoming = jobs.filter((j) => new Date(j.job_scheduled_start) >= now);
  const past = jobs
    .filter((j) => new Date(j.job_scheduled_start) < now)
    .reverse()
    .slice(0, 15);

  const withEarnings = (j: Job): Job => ({
    ...j,
    estimated_commission: calculateEarnings(j.job_amount || 0, pct),
  });

  return (
    <CleanerShell user={user}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Schedule</h1>
          <p className="text-sm text-muted">Your jobs, in order — upcoming first.</p>
        </div>

        <div className="flex flex-col gap-3">
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              message="No upcoming jobs assigned to you right now."
            />
          ) : (
            upcoming.map((j) => <JobCard key={j.id} job={withEarnings(j)} />)
          )}
        </div>

        {past.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg text-muted">Recent</h2>
            {past.map((j) => (
              <JobCard key={j.id} job={withEarnings(j)} />
            ))}
          </div>
        )}
      </div>
    </CleanerShell>
  );
}
