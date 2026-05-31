type StatusColor = 'green' | 'red' | 'amber' | 'gray';

const dotColor: Record<StatusColor, string> = {
 green: 'bg-green-500',
 red: 'bg-red-500',
 amber: 'bg-amber-500',
 gray: 'bg-[#d4d2ce]',
};

export function StatusDot({ color, className = '' }: { color: StatusColor; className?: string }) {
 return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dotColor[color]} ${className}`} />;
}

const badgeStyle: Record<StatusColor, string> = {
 green: 'text-green-700 bg-green-50 border-green-200',
 red: 'text-red-700 bg-red-50 border-red-200',
 amber: 'text-amber-700 bg-amber-50 border-amber-200',
 gray: 'text-muted-foreground bg-muted border-border',
};

export function StatusBadge({ color, label }: { color: StatusColor; label: string }) {
 return (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle[color]}`}>
   {label}
  </span>
 );
}
