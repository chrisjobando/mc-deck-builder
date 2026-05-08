import { cn } from '@/lib/utils';

interface StatBoxProps {
  value: string | number | null;
  label: string;
  /** Tailwind text-color class */
  color?: string;
  /**
   * md — standard size (CardModal stats)
   * xs — compact size (DeckGrid panel)
   */
  size?: 'xs' | 'md';
}

export function StatBox({ value, label, color, size = 'md' }: StatBoxProps) {
  if (size === 'xs') {
    return (
      <div className="rounded bg-black/30 px-2 py-1.5 text-center">
        <p className={cn('text-sm font-bold leading-none', color)}>{value ?? '—'}</p>
        <p className="mt-0.5 text-[9px] leading-none text-muted-foreground">{label}</p>
      </div>
    );
  }
  return (
    <div className="min-w-[60px] rounded-lg bg-black/30 p-3 text-center">
      <div className={cn('text-2xl font-bold', color)}>{value ?? '—'}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
