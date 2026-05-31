interface AddButtonProps {
 onClick: () => void;
 label?: string;
}

export function AddButton({ onClick, label = '+ Добавить' }: AddButtonProps) {
 return (
  <button
   type="button"
   onClick={onClick}
   className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
  >
   {label}
  </button>
 );
}

interface SaveButtonProps {
 onClick: () => void;
 disabled?: boolean;
 pending?: boolean;
}

export function SaveButton({ onClick, disabled = false, pending = false }: SaveButtonProps) {
 return (
  <button
   type="button"
   disabled={disabled}
   onClick={onClick}
   className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
  >
   {pending ? 'Сохранение…' : 'Сохранить'}
  </button>
 );
}
