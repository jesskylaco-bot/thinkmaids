"use client";

import { useEffect, useState } from "react";
import type { Cleaner } from "@/lib/types";

export default function CleanersClient() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/cleaners");
    const data = await res.json();
    setCleaners(data.cleaners || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(c: Cleaner) {
    await fetch(`/api/admin/cleaners/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Cleaners</h1>
          <p className="text-sm text-muted">Manage accounts, commission rates, and access.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="h-10 px-4 rounded-full bg-primary text-white text-sm hover:bg-primary-deep transition-colors"
        >
          + Add cleaner
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : cleaners.length === 0 ? (
          <p className="text-sm text-muted">No cleaner accounts yet.</p>
        ) : (
          cleaners.map((c) => (
            <CleanerRow key={c.id} cleaner={c} onChanged={load} onToggle={toggleActive} />
          ))
        )}
      </div>

      {showAdd && <AddCleanerModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}

function CleanerRow({
  cleaner,
  onChanged,
  onToggle,
}: {
  cleaner: Cleaner;
  onChanged: () => void;
  onToggle: (c: Cleaner) => void;
}) {
  const [editingRate, setEditingRate] = useState(false);
  const [rate, setRate] = useState(String(cleaner.commission_percentage ?? 0));

  async function saveRate() {
    await fetch(`/api/admin/cleaners/${cleaner.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionPercentage: Number(rate) }),
    });
    setEditingRate(false);
    onChanged();
  }

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 flex items-center justify-between gap-3 ${
        !cleaner.active ? "opacity-50" : ""
      }`}
    >
      <div>
        <p className="font-medium">{cleaner.name}</p>
        <p className="text-xs text-muted">
          {cleaner.email} · {cleaner.job_count ?? 0} jobs
          {!cleaner.active ? " · Inactive" : ""}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {editingRate ? (
          <div className="flex items-center gap-1">
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              type="number"
              step="0.1"
              className="w-16 h-9 rounded-lg border border-border bg-background px-2 text-sm tabular"
            />
            <span className="text-sm text-muted">%</span>
            <button
              onClick={saveRate}
              className="h-9 px-3 rounded-lg bg-primary text-white text-sm"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingRate(true)}
            className="tabular text-sm font-medium px-2 py-1 rounded-lg hover:bg-surface-dim"
          >
            {cleaner.commission_percentage ?? 0}% commission
          </button>
        )}

        <button
          onClick={() => onToggle(cleaner)}
          className="h-9 px-3 rounded-lg border border-border text-sm hover:border-accent hover:text-accent"
        >
          {cleaner.active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </div>
  );
}

function AddCleanerModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [commissionPercentage, setCommissionPercentage] = useState("60");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/cleaners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, commissionPercentage }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't add cleaner.");
      return;
    }
    onAdded();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3"
      >
        <h2 className="font-display text-lg">Add cleaner</h2>
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <input
          placeholder="Temporary password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <label className="text-sm flex items-center gap-2">
          Commission
          <input
            value={commissionPercentage}
            onChange={(e) => setCommissionPercentage(e.target.value)}
            type="number"
            step="0.1"
            className="w-20 h-9 rounded-lg border border-border bg-background px-2 tabular"
          />
          %
        </label>

        {error && <p className="text-sm text-accent">{error}</p>}

        <div className="flex gap-2 mt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name || !email || !password}
            className="flex-1 h-10 rounded-xl bg-primary text-white text-sm hover:bg-primary-deep disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add cleaner"}
          </button>
        </div>
      </div>
    </div>
  );
}
