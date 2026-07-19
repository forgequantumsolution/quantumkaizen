import { useNavigate } from 'react-router-dom';
import { useDashboard, SEG_TO_RANGE, RANGE_TO_SEG } from '../context';

const RANGES = ['7D', '1M', '3M', '12M', '3Y'] as const;

export default function TopBar() {
  const navigate = useNavigate();
  const { range, setRange, data, isSample } = useDashboard();
  const activeSeg = RANGE_TO_SEG[range];

  const scope = data?.scope;
  const orgName = scope?.organization?.name ?? 'Quantum Kairoz';
  const siteLabel = scope?.site ? scope.site.name : (scope?.canViewAll ? 'All Sites' : scope?.department ?? 'My Scope');
  const roleLabel = scope?.role && scope.role !== 'NONE' ? scope.role : null;

  const updated = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <header className="top">
      <div className="top-inner">
        <div className="brand">
          <div className="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m8.5 12 2.4 2.4L15.5 9.6" stroke="#d8a23a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1>Quality Command Center</h1>
            <div className="crumb">
              <b>{orgName}</b>
              <span className="dot" />
              {siteLabel}
              {roleLabel && <><span className="dot" />{roleLabel}</>}
            </div>
          </div>
        </div>

        <div className="spacer" />

        <div className="updated">
          <span className="live" />
          {isSample ? 'Sample data' : 'Live'} · {updated}
        </div>

        <div className="seg">
          {RANGES.map((r) => (
            <button
              key={r}
              className={activeSeg === r ? 'active' : ''}
              onClick={() => setRange(SEG_TO_RANGE[r])}
              type="button"
            >
              {r}
            </button>
          ))}
        </div>

        <div className="qa-bar">
          <button className="btn-primary" type="button" title="Report Non-Conformance" onClick={() => navigate('/audit/non-conformance')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
            Report NC
          </button>
          <button className="qa-btn" type="button" title="Create Document" onClick={() => navigate('/forms/new')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" /></svg>
            <span>Document</span>
          </button>
          <button className="qa-btn" type="button" title="Schedule Audit" onClick={() => navigate('/audit/register')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M4 9h16M9 3v4M15 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span>Audit</span>
          </button>
          <button className="qa-btn" type="button" title="New CAPA" onClick={() => navigate('/workflows')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 4h6l1 3h3v13H5V7h3l1-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <span>CAPA</span>
          </button>
          <button className="qa-btn" type="button" title="Log Complaint" onClick={() => navigate('/tickets')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <span>Complaint</span>
          </button>
        </div>
      </div>
    </header>
  );
}
