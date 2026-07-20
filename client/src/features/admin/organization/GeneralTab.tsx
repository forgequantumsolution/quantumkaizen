import { useEffect, useMemo, useState } from 'react';
import {
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Spin,
  Tag as AntTag,
  Upload as AntUpload,
} from 'antd';
import { Save, Check, Upload, Plus, Trash2 } from 'lucide-react';
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
  logoUrl: string;
  reportFooterText: string;
}

const LOGO_MAX_BYTES = 1_000_000; // ~1MB — keeps the base64 payload sane
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

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
  const logoUrl = (AppForm.useWatch('logoUrl', form) ?? '') as string;

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
      logoUrl: org.logoUrl ?? '',
      reportFooterText: org.reportFooterText ?? '',
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
      logoUrl: values.logoUrl || null,
      reportFooterText: values.reportFooterText.trim() || null,
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

  // Read the picked logo into a base64 data-URL and stash it on the form.
  // Returning false prevents antd Upload from performing an HTTP request.
  const handleLogoPick = async (file: File) => {
    setError(null);
    if (!LOGO_TYPES.includes(file.type)) {
      setError('Logo must be a PNG, JPG, or SVG image.');
      return false;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError('Logo image is too large (max 1MB).');
      return false;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      form.setFieldValue('logoUrl', dataUrl);
      setDirty(true);
      setSaved(false);
    } catch {
      setError('Could not read the selected image.');
    }
    return false;
  };

  const clearLogo = () => {
    form.setFieldValue('logoUrl', '');
    setDirty(true);
    setSaved(false);
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
        {/* logoUrl is managed imperatively via the Upload control below. */}
        <AppForm.Item name="logoUrl" hidden noStyle>
          <AntInput type="hidden" />
        </AppForm.Item>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Organization logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-pharma-500 font-bold text-xl">QK</span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-0">Organization Logo</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-0">
              PNG, JPG, or SVG, max 1MB · used on ticket report headers
            </p>
            {canEdit && (
              <div className="flex items-center gap-3 mt-1">
                <AntUpload
                  accept=".png,.jpg,.jpeg,.svg"
                  showUploadList={false}
                  beforeUpload={handleLogoPick}
                >
                  <AntButton size="small" type="link" icon={<Upload size={12} />} className="!p-0">
                    {logoUrl ? 'Replace logo' : 'Upload logo'}
                  </AntButton>
                </AntUpload>
                {logoUrl && (
                  <AntButton
                    size="small"
                    type="link"
                    danger
                    icon={<Trash2 size={12} />}
                    className="!p-0"
                    onClick={clearLogo}
                  >
                    Remove
                  </AntButton>
                )}
              </div>
            )}
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

      {/* Report Branding */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-h3 text-gray-900">Report Branding</h2>
        <p className="text-sm text-gray-500 mb-0">
          The logo above and this footer appear on every page of downloaded ticket reports.
        </p>
        <AppForm.Item
          label="Report Footer Text"
          name="reportFooterText"
          help="Shown at the bottom of each report page — e.g. a confidentiality notice."
          rules={[{ max: 200, message: 'Must be at most 200 characters' }]}
        >
          <AntInput placeholder="Confidential — for internal use only" maxLength={200} />
        </AppForm.Item>
      </div>
    </AppForm>
  );
}
