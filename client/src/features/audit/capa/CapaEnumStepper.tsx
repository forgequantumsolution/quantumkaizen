import type { CapaStatus } from '@/lib/api/audit';

// Legacy CAPA lifecycle used for CAPAs that aren't running on a workflow. The
// segmented bar renders the same way regardless of progress: done = green,
// current = blue, upcoming = grey.
export const CAPA_ENUM_FLOW: { status: CapaStatus; label: string }[] = [
  { status: 'OPEN', label: 'Open' },
  { status: 'INVESTIGATION', label: 'Investigation' },
  { status: 'PLAN', label: 'Plan' },
  { status: 'IMPLEMENTATION', label: 'Implementation' },
  { status: 'VERIFICATION', label: 'Verification' },
  { status: 'CLOSED', label: 'Closed' },
];

export default function CapaEnumStepper({ status }: { status: CapaStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
        Cancelled
      </div>
    );
  }
  const currentIdx = CAPA_ENUM_FLOW.findIndex((s) => s.status === status);
  return (
    <div className="flex items-stretch gap-1.5">
      {CAPA_ENUM_FLOW.map((s, i) => {
        const done = i < currentIdx;
        const current = i === currentIdx;
        return (
          <div key={s.status} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${
                done ? 'bg-emerald-500' : current ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
            <div
              className={`mt-1.5 text-center text-[11px] ${
                current
                  ? 'font-semibold text-blue-600'
                  : done
                    ? 'text-emerald-700'
                    : 'text-gray-400'
              }`}
            >
              {s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
