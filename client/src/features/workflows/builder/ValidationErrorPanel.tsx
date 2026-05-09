import { AlertTriangle, X } from 'lucide-react';

interface Props {
  errors: string[];
  onDismiss: () => void;
}

export default function ValidationErrorPanel({ errors, onDismiss }: Props) {
  if (errors.length === 0) return null;
  return (
    <div className="absolute bottom-4 left-4 right-4 max-w-2xl mx-auto z-20 bg-red-50 border border-red-200 rounded-lg shadow-lg">
      <div className="flex items-start gap-3 p-3">
        <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-900 mb-1">
            Workflow validation failed ({errors.length} error{errors.length === 1 ? '' : 's'})
          </h4>
          <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-red-600 hover:text-red-800"
          aria-label="dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
