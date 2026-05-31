import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ChronologyEvent } from '@/types/dashboard';

interface ChronologyFeedProps {
  events: ChronologyEvent[];
}

export function ChronologyFeed({ events }: ChronologyFeedProps) {
  if (events.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">События сегодня</h3>
        <p className="text-sm text-muted-foreground">Пока ничего не происходило</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">События сегодня</h3>

      <div className="space-y-0">
        {events.map((event, i) => (
          <div
            key={event.id}
            className={cn(
              'flex items-baseline gap-2 flex-wrap py-2',
              i < events.length - 1 ? 'border-b border-border/30' : '',
            )}
          >
            {/* Time */}
            <span className="text-xs text-muted-foreground shrink-0 w-10 tabular-nums">
              {event.time}
            </span>

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
        ))}
      </div>
    </div>
  );
}
