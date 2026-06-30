"use client";

import { useEffect, useState } from "react";
import type { Cleaner } from "@/lib/types";

export default function CommissionClient() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [rates, setRates] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/admin/cleaners");
    const data = await res.json();
    const list: Cleaner[] = data.cleaners || [];
    setCleaners(list);
    setRates(
      Object.fromEntries(list.map((c) => [c.id, String(c.commission_percentage ?? 0)]))
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function save(id: number) {
    await fetch(`/api/admin/cleaners/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPercentage: Number(rates[id]) }),
    });
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Commission</h1>
        <p className="text-sm text-muted">
          Configurable per cleaner — earnings everywhere in the app use this rate.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {cleaners.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">
                {c.active ? "Active" : "Inactive"} · {c.job_count ?? 0} jobs total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={rates[c.id] ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, [c.id]: e.target.value }))}
                type="number"
                step="0.1"
                className="w-20 h-9 rounded-lg border border-border bg-background px-2 text-sm tabular text-right"
              />
              <span className="text-sm text-muted">%</span>
              <button
                onClick={() => save(c.id)}
                className="h-9 px-3 rounded-lg bg-primary text-white text-sm hover:bg-primary-deep"
              >
                {saved === c.id ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        ))}
        {cleaners.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted text-center">No cleaner accounts yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface-dim p-4 text-sm text-muted">
        <p className="font-medium text-foreground mb-1">How earnings are calculated</p>
        <p>Estimated earnings = Job total × commission percentage. For example, a $250 job at 63% commission estimates $157.50.</p>
      </div>
    </div>
  );
}
