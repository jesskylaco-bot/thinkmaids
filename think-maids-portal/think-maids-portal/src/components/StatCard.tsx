export default function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-1">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`tabular text-2xl font-semibold ${accent ? "text-accent" : "text-primary"}`}
      >
        {value}
      </p>
    </div>
  );
}
