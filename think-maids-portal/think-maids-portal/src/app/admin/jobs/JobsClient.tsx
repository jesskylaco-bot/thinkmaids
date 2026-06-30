"use client";

import { useEffect, useState, useCallback } from "react";
import StatusBadge from "@/components/StatusBadge";
import type { Job, Cleaner } from "@/lib/types";

const STATUSES = ["Scheduled", "In progress", "Completed"];

export default function JobsClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cleanerId, setCleanerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Job | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (cleanerId) params.set("cleanerId", cleanerId);
    const res = await fetch(`/api/admin/jobs?${params}`);
    const data = await res.json();
    setJobs(data.jobs || []);
    setLoading(false);
  }, [q, status, cleanerId]);

  useEffect(() => {
    fetch("/api/admin/cleaners")
      .then((r) => r.json())
      .then((d) => setCleaners(d.cleaners || []));
  }, []);

  useEffect(() => {
    const t = setTimeout(loadJobs, 250);
    return () => clearTimeout(t);
  }, [loadJobs]);

  async function saveEdit(job: Job, fields: Partial<Job>) {
    const res = await fetch(`/api/admin/jobs/${job.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok) {
      setEditing(null);
      loadJobs();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Jobs</h1>
        <p className="text-sm text-muted">Search, filter, and edit any scheduled job.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer, job #, address…"
          className="h-10 flex-1 min-w-[200px] rounded-xl border border-border bg-surface px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={cleanerId}
          onChange={(e) => setCleanerId(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-2 text-sm"
        >
          <option value="">All cleaners</option>
          {cleaners.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-dim text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Job #</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Cleaner</th>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    No jobs match your filters.
                  </td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => setEditing(j)}
                    className="border-t border-border hover:bg-surface-dim cursor-pointer"
                  >
                    <td className="px-3 py-2 tabular">{j.job_number}</td>
                    <td className="px-3 py-2">{j.customer_name}</td>
                    <td className="px-3 py-2">{j.cleaner_name || "Unassigned"}</td>
                    <td className="px-3 py-2 tabular">
                      {j.job_scheduled_start
                        ? new Date(j.job_scheduled_start).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="px-3 py-2 tabular text-right">
                      ${(j.job_amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditJobModal
          job={editing}
          cleaners={cleaners}
          onClose={() => setEditing(null)}
          onSave={(fields) => saveEdit(editing, fields)}
        />
      )}
    </div>
  );
}

function EditJobModal({
  job,
  cleaners,
  onClose,
  onSave,
}: {
  job: Job;
  cleaners: Cleaner[];
  onClose: () => void;
  onSave: (fields: Partial<Job>) => void;
}) {
  const [status, setStatus] = useState(job.status);
  const [assignedUserId, setAssignedUserId] = useState(
    job.assigned_user_id ? String(job.assigned_user_id) : ""
  );
  const [jobAmount, setJobAmount] = useState(String(job.job_amount ?? 0));
  const [notes, setNotes] = useState(job.notes || "");

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[85vh] overflow-y-auto"
      >
        <h2 className="font-display text-lg">
          Job #{job.job_number} — {job.customer_name}
        </h2>

        <label className="text-sm flex flex-col gap-1">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-2"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm flex flex-col gap-1">
          Assigned cleaner
          <select
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-2"
          >
            <option value="">Unassigned</option>
            {cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm flex flex-col gap-1">
          Job amount ($)
          <input
            value={jobAmount}
            onChange={(e) => setJobAmount(e.target.value)}
            type="number"
            step="0.01"
            className="h-10 rounded-xl border border-border bg-background px-3"
          />
        </label>

        <label className="text-sm flex flex-col gap-1">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>

        <div className="flex gap-2 mt-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-border text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                status,
                assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
                job_amount: Number(jobAmount) || 0,
                notes,
              })
            }
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm hover:bg-primary-deep"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
