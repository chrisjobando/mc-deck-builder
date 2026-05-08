import { cn } from '@/lib/utils';

interface AspectButtonProps {
  aspect: string;
  isSelected: boolean;
  isRecommended?: boolean;
  recommendationReason?: string;
  onClick: () => void;
  className?: string;
}

export function AspectButton({
  aspect,
  isSelected,
  isRecommended,
  recommendationReason,
  onClick,
  className,
}: AspectButtonProps) {
  const key = aspect.toLowerCase();
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl p-4 text-white transition-all',
        'border-2 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'scale-105 border-white shadow-lg'
          : 'border-transparent opacity-70 hover:opacity-100',
        className
      )}
      style={{ backgroundColor: `var(--color-aspect-${key})` }}
    >
      <span className="text-lg font-bold">{aspect}</span>
      {isRecommended && (
        <span className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Recommended
        </span>
      )}
      {recommendationReason && (
        <p className="mt-1 text-center text-[10px] opacity-80">{recommendationReason}</p>
      )}
    </button>
  );
}
