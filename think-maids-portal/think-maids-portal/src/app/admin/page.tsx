import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import StatCard from "@/components/StatCard";

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COUNT(*) as job_count, COALESCE(SUM(job_amount),0) as revenue FROM jobs`
    )
    .get() as { job_count: number; revenue: number };

  const cleanerCount = db
    .prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'cleaner' AND active = 1`)
    .get() as { c: number };

  const unmatchedCount = db
    .prepare(`SELECT COUNT(*) as c FROM employee_aliases WHERE user_id IS NULL`)
    .get() as { c: number };

  const lastImport = db
    .prepare(`SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 1`)
    .get() as
    | { filename: string; imported_at: string; created_count: number; updated_count: number; failed_count: number }
    | undefined;

  return (
    <AdminShell user={user}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Overview</h1>
          <p className="text-sm text-muted">Schedule and crew at a glance.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total jobs" value={String(totals.job_count)} />
          <StatCard label="Total revenue" value={`$${totals.revenue.toFixed(2)}`} accent />
          <StatCard label="Active cleaners" value={String(cleanerCount.c)} />
          <StatCard label="Unmatched names" value={String(unmatchedCount.c)} accent />
        </div>

        {unmatchedCount.c > 0 && (
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-accent">
              {unmatchedCount.c} employee name{unmatchedCount.c === 1 ? "" : "s"} from imports
              {" "}couldn&apos;t be matched to a cleaner account.
            </p>
            <Link
              href="/admin/import"
              className="shrink-0 text-sm font-medium underline text-accent"
            >
              Review
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="font-display text-lg mb-3">Last import</h2>
          {lastImport ? (
            <div className="text-sm flex flex-col gap-1">
              <p>
                <span className="text-muted">File:</span> {lastImport.filename}
              </p>
              <p>
                <span className="text-muted">When:</span> {lastImport.imported_at}
              </p>
              <p>
                <span className="text-muted">Created:</span> {lastImport.created_count}
                {"  "}
                <span className="text-muted ml-3">Updated:</span> {lastImport.updated_count}
                {"  "}
                <span className="text-muted ml-3">Failed:</span> {lastImport.failed_count}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">No imports yet.</p>
          )}
          <Link
            href="/admin/import"
            className="inline-flex mt-4 h-10 px-4 rounded-full bg-primary text-white text-sm items-center hover:bg-primary-deep transition-colors"
          >
            Import a schedule
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
