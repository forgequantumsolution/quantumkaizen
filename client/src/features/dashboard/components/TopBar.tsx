import { useDashboard, SEG_TO_RANGE, RANGE_TO_SEG } from '../context';
import { useAuthStore } from '@/stores/authStore';
import { useSiteStore } from '@/stores/siteStore';

const RANGES = ['7D', '1M', '3M', '12M', '3Y'] as const;

export default function TopBar() {
  const { range, setRange, data, isSample } = useDashboard();
  const activeSeg = RANGE_TO_SEG[range];

  const allowedSites = useAuthStore((s) => s.user?.allowedSites ?? []);
  const selectedSiteId = useSiteStore((s) => s.selectedSiteId);
  const setSelectedSiteId = useSiteStore((s) => s.setSelectedSiteId);

  const scope = data?.scope;
  const orgName = scope?.organization?.name ?? 'Quantum Kairoz';
  const siteLabel = scope?.site ? scope.site.name : (scope?.canViewAll ? 'All Sites' : scope?.department ?? 'My Scope');
  const roleLabel = scope?.role && scope.role !== 'NONE' ? scope.role : null;
  const canViewAll = scope?.canViewAll ?? false;

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

        {/* Site filter — scopes the whole dashboard. Only offered to users who
            may view more than one site; single-site users have nothing to pick. */}
        {(canViewAll || allowedSites.length > 1) && (
          <div className="site-filter">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 21h16M6 21V8l6-4 6 4v13M10 12h4M10 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select
              value={selectedSiteId ?? ''}
              onChange={(e) => setSelectedSiteId(e.target.value || null)}
              aria-label="Filter by site"
            >
              {canViewAll && <option value="">All Sites</option>}
              {allowedSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </header>
  );
}
