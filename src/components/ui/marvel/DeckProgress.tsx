import { cn } from '@/lib/utils';

interface DeckProgressProps {
  count: number;
  min?: number;
  max?: number;
  className?: string;
}

export function DeckProgress({ count, min = 40, max = 50, className }: DeckProgressProps) {
  const pct = Math.min(100, Math.round((count / max) * 100));
  const barColor =
    count > max ? 'bg-red-500' :
    count >= min ? 'bg-green-500' :
    'bg-primary';

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div
        className={cn('h-full rounded-full transition-all', barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
