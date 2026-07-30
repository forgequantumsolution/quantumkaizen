import { useState } from 'react';
import { Alert, App, Button, Modal, Spin, Table, Tag } from 'antd';
import { Package } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useCalibrationConfig,
  usePacks,
  useApplyPack,
  KIND_LABELS,
  CRITICALITY_BADGE,
  type Pack,
  type PackKey,
} from '@/lib/api/calibration';

/**
 * Industry packs — the multi-industry surface.
 *
 * A pack is data, not a code path: applying one writes the policy columns plus
 * a set of instrument categories and tolerance templates. Everything stays
 * editable afterwards, and instruments/plans are never touched.
 */
export default function IndustryPacksPage() {
  const { data: config } = useCalibrationConfig();
  const { data, isLoading } = usePacks();
  const { message, modal } = App.useApp();
  const apply = useApplyPack();
  const canUpdate = useHasPermission('calibration_config.update');
  const [preview, setPreview] = useState<Pack | null>(null);

  const doApply = (pack: Pack, mode: 'merge' | 'replace') =>
    modal.confirm({
      title: `Apply the ${pack.label} pack?`,
      centered: true,
      width: 540,
      content: (
        <div className="text-sm space-y-2">
          <p>
            Writes {pack.category_count} instrument categories with {pack.point_count} tolerance points, and sets the
            policy columns for this regime.
          </p>
          <p className="text-gray-500 text-xs">
            Existing instruments and calibration plans are <strong>not</strong> touched. Categories are suggestions
            until a plan is created from one, so applying a pack can never rewrite a tolerance an instrument has
            already been judged against.
          </p>
          {mode === 'replace' && (
            <p className="text-amber-700 text-xs">
              Replace mode also deactivates other packs&apos; categories that no instrument is using.
            </p>
          )}
        </div>
      ),
      okText: 'Apply pack',
      onOk: async () => {
        try {
          const res = (await apply.mutateAsync({ pack: pack.key as PackKey, mode })) as {
            categories_created: number;
            categories_updated: number;
            categories_deactivated: number;
          };
          message.success(
            `${pack.label} applied — ${res.categories_created} created, ${res.categories_updated} updated` +
              (res.categories_deactivated ? `, ${res.categories_deactivated} deactivated` : ''),
          );
        } catch (e) {
          message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
        }
      },
    });

  return (
    <PageContainer>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package size={22} className="text-gray-500" />
          Industry Packs
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Every pharma / automotive / FMCG difference is configuration, never a code branch. Pick the pack that matches
          your regime, then adjust anything in Policy &amp; Rules.
        </p>
      </div>

      {config?.is_default && (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="Nothing configured for this site yet"
          description="The module is running on built-in defaults. Apply a pack to seed categories, tolerance templates and the policy set for your regime."
        />
      )}

      {data?.suggested_pack && (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message={`Suggested: ${data.data.find((p) => p.key === data.suggested_pack)?.label}`}
          description={`Your organisation industry is "${data.organization_industry}". A suggestion, not a constraint — multi-site groups often run different packs per site.`}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(data?.data ?? []).map((p) => {
            const active = config?.industry_pack === p.key;
            return (
              <div
                key={p.key}
                className={`rounded-xl border bg-white shadow-sm p-4 flex flex-col ${
                  active ? 'border-gold-400 ring-1 ring-gold-200' : 'border-gray-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Package size={18} className="text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">{p.label}</h3>
                  </div>
                  {active && (
                    <Tag color="gold" className="!text-[10px] !mr-0">
                      active
                    </Tag>
                  )}
                </div>

                <p className="text-[11px] text-gray-600 leading-snug mb-3 flex-1">{p.summary}</p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {p.standards.slice(0, 4).map((s) => (
                    <Tag key={s} className="!text-[9px] !leading-4 !mr-0 !px-1.5">
                      {s}
                    </Tag>
                  ))}
                  {p.standards.length > 4 && (
                    <Tag className="!text-[9px] !leading-4 !mr-0 !px-1.5">+{p.standards.length - 4}</Tag>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-gray-100 mb-3">
                  <Mini v={p.category_count} l="categories" />
                  <Mini v={p.point_count} l="points" />
                  <Mini v={p.applied_category_count} l="applied" />
                </div>

                <div className="flex gap-2">
                  <Button size="small" className="flex-1" onClick={() => setPreview(p)}>
                    Preview
                  </Button>
                  {canUpdate && (
                    <Button
                      size="small"
                      type="primary"
                      className="flex-1"
                      loading={apply.isPending}
                      onClick={() => doApply(p, 'merge')}
                    >
                      {active ? 'Re-apply' : 'Apply'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!preview}
        onCancel={() => setPreview(null)}
        footer={null}
        width={780}
        centered
        title={preview ? `${preview.label} — what this pack contains` : ''}
      >
        {preview && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Standards addressed</h4>
              <div className="flex flex-wrap gap-1">
                {preview.standards.map((s) => (
                  <Tag key={s} className="!text-[10px]">
                    {s}
                  </Tag>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Instrument categories</h4>
              <Table
                size="small"
                rowKey="code"
                pagination={false}
                scroll={{ y: 340 }}
                dataSource={preview.categories}
                columns={[
                  { title: 'Category', dataIndex: 'name', ellipsis: true },
                  { title: 'Kind', width: 145, render: (_: unknown, r) => <span className="text-[11px]">{KIND_LABELS[r.kind]}</span> },
                  { title: 'Interval', width: 85, align: 'right' as const, render: (_: unknown, r) => `${r.default_interval_days}d` },
                  {
                    title: 'Criticality',
                    width: 95,
                    render: (_: unknown, r) => (
                      <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded border ${CRITICALITY_BADGE[r.default_criticality]}`}>
                        {r.default_criticality}
                      </span>
                    ),
                  },
                  { title: 'Points', width: 60, align: 'right' as const, dataIndex: 'point_count' },
                  {
                    title: 'Flags',
                    width: 125,
                    render: (_: unknown, r) => (
                      <span className="flex gap-1">
                        {r.requires_msa && (
                          <Tag color="purple" className="!text-[9px] !mr-0">
                            MSA
                          </Tag>
                        )}
                        {r.requires_in_use_check && (
                          <Tag color="blue" className="!text-[9px] !mr-0">
                            {r.in_use_check_frequency?.toLowerCase().replace('_', ' ')}
                          </Tag>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}

function Mini({ v, l }: { v: number; l: string }) {
  return (
    <div>
      <div className="text-base font-bold text-gray-900">{v}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wide">{l}</div>
    </div>
  );
}
