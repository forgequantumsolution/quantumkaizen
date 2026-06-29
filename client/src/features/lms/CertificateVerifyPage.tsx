import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spin } from 'antd';
import { CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';
import { verifyCertificate } from '@/lib/api/lms';

export default function CertificateVerifyPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['lms', 'verify', token],
    queryFn: () => verifyCertificate(token as string),
    enabled: !!token,
  });

  const valid = !!data?.valid;
  const expired = !!data?.expired;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 text-gray-400 mb-6">
          <ShieldCheck size={18} />
          <span className="text-xs font-medium uppercase tracking-wide">Training Certificate Verification</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spin /></div>
        ) : !isError && data?.serial ? (
          <div className="text-center">
            {valid ? <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
              : expired ? <Clock size={56} className="mx-auto text-amber-500" />
              : <XCircle size={56} className="mx-auto text-red-500" />}
            <h1 className="text-lg font-bold text-gray-900 mt-3">
              {valid ? 'Authentic Certificate' : expired ? 'Certificate Expired' : 'Not Valid'}
            </h1>
            <p className="text-xs text-gray-500 mb-5">
              {valid ? 'This training certificate is valid and verified.' : expired ? 'This certificate has passed its expiry date.' : 'This certificate is not valid.'}
            </p>
            <dl className="text-left space-y-3 border-t border-gray-100 pt-4">
              <Row label="Serial" value={data.serial} mono />
              <Row label="Course" value={data.course_title} />
              <Row label="Holder" value={data.holder_name ?? '—'} />
              <Row label="Issued" value={data.issued_at ? new Date(data.issued_at).toLocaleDateString() : '—'} />
              <Row label="Expires" value={data.expires_at ? new Date(data.expires_at).toLocaleDateString() : 'No expiry'} />
            </dl>
          </div>
        ) : (
          <div className="text-center py-4">
            <XCircle size={56} className="mx-auto text-red-500" />
            <h1 className="text-lg font-bold text-gray-900 mt-3">Certificate not found</h1>
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
