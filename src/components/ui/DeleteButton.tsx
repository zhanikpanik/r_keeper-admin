import { X } from 'lucide-react';

interface DeleteButtonProps {
 onClick: () => void;
 className?: string;
}

/** Uniform row-level delete button. Use inside table rows with opacity-0 group-hover:opacity-100. */
export function DeleteButton({ onClick, className = '' }: DeleteButtonProps) {
 return (
  <button
   type="button"
   aria-label="Удалить"
   onClick={(e) => { e.stopPropagation(); onClick(); }}
   className={`text-red-400 hover:text-red-600 transition-colors cursor-pointer ${className}`}
  >
   <X className="w-3.5 h-3.5" />
  </button>
 );
}

/** Page-level delete button with label, placed on the left (polar with Save on right). */
export function DeletePageButton({ onClick, label = 'Удалить' }: { onClick: () => void; label?: string }) {
 return (
  <button
   type="button"
   onClick={onClick}
   className="px-4 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
  >
   {label}
  </button>
 );
}

/** Line-item delete button for form item rows (smaller, muted). */
export function DeleteLineButton({ onClick }: { onClick: () => void }) {
 return (
  <button
   type="button"
   aria-label="Удалить"
   onClick={onClick}
   className="p-1 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-red-50 cursor-pointer"
  >
   <X className="w-3.5 h-3.5" />
  </button>
 );
}
