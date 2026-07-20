import { useNavigate } from 'react-router-dom';
import SectionHead from './SectionHead';
import { useDashboard } from '../context';

const AVA_COLORS = ['#7c5cd6', '#2f6fed', '#15a34a', '#e08a1e', '#d6342c', '#0ea5e9', '#b97f17'];

function actionClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('creat')) return 'create';
  if (a.includes('approv')) return 'approve';
  if (a.includes('clos')) return 'close';
  if (a.includes('publish')) return 'publish';
  return 'update';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'SY';
}

function entityLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', ' ·');
}

export default function RecentActivity() {
  const navigate = useNavigate();
  const { data } = useDashboard();
  const rows = data?.panels.activity.items ?? [];

  return (
    <>
      <SectionHead title="Recent Activity" tag="21 CFR Part 11 audit trail" />
      <div className="card d1" style={{ padding: '18px 4px 6px' }}>
        <div className="card-h" style={{ padding: '0 16px 8px' }}>
          <div>
            <h3>Audit Log</h3>
            <div className="sub">Immutable, time-stamped electronic records</div>
          </div>
          <button className="link" style={{ alignSelf: 'center' }} type="button" onClick={() => navigate('/audit/non-conformance')}>
            View full log →
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Action</th>
              <th>Record</th>
              <th>User</th>
              <th style={{ textAlign: 'right' }}>Timestamp (IST)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td><span className={`act ${actionClass(r.action)}`}>{r.action}</span></td>
                <td>
                  <span className="rec">
                    <span className="ty">{entityLabel(r.entityType)}</span>
                    <span className="code">{r.entityId}</span>
                  </span>
                </td>
                <td>
                  <span className="user">
                    <span className="ava" style={{ background: AVA_COLORS[i % AVA_COLORS.length] }}>{initials(r.userName)}</span>
                    {r.userName}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="ts">{fmtTs(r.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
