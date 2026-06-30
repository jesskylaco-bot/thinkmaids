import { getDb } from "./db";

export function getCommissionPercentage(userId: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT percentage FROM commission_settings WHERE user_id = ?")
    .get(userId) as { percentage: number } | undefined;
  return row?.percentage ?? 0;
}

export function calculateEarnings(jobAmount: number, commissionPercentage: number): number {
  return Math.round(jobAmount * (commissionPercentage / 100) * 100) / 100;
}

export type EarningsSummary = {
  todayCents: number;
  weekCents: number;
  monthCents: number;
  yearCents: number;
};

// All amounts returned as plain dollar floats (named *Cents for historical
// reasons isn't used — kept simple as dollars throughout the app).
export function getEarningsSummary(userId: number): {
  today: number;
  week: number;
  month: number;
  year: number;
} {
  const db = getDb();
  const pct = getCommissionPercentage(userId);

  const jobs = db
    .prepare(
      `SELECT job_amount, job_scheduled_start FROM jobs
       WHERE assigned_user_id = ? AND status != 'Cancelled'`
    )
    .all(userId) as { job_amount: number; job_scheduled_start: string }[];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  let today = 0,
    week = 0,
    month = 0,
    year = 0;

  for (const job of jobs) {
    const d = new Date(job.job_scheduled_start);
    if (isNaN(d.getTime())) continue;
    const earnings = calculateEarnings(job.job_amount, pct);
    if (d >= startOfYear) year += earnings;
    if (d >= startOfMonth) month += earnings;
    if (d >= startOfWeek) week += earnings;
    if (d >= startOfToday) today += earnings;
  }

  return {
    today: Math.round(today * 100) / 100,
    week: Math.round(week * 100) / 100,
    month: Math.round(month * 100) / 100,
    year: Math.round(year * 100) / 100,
  };
}
