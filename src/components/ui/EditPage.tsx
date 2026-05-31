import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DeletePageButton } from './DeleteButton';
import { Button } from '@/components/shadcn/button';

interface EditPageProps {
 title: string;
 backTo: string | (() => void);
 onDelete?: () => void;
 onSave: () => void;
 saving?: boolean;
 deleteLabel?: string;
 children: React.ReactNode;
}

/** Uniform edit/create page shell: < title, form fields, Delete...Save polar buttons. */
export function EditPage({
 title,
 backTo,
 onDelete,
 onSave,
 saving = false,
 deleteLabel,
 children,
}: EditPageProps) {
 const navigate = useNavigate();

 const handleBack = () => {
  if (typeof backTo === 'function') backTo();
  else navigate(backTo);
 };

 return (
  <div className="p-8 max-w-2xl">
   <div className="flex items-center gap-1 mb-8">
    <button
     type="button"
     onClick={handleBack}
     className="text-foreground"
    >
     <ChevronLeft className="w-5 h-5" />
    </button>
    <h2 className="text-2xl font-bold">{title}</h2>
   </div>

   <div className="space-y-4 mb-10">
    {children}
   </div>

   <div className="flex items-center justify-between pt-4 border-t">
    {onDelete ? (
     <DeletePageButton onClick={onDelete} label={deleteLabel} />
    ) : (
     <div />
    )}
    <Button
     type="button"
     disabled={saving}
     onClick={onSave}
     className="bg-green-600 hover:bg-green-700 text-white rounded-lg"
    >
     {saving ? 'Сохранение…' : 'Сохранить'}
    </Button>
   </div>
  </div>
 );
}
