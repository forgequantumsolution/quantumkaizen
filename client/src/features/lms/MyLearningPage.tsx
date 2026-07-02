import { useNavigate } from 'react-router-dom';
import { Button, Empty, Progress, Tag } from 'antd';
import { GraduationCap, Compass, Clock, CheckCircle2, AlertTriangle, Award } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useMyLearning, useMyCertificates, type EnrollmentStatus, type MyEnrollment } from '@/lib/api/lms';

const STATUS: Record<EnrollmentStatus, { color: string; label: string }> = {
  ASSIGNED: { color: 'blue', label: 'Not started' },
  IN_PROGRESS: { color: 'gold', label: 'In progress' },
  COMPLETED: { color: 'green', label: 'Completed' },
  FAILED: { color: 'red', label: 'Failed' },
  OVERDUE: { color: 'red', label: 'Overdue' },
  WAIVED: { color: 'default', label: 'Waived' },
};

function EnrollmentCard({ e, onOpen }: { e: MyEnrollment; onOpen: () => void }) {
  const st = STATUS[e.status];
  const overdue = e.due_date && new Date(e.due_date) < new Date() && e.status !== 'COMPLETED' && e.status !== 'WAIVED';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{e.title}</p>
          <p className="text-[11px] font-mono text-gray-400">{e.code} · v{e.course_version}</p>
        </div>
        <Tag color={overdue ? 'red' : st.color}>{overdue ? 'Overdue' : st.label}</Tag>
      </div>
      <div className="mt-3">
        <Progress percent={e.progress_pct} size="small" status={e.status === 'COMPLETED' ? 'success' : 'active'} />
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          {e.status === 'COMPLETED' ? <CheckCircle2 size={12} className="text-green-600" /> : <Clock size={12} />}
          {e.estimated_minutes ? `${e.estimated_minutes} min` : '—'}
        </span>
        {e.due_date && <span>Due {new Date(e.due_date).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

export default function MyLearningPage() {
  const nav = useNavigate();
  const { data, isLoading } = useMyLearning();
  const { data: certs } = useMyCertificates();

  const items = data?.items ?? [];
  const inProgress = items.filter((i) => i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS');
  const done = items.filter((i) => i.status === 'COMPLETED');

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={22} className="text-gray-500" /> My Training
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Your assigned and self-enrolled courses.</p>
        </div>
        <Button icon={<Compass size={14} />} onClick={() => nav('/lms/catalog')}>Browse catalog</Button>
      </div>

      {(data?.overdue ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={15} /> You have {data?.overdue} overdue course{data?.overdue === 1 ? '' : 's'}.
        </div>
      )}

      {isLoading ? null : items.length === 0 ? (
        <Empty description="No courses yet. Browse the catalog to enrol.">
          <Button type="primary" onClick={() => nav('/lms/catalog')}>Browse catalog</Button>
        </Empty>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">To do ({inProgress.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {inProgress.map((e) => (
              <EnrollmentCard key={e.enrollment_id} e={e} onOpen={() => nav(`/lms/learn/${e.enrollment_id}`)} />
            ))}
            {inProgress.length === 0 && <p className="text-sm text-gray-400">All caught up 🎉</p>}
          </div>

          {done.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Completed ({done.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {done.map((e) => (
                  <EnrollmentCard key={e.enrollment_id} e={e} onOpen={() => nav(`/lms/learn/${e.enrollment_id}`)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* My certificates */}
      {(certs?.length ?? 0) > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <Award size={15} /> My Certificates ({certs?.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {certs?.map((c) => (
              <button
                key={c.id}
                onClick={() => nav(`/lms/certificate/${c.id}`)}
                className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 truncate">{c.course_title}</span>
                  {c.expired ? <Tag color="red">Expired</Tag> : <Tag color="green">Valid</Tag>}
                </div>
                <p className="text-[11px] font-mono text-gray-400 mt-1">{c.serial}</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Issued {new Date(c.issued_at).toLocaleDateString()}
                  {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
