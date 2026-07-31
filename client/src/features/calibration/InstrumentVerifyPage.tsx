import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { CheckCircle2, XCircle, AlertTriangle, Ruler } from 'lucide-react';
import { useVerifyInstrument } from '@/lib/api/calibration';

/**
 * Public calibration-label verification — no auth, reached by scanning the QR
 * on an instrument's sticker. Mirrors CoaVerifyPage / CertificateVerifyPage.
 *
 * Written for someone standing at the bench holding the instrument, so the
 * verdict — may I use this? — is the largest thing on the page. A sticker can
 * be stale or peeled off the wrong device; this is the live answer.
 */
export default function InstrumentVerifyPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useVerifyInstrument(token);

  const known = !isError && !!data;
  const usable = known && data.usable;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 text-gray-400 mb-6">
          <Ruler size={18} />
          <span className="text-xs font-medium uppercase tracking-wide">Calibration Status</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spin />
          </div>
        ) : !known ? (
          <div className="text-center">
            <XCircle size={56} className="mx-auto text-red-500" />
            <h1 className="text-lg font-bold text-gray-900 mt-3">Unknown label</h1>
            <p className="text-xs text-gray-500">
              This code does not match any registered instrument. It may be from a retired sticker — do not rely on it.
            </p>
          </div>
        ) : (
          <div className="text-center">
            {usable ? (
              <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
            ) : data.calibration_status === 'LIMITED_USE' ? (
              <AlertTriangle size={56} className="mx-auto text-orange-500" />
            ) : (
              <XCircle size={56} className="mx-auto text-red-500" />
            )}

            <h1 className={`text-lg font-bold mt-3 ${usable ? 'text-emerald-700' : 'text-red-700'}`}>
              {usable ? 'Cleared for use' : 'Do not use'}
            </h1>
            <p className="text-xs text-gray-600 mb-5">{data.message}</p>

            <dl className="text-left space-y-3 border-t border-gray-100 pt-4">
              <Row label="Instrument" value={data.code} mono />
              <Row label="Description" value={data.name} />
              {data.serial_no && <Row label="Serial no." value={data.serial_no} mono />}
              {data.location && <Row label="Location" value={data.location} />}
              <Row label="Status" value={data.calibration_status.replace(/_/g, ' ')} />
              <Row
                label="Last calibrated"
                value={data.last_calibrated_at ? new Date(data.last_calibrated_at).toLocaleDateString() : '—'}
              />
              <Row
                label="Next due"
                value={
                  data.calibration_due_at ? (
                    <span className={data.days_until_due !== null && data.days_until_due < 0 ? 'text-red-600 font-semibold' : ''}>
                      {new Date(data.calibration_due_at).toLocaleDateString()}
                      {data.days_until_due !== null && (
                        <span className="text-gray-400 font-normal ml-1">
                          ({data.days_until_due < 0 ? `${-data.days_until_due} days overdue` : `in ${data.days_until_due} days`})
                        </span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>

            <p className="text-[10px] text-gray-400 mt-5">
              Checked live at {new Date(data.verified_at).toLocaleString()} — not read from the sticker.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-gray-500 shrink-0">{label}</dt>
      <dd className={`text-sm text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
