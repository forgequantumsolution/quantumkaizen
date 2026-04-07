import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreateCalibrationRecord } from './hooks';

interface FormValues {
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  category: string;
  location: string;
  frequency: number;
  accuracy: string;
  range: string;
  lastCalibrated: string;
  calibratedBy: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20';

export default function CalibrationCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateCalibrationRecord();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { frequency: 180 },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createMutation.mutateAsync(values as Parameters<typeof createMutation.mutateAsync>[0]);
      navigate('/calibration');
    } catch {
      // error handled silently — mock mode
      navigate('/calibration');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/calibration')} className="hover:text-gray-900 transition-colors">
          Calibration Management
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900">Add Equipment</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900">Add Equipment</h1>

      <Card className="max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <CardTitle>Equipment Details</CardTitle>

          {/* Equipment Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Equipment Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name', { required: 'Equipment name is required' })}
              className={inputClass}
              placeholder="e.g., Vernier Caliper 0-150mm"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Manufacturer + Model */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Manufacturer <span className="text-red-500">*</span>
              </label>
              <input
                {...register('manufacturer', { required: 'Manufacturer is required' })}
                className={inputClass}
                placeholder="e.g., Mitutoyo"
              />
              {errors.manufacturer && <p className="mt-1 text-xs text-red-600">{errors.manufacturer.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                {...register('model', { required: 'Model is required' })}
                className={inputClass}
                placeholder="e.g., 530-312"
              />
              {errors.model && <p className="mt-1 text-xs text-red-600">{errors.model.message}</p>}
            </div>
          </div>

          {/* Serial Number + Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                {...register('serialNumber', { required: 'Serial number is required' })}
                className={inputClass}
                placeholder="e.g., MT2024001"
              />
              {errors.serialNumber && <p className="mt-1 text-xs text-red-600">{errors.serialNumber.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                {...register('category', { required: 'Category is required' })}
                className={inputClass}
              >
                <option value="">Select category</option>
                <option value="MEASUREMENT">Measurement</option>
                <option value="TEST">Test</option>
                <option value="MONITORING">Monitoring</option>
                <option value="PRODUCTION">Production</option>
              </select>
              {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              {...register('location', { required: 'Location is required' })}
              className={inputClass}
              placeholder="e.g., Production Floor A"
            />
            {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location.message}</p>}
          </div>

          {/* Calibration Frequency + Accuracy */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Calibration Frequency (days) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                {...register('frequency', { required: 'Frequency is required', valueAsNumber: true, min: { value: 1, message: 'Must be at least 1 day' } })}
                className={inputClass}
                placeholder="e.g., 180"
              />
              {errors.frequency && <p className="mt-1 text-xs text-red-600">{errors.frequency.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Accuracy</label>
              <input
                {...register('accuracy')}
                className={inputClass}
                placeholder="e.g., ±0.02mm"
              />
            </div>
          </div>

          {/* Range */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Range</label>
            <input
              {...register('range')}
              className={inputClass}
              placeholder="e.g., 0-150mm"
            />
          </div>

          {/* Last Calibrated Date + Calibrated By */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Last Calibrated Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('lastCalibrated', { required: 'Last calibration date is required' })}
                className={inputClass}
              />
              {errors.lastCalibrated && <p className="mt-1 text-xs text-red-600">{errors.lastCalibrated.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Calibrated By <span className="text-red-500">*</span>
              </label>
              <input
                {...register('calibratedBy', { required: 'Calibrated by is required' })}
                className={inputClass}
                placeholder="e.g., ABC Calibration Lab"
              />
              {errors.calibratedBy && <p className="mt-1 text-xs text-red-600">{errors.calibratedBy.message}</p>}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <Button type="button" variant="outline" onClick={() => navigate('/calibration')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Add Equipment'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
