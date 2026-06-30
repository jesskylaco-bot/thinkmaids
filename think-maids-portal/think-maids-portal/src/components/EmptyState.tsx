export default function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-dim p-8 text-center">
      <p className="font-display text-lg mb-1">{title}</p>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
