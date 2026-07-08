import { useState } from 'react';
import { App, Button, Select } from 'antd';
import { CheckCircle2, UserPlus, BookOpenCheck } from 'lucide-react';
import {
  useDocumentReceipts,
  useAssignReaders,
  useAcknowledgeRead,
} from '@/lib/api/dms';
import { useUserDirectory } from '@/features/admin/users/hooks';

interface Props {
  documentId: string;
  canAssign: boolean;
}

export default function AcknowledgementPanel({ documentId, canAssign }: Props) {
  const { message } = App.useApp();
  const { data, isLoading } = useDocumentReceipts(documentId);
  const { data: usersData } = useUserDirectory();
  const users = usersData?.items ?? [];

  const assignMut = useAssignReaders(documentId);
  const ackMut = useAcknowledgeRead(documentId);
  const [pick, setPick] = useState<string[]>([]);

  const assigned = new Set((data?.receipts ?? []).map((r) => r.user_id));
  const pct = data && data.total > 0 ? Math.round((data.acknowledged / data.total) * 100) : 0;

  const assign = async () => {
    if (!pick.length) return;
    try {
      await assignMut.mutateAsync({ user_ids: pick });
      setPick([]);
      message.success('Readers assigned');
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  const acknowledge = async () => {
    try {
      await ackMut.mutateAsync();
      message.success('Acknowledged — read & understood');
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <BookOpenCheck size={15} className="text-gray-500" />
          Read &amp; Understood
        </h3>
        <Button
          type={data?.my_status === 'ACKNOWLEDGED' ? 'default' : 'primary'}
          icon={<CheckCircle2 size={14} />}
          onClick={acknowledge}
          loading={ackMut.isPending}
          disabled={data?.my_status === 'ACKNOWLEDGED'}
        >
          {data?.my_status === 'ACKNOWLEDGED' ? 'You acknowledged' : 'I have read & understood'}
        </Button>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>
            <span className="font-semibold text-gray-700">{data?.acknowledged ?? 0}</span> of{' '}
            {data?.total ?? 0} acknowledged
          </span>
          <span className="font-semibold text-gray-700">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Assign readers */}
      {canAssign && (
        <div className="flex items-center gap-2 mb-3">
          <Select
            mode="multiple"
            value={pick}
            onChange={setPick}
            placeholder="Assign readers…"
            showSearch
            optionFilterProp="label"
            className="flex-1"
            maxTagCount="responsive"
            options={users.map((u) => ({ value: u.id, label: u.name, disabled: assigned.has(u.id) }))}
          />
          <Button icon={<UserPlus size={14} />} onClick={assign} loading={assignMut.isPending} disabled={!pick.length}>
            Assign
          </Button>
        </div>
      )}

      {/* Receipts */}
      {isLoading ? (
        <div className="text-xs text-gray-400 py-2">Loading…</div>
      ) : (data?.receipts.length ?? 0) === 0 ? (
        <div className="text-xs text-gray-400 py-2">No readers assigned yet.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {data!.receipts.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white ${
                  r.status === 'ACKNOWLEDGED' ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                {r.status === 'ACKNOWLEDGED' ? <CheckCircle2 size={12} /> : null}
              </span>
              <span className="flex-1 text-gray-800 truncate">{r.user_name ?? r.user_id}</span>
              <span className={`text-[11px] ${r.status === 'ACKNOWLEDGED' ? 'text-emerald-700' : 'text-gray-400'}`}>
                {r.status === 'ACKNOWLEDGED'
                  ? `Acknowledged ${r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleDateString() : ''}`
                  : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    'Operation failed'
  );
}
