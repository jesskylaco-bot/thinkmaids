"use client";

import { useEffect, useRef, useState } from "react";

type Summary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; jobNumber?: string; message: string }[];
  unmatchedEmployees: string[];
};

type Unmatched = { id: number; alias: string; job_count: number };
type Cleaner = { id: number; name: string; active: number };

export default function ImportClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  const [unmatched, setUnmatched] = useState<Unmatched[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);

  async function loadUnmatched() {
    const [unmatchedRes, cleanersRes] = await Promise.all([
      fetch("/api/admin/aliases").then((r) => r.json()),
      fetch("/api/admin/cleaners").then((r) => r.json()),
    ]);
    setUnmatched(unmatchedRes.unmatched || []);
    setCleaners((cleanersRes.cleaners || []).filter((c: Cleaner) => c.active));
  }

  useEffect(() => {
    loadUnmatched();
  }, []);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    setSummary(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, filename: file.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
      } else {
        setSummary(data.summary);
        await loadUnmatched();
      }
    } catch {
      setError("Couldn't read or upload that file.");
    } finally {
      setUploading(false);
    }
  }

  async function mapAlias(aliasId: number, userId: number) {
    await fetch("/api/admin/aliases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliasId, userId }),
    });
    loadUnmatched();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl">Import schedule</h1>
        <p className="text-sm text-muted">
          Upload a Housecall Pro schedule export (.csv). Re-importing the same file
          updates existing jobs instead of duplicating them.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary-soft" : "border-border bg-surface-dim"
        }`}
      >
        <p className="font-display text-lg mb-1">
          {uploading ? "Importing…" : "Drop CSV here or click to browse"}
        </p>
        <p className="text-sm text-muted">.csv files exported from Housecall Pro</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-accent bg-accent-soft rounded-lg px-3 py-2">{error}</p>
      )}

      {summary && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="font-display text-lg mb-3">Import summary</h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            <SummaryStat label="Rows" value={summary.totalRows} />
            <SummaryStat label="Created" value={summary.created} />
            <SummaryStat label="Updated" value={summary.updated} />
            <SummaryStat label="Failed" value={summary.failed} />
          </div>
          {summary.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Row errors</p>
              <ul className="text-sm text-muted flex flex-col gap-1 max-h-48 overflow-y-auto">
                {summary.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}
                    {err.jobNumber ? ` (Job #${err.jobNumber})` : ""}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
          <h2 className="font-display text-lg mb-1">Unmatched employee names</h2>
          <p className="text-sm text-accent mb-3">
            These names appeared in an import but don&apos;t match a cleaner account yet.
            Map each one so its jobs show up on the right cleaner&apos;s schedule.
          </p>
          <div className="flex flex-col gap-2">
            {unmatched.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 bg-surface rounded-xl px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{u.alias}</p>
                  <p className="text-xs text-muted">
                    {u.job_count} job{u.job_count === 1 ? "" : "s"}
                  </p>
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) mapAlias(u.id, Number(e.target.value));
                  }}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                >
                  <option value="" disabled>
                    Map to cleaner…
                  </option>
                  {cleaners.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="tabular text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
