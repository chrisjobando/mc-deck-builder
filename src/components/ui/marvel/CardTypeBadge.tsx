import { Badge } from '@/components/ui/badge';
import { formatType } from '@/lib/cardFormatting';

interface CardTypeBadgeProps {
  type: string;
  className?: string;
}

export function CardTypeBadge({ type, className }: CardTypeBadgeProps) {
  const key = type.replace(/_/g, '-');
  return (
    <Badge
      className={className}
      style={{ backgroundColor: `var(--color-type-${key})` }}
    >
      {formatType(type)}
    </Badge>
  );
}
