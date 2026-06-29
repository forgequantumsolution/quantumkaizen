import { useNavigate, useParams } from 'react-router-dom';
import { Button, Empty, Spin } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Award } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useCertificate } from '@/lib/api/lms';

export default function CertificatePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data: cert, isLoading } = useCertificate(id);

  if (isLoading) return <PageContainer><div className="flex justify-center py-20"><Spin /></div></PageContainer>;
  if (!cert) return <PageContainer><Empty description="Certificate not found" /></PageContainer>;

  const verifyUrl = cert.verify_token ? `${window.location.origin}/verify/certificate/${cert.verify_token}` : '';

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button onClick={() => nav('/lms/my')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <ArrowLeft size={14} /> My Learning
        </button>
        <Button type="primary" icon={<Printer size={14} />} onClick={() => window.print()}>Print / Save PDF</Button>
      </div>

      {/* Certificate */}
      <div className="mx-auto max-w-3xl bg-white border-[6px] border-double border-[var(--color-gold,#C9A84C)] rounded-lg p-10 text-center shadow-sm">
        <div className="flex items-center justify-center gap-2 text-[var(--color-gold,#C9A84C)] mb-2">
          <Award size={28} />
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Certificate of Completion</p>
        <h1 className="text-3xl font-serif font-bold text-gray-900 mt-6">{cert.holder_name ?? '—'}</h1>
        <p className="text-sm text-gray-500 mt-2">has successfully completed the course</p>
        <h2 className="text-xl font-semibold text-gray-800 mt-3">{cert.course_title}</h2>
        <p className="text-xs font-mono text-gray-400 mt-1">{cert.course_code}</p>

        <div className="flex items-end justify-between mt-10">
          <div className="text-left">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Issued</p>
            <p className="text-sm text-gray-800">{new Date(cert.issued_at).toLocaleDateString()}</p>
            {cert.expires_at && (
              <>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mt-2">Valid until</p>
                <p className={`text-sm ${cert.expired ? 'text-red-600' : 'text-gray-800'}`}>{new Date(cert.expires_at).toLocaleDateString()}</p>
              </>
            )}
          </div>
          <div className="text-center">
            {verifyUrl && <QRCodeSVG value={verifyUrl} size={84} />}
            <p className="text-[10px] text-gray-400 mt-1">Scan to verify</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Serial</p>
            <p className="text-sm font-mono text-gray-800">{cert.serial}</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
