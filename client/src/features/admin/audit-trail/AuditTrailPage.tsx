import { useState } from 'react';
import { Alert, Button, DatePicker, Input, Select, Table, Tooltip, message } from 'antd';
import type { Dayjs } from 'dayjs';
import { Download, History, RotateCcw, ShieldCheck, ShieldAlert, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import { buildTrailColumns } from '@/components/shared/EntityAuditTrail';
import AuditEntryDrawer from '@/components/shared/AuditEntryDrawer';
import {
  downloadTrailCsv,
  useAuditTrailList,
  useChainStatus,
  useTrailFacets,
  type TrailFilters,
  type TrailRow,
} from '@/lib/api/auditTrail';

const { RangePicker } = DatePicker;
const PAGE_SIZE = 25;

/**
 * System-wide audit trail viewer.
 *
 * The read surface for everything the trail captures: who changed what, when,
 * from where, and why — across every module, including security events.
 */
export default function AuditTrailPage() {
  const canRead = useHasPermission('audit_trail.read');
  const canExport = useHasPermission('audit_trail.export');

  const [entityType, setEntityType] = useState<string | undefined>();
  const [module, setModule] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [criticality, setCriticality] = useState<string | undefined>();
  const [user, setUser] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<TrailRow | null>(null);

  const filters: TrailFilters = {
    entity_type: entityType,
    module,
    action,
    criticality,
    user: user || undefined,
    search: search || undefined,
    from: range?.[0]?.startOf('day').toISOString(),
    to: range?.[1]?.endOf('day').toISOString(),
    page,
    page_size: PAGE_SIZE,
  };

  const { data, isLoading } = useAuditTrailList(filters, canRead);
  const { data: facets } = useTrailFacets(canRead);
  const { data: chain } = useChainStatus(canRead);

  // Any filter change invalidates the current page number.
  const on = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const reset = () => {
    setEntityType(undefined); setModule(undefined); setAction(undefined);
    setCriticality(undefined); setUser(''); setSearch(''); setRange(null); setPage(1);
  };

  const doExport = async () => {
    setExporting(true);
    try {
      await downloadTrailCsv({ ...filters, page: undefined, page_size: undefined });
      message.success('Export downloaded — this export has itself been recorded');
    } catch {
      message.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!canRead) {
    return (
      <PageContainer>
        <Header />
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <ShieldCheck size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm font-medium text-gray-700">No access to the audit trail</div>
          <div className="text-xs text-gray-500 mt-1">
            Requires the <code>audit_trail.read</code> permission.
          </div>
        </div>
      </PageContainer>
    );
  }

  const status = chain?.data;

  return (
    <PageContainer>
      <Header />

      {status && (
        <Alert
          type={status.intact ? 'success' : 'warning'}
          showIcon
          icon={status.intact ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
          className="mb-4"
          message={
            status.intact
              ? `Integrity verified — ${status.checked.toLocaleString()} entries chained, none altered`
              : `Integrity check found ${status.breaks.length} discontinuit${status.breaks.length === 1 ? 'y' : 'ies'}`
          }
          description={
            status.unsealed > 0
              ? `${status.unsealed} recent entr${status.unsealed === 1 ? 'y is' : 'ies are'} awaiting the next chain seal (runs every 30 seconds).`
              : undefined
          }
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          allowClear
          prefix={<Search size={14} className="text-gray-400" />}
          placeholder="Search record, value or reason"
          className="w-64"
          value={search}
          onChange={(e) => on(setSearch)(e.target.value)}
        />
        <Select
          allowClear placeholder="Module" className="w-40" value={module}
          onChange={on(setModule)}
          options={(facets?.data.modules ?? []).map((m) => ({ value: m, label: m }))}
        />
        <Select
          allowClear showSearch placeholder="Record type" className="w-48" value={entityType}
          onChange={on(setEntityType)}
          options={(facets?.data.entity_types ?? []).map((e) => ({ value: e, label: e }))}
        />
        <Select
          allowClear showSearch placeholder="Action" className="w-44" value={action}
          onChange={on(setAction)}
          options={(facets?.data.actions ?? []).map((a) => ({
            value: a, label: a.replace(/_/g, ' '),
          }))}
        />
        <Select
          allowClear placeholder="Criticality" className="w-36" value={criticality}
          onChange={on(setCriticality)}
          options={[
            { value: 'CRITICAL', label: 'Critical only' },
            { value: 'NORMAL', label: 'Normal' },
          ]}
        />
        <Input
          allowClear placeholder="User" className="w-40" value={user}
          onChange={(e) => on(setUser)(e.target.value)}
        />
        <RangePicker
          value={range as never}
          onChange={(v) => on(setRange)(v as [Dayjs | null, Dayjs | null] | null)}
        />
        <Button icon={<RotateCcw size={14} />} onClick={reset}>Reset</Button>
        <div className="ml-auto flex items-center gap-2">
          {data?.meta && (
            <span className="text-xs text-gray-500">
              {data.meta.total.toLocaleString()} entries
            </span>
          )}
          {canExport && (
            <Tooltip title="Exports are themselves recorded in the trail">
              <Button icon={<Download size={14} />} loading={exporting} onClick={doExport}>
                Export CSV
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table<TrailRow>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data?.data ?? []}
          columns={buildTrailColumns({ showRecord: true })}
          // Fixed layout + per-column widths keeps every row the same height and
          // stops long ids from pushing neighbouring cells out of their column.
          tableLayout="fixed"
          onRow={(record) => ({
            onClick: () => setSelected(record),
            className: 'cursor-pointer',
          })}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.meta.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
        />
      </div>

      <AuditEntryDrawer row={selected} open={!!selected} onClose={() => setSelected(null)} />
    </PageContainer>
  );
}

function Header() {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <History size={20} className="text-gray-400" />
        Audit Trail
      </h1>
      <p className="text-sm text-gray-500 mt-0.5">
        Every recorded action across the system — who did it, when, and what changed.
      </p>
    </div>
  );
}
