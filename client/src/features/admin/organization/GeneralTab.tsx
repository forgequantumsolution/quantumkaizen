import { useMemo } from 'react';
import { Formik, Form, type FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {
  Button as AntButton,
  Input as AntInput,
  Select as AntSelect,
  Form as AntForm,
  Spin,
  Tag as AntTag,
} from 'antd';
import { Save, Check, Upload, Plus } from 'lucide-react';
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

const validationSchema = Yup.object({
  name: Yup.string().min(1).max(120).required('Organization name is required'),
  tenantCode: Yup.string().min(1).max(40).required('Tenant code is required'),
  industry: Yup.string().required(),
  website: Yup.string()
    .test('url-or-empty', 'Website must start with http:// or https://', (v) =>
      !v || /^https?:\/\//.test(v),
    )
    .nullable(),
  address: Yup.string().max(500).nullable(),
  standards: Yup.array().of(Yup.string().required()).max(20),
  timezone: Yup.string().required(),
  dateFormat: Yup.string().required(),
});

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

export default function GeneralTab() {
  const { data: org, isLoading } = useOrganization();
  const { data: industries = [] } = useIndustries();
  const update = useUpdateOrganization();
  const canEdit = useHasPermission('org.update');

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

  if (isLoading || !initialValues) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin />
      </div>
    );
  }

  const handleSubmit = async (
    values: FormValues,
    helpers: FormikHelpers<FormValues>,
  ) => {
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
      helpers.setStatus({ saved: true });
      setTimeout(() => helpers.setStatus({}), 2500);
    } catch (err) {
      helpers.setStatus({ error: extractApiError(err) });
    } finally {
      helpers.setSubmitting(false);
    }
  };

  return (
    <Formik<FormValues>
      enableReinitialize
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({
        values,
        errors,
        touched,
        status,
        dirty,
        isSubmitting,
        setFieldValue,
        handleSubmit,
      }) => {
        const suggestions = (SUGGESTED_STANDARDS_BY_INDUSTRY[values.industry] ?? []).filter(
          (s) => !values.standards.includes(s),
        );
        const addStandard = (raw: string) => {
          const v = raw.trim();
          if (!v || values.standards.includes(v)) return;
          setFieldValue('standards', [...values.standards, v]);
        };
        const removeStandard = (s: string) => {
          setFieldValue(
            'standards',
            values.standards.filter((x) => x !== s),
          );
        };

        return (
          <AntForm layout="vertical" component={false}>
          <Form className="space-y-6">
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
                    isSubmitting ? null : status?.saved ? (
                      <Check size={14} />
                    ) : (
                      <Save size={14} />
                    )
                  }
                  loading={isSubmitting}
                  disabled={!dirty}
                  onClick={() => handleSubmit()}
                >
                  {status?.saved ? 'Saved!' : 'Save Changes'}
                </AntButton>
              )}
            </div>

            {status?.error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {status.error}
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
                <AntForm.Item
                  label="Organization Name"
                  required
                  validateStatus={touched.name && errors.name ? 'error' : ''}
                  help={touched.name && errors.name}
                >
                  <AntInput
                    value={values.name}
                    onChange={(e) => setFieldValue('name', e.target.value)}
                    disabled={!canEdit}
                  />
                </AntForm.Item>
                <AntForm.Item
                  label="Tenant Code"
                  required
                  validateStatus={touched.tenantCode && errors.tenantCode ? 'error' : ''}
                  help={touched.tenantCode && errors.tenantCode}
                >
                  <AntInput
                    value={values.tenantCode}
                    onChange={(e) => setFieldValue('tenantCode', e.target.value.toUpperCase())}
                    disabled={!canEdit}
                  />
                </AntForm.Item>
                <AntForm.Item label="Address" className="col-span-2">
                  <AntInput.TextArea
                    rows={2}
                    value={values.address}
                    onChange={(e) => setFieldValue('address', e.target.value)}
                    placeholder="Street, city, state, country"
                    disabled={!canEdit}
                  />
                </AntForm.Item>
                <AntForm.Item
                  label="Website"
                  className="col-span-2"
                  validateStatus={touched.website && errors.website ? 'error' : ''}
                  help={touched.website && errors.website}
                >
                  <AntInput
                    value={values.website}
                    onChange={(e) => setFieldValue('website', e.target.value)}
                    placeholder="https://example.com"
                    disabled={!canEdit}
                  />
                </AntForm.Item>
              </div>
            </div>

            {/* Industry & Standards */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-h3 text-gray-900">Industry & Standards</h2>
              <div className="grid grid-cols-2 gap-x-4">
                <AntForm.Item label="Industry">
                  <AntSelect
                    value={values.industry}
                    onChange={(v) => setFieldValue('industry', v)}
                    disabled={!canEdit}
                    options={industries.map((i) => ({ value: i, label: i }))}
                  />
                </AntForm.Item>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compliance Standards
                </label>
                <AntSelect<string[]>
                  mode="tags"
                  value={values.standards}
                  onChange={(arr) => setFieldValue('standards', arr)}
                  disabled={!canEdit}
                  placeholder="Type a standard and press Enter…"
                  style={{ width: '100%' }}
                  tokenSeparators={[',']}
                />
                <p className="text-xs text-gray-400 mt-1 mb-0">
                  Press Enter or comma to add a custom standard.
                </p>
              </div>

              {canEdit && suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Suggested for {values.industry}
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

              {!canEdit && values.standards.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {values.standards.map((s) => (
                    <AntTag key={s} color="blue">
                      {s}
                    </AntTag>
                  ))}
                </div>
              )}
            </div>

            {/* Defaults */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-h3 text-gray-900">Defaults</h2>
              <div className="grid grid-cols-2 gap-x-4">
                <AntForm.Item label="Timezone">
                  <AntSelect
                    value={values.timezone}
                    onChange={(v) => setFieldValue('timezone', v)}
                    disabled={!canEdit}
                    options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                  />
                </AntForm.Item>
                <AntForm.Item label="Date Format">
                  <AntSelect
                    value={values.dateFormat}
                    onChange={(v) => setFieldValue('dateFormat', v)}
                    disabled={!canEdit}
                    options={DATE_FORMATS.map((f) => ({ value: f, label: f }))}
                  />
                </AntForm.Item>
              </div>
            </div>

            {/* Standards click-to-remove rendering — handled by mode="tags" select */}
            {/* (kept here as a no-op so removeStandard stays referenced if we reintroduce a custom chip UI) */}
            <div className="hidden">
              <AntButton onClick={() => values.standards.forEach(removeStandard)}>noop</AntButton>
            </div>
          </Form>
          </AntForm>
        );
      }}
    </Formik>
  );
}
