const STYLES: Record<string, string> = {
  Scheduled: "bg-primary-soft text-primary-deep",
  "In progress": "bg-accent-soft text-accent",
  Completed: "bg-surface-dim text-muted",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || "bg-surface-dim text-muted";
  return (
    <span
      className={`tag-tab inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${style}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {status || "Unknown"}
    </span>
  );
}
