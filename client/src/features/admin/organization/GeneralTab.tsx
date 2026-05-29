import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Spin,
  Tag as AntTag,
} from 'antd';
import { Save, Check, Upload, Plus } from 'lucide-react';
import { AppForm } from '@/components/ui';
import {
  useOrganization,
  useIndustries,
  useUpdateOrganization,
  SUGGESTED_STANDARDS_BY_INDUSTRY,
  type UpdateOrganizationInput,
} from './hooks';
import { useHasPermission } from '@/stores/authStore';

interface FormValues {
  name: string;
  tenantCode: string;
  industry: string;
  website: string;
  address: string;
  standards: string[];
  timezone: string;
  dateFormat: string;
}

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function GeneralTab() {
  const { data: org, isLoading } = useOrganization();
  const { data: industries = [] } = useIndustries();
  const update = useUpdateOrganization();
  const canEdit = useHasPermission('org.update');

  const [form] = AppForm.useForm<FormValues>();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Watched fields drive the suggested-standards block.
  const industry = AppForm.useWatch('industry', form) ?? '';
  const standards = (AppForm.useWatch('standards', form) ?? []) as string[];

  const initialValues = useMemo<FormValues | null>(() => {
    if (!org) return null;
    return {
      name: org.name,
      tenantCode: org.tenantCode,
      industry: org.industry,
      website: org.website ?? '',
      address: org.address ?? '',
      standards: [...org.standards],
      timezone: org.timezone,
      dateFormat: org.dateFormat,
    };
  }, [org]);

  // Re-seed the form whenever the server payload changes (mirrors Formik's
  // enableReinitialize). Reset dirty/feedback at the same time.
  useEffect(() => {
    if (!initialValues) return;
    form.setFieldsValue(initialValues);
    setDirty(false);
    setSaved(false);
    setError(null);
  }, [initialValues, form]);

  if (isLoading || !initialValues) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  const handleFinish = async (values: FormValues) => {
    setError(null);
    const payload: UpdateOrganizationInput = {
      name: values.name.trim(),
      tenantCode: values.tenantCode.trim(),
      industry: values.industry,
      website: values.website.trim() || null,
      address: values.address.trim() || null,
      standards: values.standards,
      timezone: values.timezone,
      dateFormat: values.dateFormat,
    };
    try {
      await update.mutateAsync(payload);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const suggestions = (SUGGESTED_STANDARDS_BY_INDUSTRY[industry] ?? []).filter(
    (s) => !standards.includes(s),
  );

  const addStandard = (raw: string) => {
    const v = raw.trim();
    if (!v || standards.includes(v)) return;
    form.setFieldValue('standards', [...standards, v]);
    setDirty(true);
  };

  return (
    <AppForm<FormValues>
      form={form}
      initialValues={initialValues}
      onFinish={handleFinish}
      disabled={!canEdit}
      onValuesChange={() => {
        setDirty(true);
        setSaved(false);
      }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 mb-0">
          {canEdit
            ? 'Tenant-wide settings used across the QMS modules.'
            : 'Read-only view — you do not have permission to edit organization settings.'}
        </p>
        {canEdit && (
          <AntButton
            type="primary"
            icon={
              update.isPending ? null : saved ? <Check size={14} /> : <Save size={14} />
            }
            loading={update.isPending}
            disabled={!dirty}
            onClick={() => form.submit()}
          >
            {saved ? 'Saved!' : 'Save Changes'}
          </AntButton>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Identity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-h3 text-gray-900">Organization Identity</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-bold text-xl">QK</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-0">Organization Logo</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-0">
              PNG or SVG, max 2MB, recommended 200×200px
            </p>
            <AntButton
              size="small"
              type="link"
              icon={<Upload size={12} />}
              disabled
              className="!p-0 !mt-1"
            >
              Upload logo
            </AntButton>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <AppForm.Item
            label="Organization Name"
            name="name"
            rules={[
              { required: true, message: 'Organization name is required' },
              { max: 120, message: 'Must be at most 120 characters' },
            ]}
          >
            <AntInput />
          </AppForm.Item>
          <AppForm.Item
            label="Tenant Code"
            name="tenantCode"
            normalize={(v: string) => (v ?? '').toUpperCase()}
            rules={[
              { required: true, message: 'Tenant code is required' },
              { max: 40, message: 'Must be at most 40 characters' },
            ]}
          >
            <AntInput />
          </AppForm.Item>
          <AppForm.Item label="Address" name="address" className="col-span-2">
            <AntInput.TextArea rows={2} placeholder="Street, city, state, country" />
          </AppForm.Item>
          <AppForm.Item
            label="Website"
            name="website"
            className="col-span-2"
            rules={[
              {
                validator: (_, v: string) =>
                  !v || /^https?:\/\//.test(v)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Website must start with http:// or https://')),
              },
            ]}
          >
            <AntInput placeholder="https://example.com" />
          </AppForm.Item>
        </div>
      </div>

      {/* Industry & Standards */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-h3 text-gray-900">Industry & Standards</h2>
        <div className="grid grid-cols-2 gap-x-4">
          <AppForm.Item label="Industry" name="industry" rules={[{ required: true }]}>
            <AntSelect options={industries.map((i) => ({ value: i, label: i }))} />
          </AppForm.Item>
        </div>

        <AppForm.Item
          label="Compliance Standards"
          name="standards"
          help="Press Enter or comma to add a custom standard."
          rules={[{ type: 'array', max: 20, message: 'At most 20 standards' }]}
        >
          <AntSelect<string[]>
            mode="tags"
            placeholder="Type a standard and press Enter…"
            style={{ width: '100%' }}
            tokenSeparators={[',']}
          />
        </AppForm.Item>

        {canEdit && suggestions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Suggested for {industry}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <AntTag
                  key={s}
                  className="!cursor-pointer hover:!bg-blue-50"
                  onClick={() => addStandard(s)}
                >
                  <Plus size={10} className="inline -mt-0.5 mr-0.5" /> {s}
                </AntTag>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Defaults */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-h3 text-gray-900">Defaults</h2>
        <div className="grid grid-cols-2 gap-x-4">
          <AppForm.Item label="Timezone" name="timezone" rules={[{ required: true }]}>
            <AntSelect options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} />
          </AppForm.Item>
          <AppForm.Item label="Date Format" name="dateFormat" rules={[{ required: true }]}>
            <AntSelect options={DATE_FORMATS.map((f) => ({ value: f, label: f }))} />
          </AppForm.Item>
        </div>
      </div>
    </AppForm>
  );
}
