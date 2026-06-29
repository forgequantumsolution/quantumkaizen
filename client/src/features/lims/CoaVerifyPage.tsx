import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useVerifyCoa } from '@/lib/api/coa';

export default function CoaVerifyPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useVerifyCoa(token);

  const valid = !!data?.valid;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 text-gray-400 mb-6">
          <ShieldCheck size={18} />
          <span className="text-xs font-medium uppercase tracking-wide">Certificate Verification</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spin /></div>
        ) : !isError && valid ? (
          <div className="text-center">
            <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
            <h1 className="text-lg font-bold text-gray-900 mt-3">Authentic Certificate</h1>
            <p className="text-xs text-gray-500 mb-5">This certificate of analysis is valid and verified.</p>
            <dl className="text-left space-y-3 border-t border-gray-100 pt-4">
              <Row label="Certificate No." value={data?.coa_number} mono />
              <Row label="Product" value={data?.product_name} />
              <Row label="Batch" value={data?.batch_no ?? '—'} />
              <Row label="Status" value={data?.status} />
              <Row label="Issued" value={data?.issued_at ? new Date(data.issued_at).toLocaleString() : '—'} />
              {data?.conclusion && <Row label="Conclusion" value={data.conclusion} />}
            </dl>
          </div>
        ) : (
          <div className="text-center py-4">
            <XCircle size={56} className="mx-auto text-red-500" />
            <h1 className="text-lg font-bold text-gray-900 mt-3">Certificate not found or not valid</h1>
            <p className="text-xs text-gray-500 mt-1">This verification link does not match any issued certificate.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[11px] text-gray-500 uppercase tracking-wide shrink-0">{label}</dt>
      <dd className={`text-sm text-gray-900 text-right ${mono ? 'font-mono text-blue-600' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}
