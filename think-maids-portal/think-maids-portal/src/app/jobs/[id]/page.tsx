import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getCommissionPercentage, calculateEarnings } from "@/lib/commission";
import CleanerShell from "@/components/CleanerShell";
import StatusBadge from "@/components/StatusBadge";
import type { Job } from "@/lib/types";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");

  const { id } = await params;
  const db = getDb();
  // Ownership enforced server-side in the query itself, not by filtering a
  // list that was already sent to the browser.
  const job = db
    .prepare(`SELECT * FROM jobs WHERE id = ? AND assigned_user_id = ?`)
    .get(Number(id), user.id) as Job | undefined;

  if (!job) notFound();

  const pct = getCommissionPercentage(user.id);
  const earnings = calculateEarnings(job.job_amount || 0, pct);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    job.address
  )}`;
  const start = new Date(job.job_scheduled_start);

  return (
    <CleanerShell user={user}>
      <div className="flex flex-col gap-6">
        <Link href="/schedule" className="text-sm text-muted hover:text-primary">
          ← Back to schedule
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted tabular">Job #{job.job_number}</p>
            <h1 className="font-display text-2xl mt-0.5">{job.customer_name}</h1>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <Section title="Customer">
          <Field label="Name" value={job.customer_name} />
          <Field label="Phone" value={job.customer_phone || "Not provided"} />
          <Field label="Email" value={job.customer_email || "Not provided"} />
        </Section>

        <Section title="Property">
          <Field label="Address" value={job.address} />
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 mt-1 h-10 px-4 rounded-full bg-primary-soft text-primary-deep text-sm font-medium hover:bg-primary hover:text-white transition-colors"
          >
            Open in Google Maps
          </a>
        </Section>

        <Section title="Cleaning details">
          <Field label="Service type" value={job.service_type || job.description} />
          <Field
            label="Date"
            value={isNaN(start.getTime()) ? "—" : start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          />
          <Field
            label="Start time"
            value={isNaN(start.getTime()) ? "—" : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          />
          <Field
            label="End time"
            value={job.job_scheduled_end ? job.job_scheduled_end : "Not provided in export"}
          />
          <Field label="Notes" value={job.notes || "—"} />
          <Field label="Special instructions" value={job.special_instructions || "—"} />
        </Section>

        <Section title="Financial">
          <Field label="Job total" value={`$${(job.job_amount || 0).toFixed(2)}`} />
          <Field label="Your commission rate" value={`${pct}%`} />
          <Field label="Estimated earnings" value={`$${earnings.toFixed(2)}`} highlight />
        </Section>

        <Section title="Coming soon">
          <div className="grid grid-cols-2 gap-2">
            {["Before photos", "After photos", "Inspection checklist", "Customer signature"].map(
              (label) => (
                <div
                  key={label}
                  className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted text-center"
                >
                  {label}
                </div>
              )
            )}
          </div>
        </Section>
      </div>
    </CleanerShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2">
      <h2 className="font-display text-base mb-1">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1">
      <span className="text-muted">{label}</span>
      <span className={highlight ? "tabular font-semibold text-primary" : "text-right"}>
        {value}
      </span>
    </div>
  );
}
