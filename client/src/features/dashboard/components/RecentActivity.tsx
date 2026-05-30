import { useNavigate } from 'react-router-dom';
import SectionHead from './SectionHead';

type ActionType = 'create' | 'approve' | 'close' | 'update' | 'publish';

type Row = {
  action: ActionType;
  actionLabel: string;
  type: string;
  code: string;
  user: string;
  initials: string;
  avaBg: string;
  ts: string;
};

const ROWS: Row[] = [
  { action: 'create',  actionLabel: 'CREATE',  type: 'Non-Conformance', code: 'NC-2024-0312',   user: 'Priya Sharma',  initials: 'PS', avaBg: '#7c5cd6', ts: '28 Dec 2024 · 02:30 pm' },
  { action: 'approve', actionLabel: 'APPROVE', type: 'Document',        code: 'SOP-QC-088',     user: 'Rajesh Kumar',  initials: 'RK', avaBg: '#2f6fed', ts: '26 Dec 2024 · 08:00 pm' },
  { action: 'close',   actionLabel: 'CLOSE',   type: 'CAPA',            code: 'CAPA-2024-0201', user: 'Anita Desai',   initials: 'AD', avaBg: '#15a34a', ts: '24 Dec 2024 · 04:30 pm' },
  { action: 'update',  actionLabel: 'UPDATE',  type: 'Non-Conformance', code: 'NC-2024-0308',   user: 'Vikram Patel',  initials: 'VP', avaBg: '#e08a1e', ts: '20 Dec 2024 · 02:45 pm' },
  { action: 'publish', actionLabel: 'PUBLISH', type: 'Document',        code: 'BMR-2024-112',   user: 'Sunita Rao',    initials: 'SR', avaBg: '#d6342c', ts: '15 Dec 2024 · 09:30 pm' },
];

export default function RecentActivity() {
  const navigate = useNavigate();
  return (
    <>
      <SectionHead title="Recent Activity" tag="21 CFR Part 11 audit trail" />
      <div className="card d1" style={{ padding: '18px 4px 6px' }}>
        <div className="card-h" style={{ padding: '0 16px 8px' }}>
          <div>
            <h3>Audit Log</h3>
            <div className="sub">Immutable, time-stamped electronic records</div>
          </div>
          <button
            className="link"
            style={{ alignSelf: 'center' }}
            type="button"
            onClick={() => navigate('/audit/non-conformance')}
          >
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
            {ROWS.map((r, i) => (
              <tr key={i}>
                <td><span className={`act ${r.action}`}>{r.actionLabel}</span></td>
                <td>
                  <span className="rec">
                    <span className="ty">{r.type}</span>
                    <span className="code">{r.code}</span>
                  </span>
                </td>
                <td>
                  <span className="user">
                    <span className="ava" style={{ background: r.avaBg }}>{r.initials}</span>
                    {r.user}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="ts">{r.ts}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
