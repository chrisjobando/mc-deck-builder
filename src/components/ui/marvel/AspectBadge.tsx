import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AspectBadgeProps {
  aspect: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function AspectBadge({ aspect, className, size = 'sm' }: AspectBadgeProps) {
  const key = aspect.toLowerCase();
  return (
    <Badge
      className={cn(
        'border-transparent text-white',
        size === 'md' && 'h-6 px-3 text-sm',
        className
      )}
      style={{ backgroundColor: `var(--color-aspect-${key})` }}
    >
      {aspect}
    </Badge>
  );
}
