import { Link } from 'react-router-dom';
import { Clock, Play, ArrowDownRight, Truck, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChronologyEvent, ChronologyEventType } from '@/types/dashboard';

const eventIcons: Record<ChronologyEventType, { Icon: LucideIcon; color: string }> = {
  shift_open: { Icon: Play,        color: 'text-green-600 bg-green-50' },
  expense:    { Icon: ArrowDownRight, color: 'text-amber-600 bg-amber-50' },
  delivery:   { Icon: Truck,       color: 'text-blue-600 bg-blue-50' },
  write_off:  { Icon: Trash2,      color: 'text-destructive bg-destructive/10' },
};

interface ChronologyFeedProps {
  events: ChronologyEvent[];
}

export function ChronologyFeed({ events }: ChronologyFeedProps) {
  if (events.length === 0) {
    return (
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">События сегодня</h2>
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
          <Clock className="w-8 h-8 opacity-40" />
          <p className="text-sm">Пока ничего не происходило</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-3">События сегодня</h2>

      <div className="space-y-0">
        {events.map((event, i) => {
          const eventMeta = event.type ? eventIcons[event.type] : null;
          const EventIcon = eventMeta?.Icon;

          return (
          <div
            key={event.id}
            className={cn(
              'flex items-baseline gap-2 flex-wrap py-2',
              i < events.length - 1 ? 'border-b border-border/30' : '',
            )}
          >
            {/* Icon circle + Time */}
            <div className="flex items-center gap-2 shrink-0">
              {EventIcon && eventMeta && (
                <span className={cn('w-5 h-5 rounded-full flex items-center justify-center', eventMeta.color)}>
                  <EventIcon className="w-3 h-3" />
                </span>
              )}
              <span className="text-xs text-muted-foreground w-10 tabular-nums">
                {event.time}
              </span>
            </div>

            {/* Actor + Action */}
            <span className="text-sm font-medium text-foreground">
              {event.actor}
            </span>
            <span className="text-sm text-foreground">{event.action}</span>

            {/* Detail (optional) */}
            {event.detail && (
              <span className="text-sm text-muted-foreground">
                — {event.detail}
              </span>
            )}

            {/* Action badge */}
            {event.actionLabel && event.actionHref && (
              <Link to={event.actionHref} className="shrink-0">
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  {event.actionLabel}
                </span>
              </Link>
            )}
          </div>
        );
})}
      </div>
    </div>
  );
}
