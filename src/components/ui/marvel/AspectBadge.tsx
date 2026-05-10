import { Badge } from '@/components/ui/badge';

interface AspectBadgeProps {
  aspect: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function AspectBadge({ aspect, className, size }: AspectBadgeProps) {
  const key = aspect.toLowerCase();
  return (
    <Badge
      className={className}
      style={{ backgroundColor: `var(--color-aspect-${key})` }}
    >
      {aspect}
    </Badge>
  );
}
