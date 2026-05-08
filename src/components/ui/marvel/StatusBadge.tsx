import { Badge } from '@/components/ui/badge';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/sessionConstants';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent text-xs font-medium',
        STATUS_COLOR[status] ?? 'bg-white/10 text-gray-400',
        className
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
