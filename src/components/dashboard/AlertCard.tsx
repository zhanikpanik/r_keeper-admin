import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SvgIcon } from '@/components/dashboard/SvgIcon';

interface AlertCardProps {
  type: 'critical' | 'warning' | 'info';
  message: string;
  actionLabel: string | null;
  actionHref: string | null;
  onDismiss: () => void;
  onAction?: () => void;
  /** Контекстная иконка (lucide) */
  icon?: LucideIcon;
  /** Контекстная иконка (кастомный SVG raw) — приоритет над icon */
  iconRaw?: string;
  /** Render as a row inside a shared container (no bg, no radius) */
  grouped?: boolean;
}

const severityFallback = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

const severityColor = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};

export function AlertCard({ type, message, actionLabel, actionHref, onDismiss, onAction, icon, iconRaw, grouped }: AlertCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const IconComponent: LucideIcon = icon || severityFallback[type];

  const actionElement = onAction ? (
    <button
      type="button"
      onClick={onAction}
      className="shrink-0 text-sm font-medium text-primary hover:underline transition-colors"
    >
      {actionLabel}
    </button>
  ) : actionLabel && actionHref ? (
    <Link
      to={actionHref}
      className="shrink-0 text-sm font-medium text-primary hover:underline transition-colors"
    >
      {actionLabel}
    </Link>
  ) : null;

  return (
    <div className={cn(
      'flex items-center gap-2',
      grouped
        ? 'px-4 py-2'
        : 'bg-[#EFF1F3] rounded-xl px-4 py-4'
    )}>
      {iconRaw ? (
        <SvgIcon raw={iconRaw} className={cn('w-auto h-10 shrink-0', severityColor[type])} />
      ) : (
        <IconComponent className={cn('w-10 h-10 shrink-0', severityColor[type])} />
      )}

      <span className="text-sm text-foreground flex-1 min-w-0 truncate">
        {message}
      </span>

      {actionElement}

      <button
        type="button"
        onClick={() => { setDismissed(true); onDismiss(); }}
        className="shrink-0 p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="Скрыть"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
