"use client";

import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { Job } from "@/lib/types";

function formatDateTime(iso: string) {
  if (!iso) return { date: "—", time: "—" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: iso, time: "" };
  return {
    date: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export default function JobCard({ job }: { job: Job }) {
  const { date, time } = formatDateTime(job.job_scheduled_start);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    job.address
  )}`;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted tabular">{date} · {time}</p>
          <h3 className="font-display text-lg leading-tight mt-0.5">{job.customer_name}</h3>
          <p className="text-sm text-muted mt-0.5">{job.service_type || job.description}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <p className="text-sm text-foreground/80">{job.address}</p>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <p className="text-xs text-muted">Estimated earnings</p>
          <p className="tabular text-lg font-semibold text-primary">
            ${(job.estimated_commission ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-3 rounded-full border border-border text-sm flex items-center gap-1.5 hover:border-primary hover:text-primary transition-colors"
          >
            Map
          </a>
          <Link
            href={`/jobs/${job.id}`}
            className="h-9 px-4 rounded-full bg-primary text-white text-sm flex items-center hover:bg-primary-deep transition-colors"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
