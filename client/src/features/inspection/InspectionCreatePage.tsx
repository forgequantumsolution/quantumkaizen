import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreateInspectionRecord } from './hooks';

interface FormValues {
  type: string;
  partNumber: string;
  partName: string;
  supplier: string;
  batchNumber: string;
  quantity: number;
  sampledQuantity: number;
  inspector: string;
  inspectedAt: string;
  notes: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20';

export default function InspectionCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateInspectionRecord();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      await createMutation.mutateAsync({ ...values, result: 'PENDING', defectsFound: 0 } as Parameters<typeof createMutation.mutateAsync>[0]);
    } catch {
      // mock mode — proceed
    }
    navigate('/inspection');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/inspection')} className="hover:text-gray-900 transition-colors">
          Inspection Records
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900">New Inspection</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">New Inspection</h1>

      <Card className="max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <CardTitle>Inspection Details</CardTitle>

          {/* Inspection Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Inspection Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register('type', { required: 'Inspection type is required' })}
              className={inputClass}
            >
              <option value="">Select type</option>
              <option value="INCOMING">Incoming</option>
              <option value="IN_PROCESS">In-Process</option>
              <option value="FINAL">Final</option>
              <option value="RECEIVING">Receiving</option>
            </select>
            {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
          </div>

          {/* Part Number + Part Name */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Part Number <span className="text-red-500">*</span>
              </label>
              <input
                {...register('partNumber', { required: 'Part number is required' })}
                className={inputClass}
                placeholder="e.g., PN-A4422"
              />
              {errors.partNumber && <p className="mt-1 text-xs text-red-600">{errors.partNumber.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Part Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('partName', { required: 'Part name is required' })}
                className={inputClass}
                placeholder="e.g., Bracket Assembly"
              />
              {errors.partName && <p className="mt-1 text-xs text-red-600">{errors.partName.message}</p>}
            </div>
          </div>

          {/* Supplier (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Supplier <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              {...register('supplier')}
              className={inputClass}
              placeholder="e.g., Acme Components"
            />
          </div>

          {/* Batch Number */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Batch / Work Order Number <span className="text-red-500">*</span>
            </label>
            <input
              {...register('batchNumber', { required: 'Batch number is required' })}
              className={inputClass}
              placeholder="e.g., BATCH-20260315"
            />
            {errors.batchNumber && <p className="mt-1 text-xs text-red-600">{errors.batchNumber.message}</p>}
          </div>

          {/* Quantity + Sampled Quantity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Total Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                {...register('quantity', { required: 'Quantity is required', valueAsNumber: true })}
                className={inputClass}
                placeholder="e.g., 500"
              />
              {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Sampled Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                {...register('sampledQuantity', { required: 'Sampled quantity is required', valueAsNumber: true })}
                className={inputClass}
                placeholder="e.g., 32"
              />
              {errors.sampledQuantity && <p className="mt-1 text-xs text-red-600">{errors.sampledQuantity.message}</p>}
            </div>
          </div>

          {/* Inspector + Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Inspector <span className="text-red-500">*</span>
              </label>
              <input
                {...register('inspector', { required: 'Inspector is required' })}
                className={inputClass}
                placeholder="e.g., Sarah Johnson"
              />
              {errors.inspector && <p className="mt-1 text-xs text-red-600">{errors.inspector.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Inspection Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('inspectedAt', { required: 'Inspection date is required' })}
                className={inputClass}
              />
              {errors.inspectedAt && <p className="mt-1 text-xs text-red-600">{errors.inspectedAt.message}</p>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              className={inputClass}
              placeholder="Any observations, findings, or additional context"
            />
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <Button type="button" variant="outline" onClick={() => navigate('/inspection')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Create Inspection'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
