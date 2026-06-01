import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertOctagon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  type: 'critical' | 'warning';
  message: string;
  actionLabel: string | null;
  actionHref: string | null;
  onDismiss: () => void;
}

const config = {
  critical: {
    bg: 'bg-destructive/5',
    border: 'border-destructive',
    icon: 'text-destructive',
    IconComponent: AlertOctagon,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    icon: 'text-amber-600',
    IconComponent: AlertTriangle,
  },
};

export function AlertCard({ type, message, actionLabel, actionHref, onDismiss }: AlertCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const c = config[type];

  if (dismissed) return null;

  return (
    <div
      className={cn(
        'border-l-4 rounded-r-lg px-4 py-2.5 flex items-center gap-3',
        c.border, c.bg,
      )}
    >
      <c.IconComponent className={cn('w-4 h-4 shrink-0', c.icon)} />

      <span className="text-sm text-foreground flex-1 min-w-0 truncate">
        {message}
      </span>

      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="shrink-0 text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          {actionLabel}
        </Link>
      )}

      <button
        type="button"
        onClick={() => { setDismissed(true); onDismiss(); }}
        className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
