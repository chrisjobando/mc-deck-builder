import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL } from '@/lib/sessionConstants';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={className}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
