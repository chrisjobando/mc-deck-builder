interface DeckProgressProps {
  count: number;
  min?: number;
  max?: number;
  className?: string;
}

export function DeckProgress({ count, min = 40, max = 50, className }: DeckProgressProps) {
  const pct = Math.min(100, Math.round((count / max) * 100));
  return (
    <div className={className}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}
