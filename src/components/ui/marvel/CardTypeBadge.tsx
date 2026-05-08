import { Badge } from '@/components/ui/badge';
import { formatType } from '@/lib/cardFormatting';
import { cn } from '@/lib/utils';

interface CardTypeBadgeProps {
  type: string;
  className?: string;
}

export function CardTypeBadge({ type, className }: CardTypeBadgeProps) {
  const key = type.replace(/_/g, '-');
  return (
    <Badge
      className={cn('border-transparent text-white', className)}
      style={{ backgroundColor: `var(--color-type-${key})` }}
    >
      {formatType(type)}
    </Badge>
  );
}
