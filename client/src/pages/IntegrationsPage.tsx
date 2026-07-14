import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Search, Plug, CheckCircle2, Clock, ArrowUpRight, Sparkles,
  Building2, FlaskConical, PenTool, ShieldCheck, MessageSquare,
  BarChart3, Database, Webhook, Mail, Cloud, Boxes, Cable,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';

type Status = 'connected' | 'available' | 'coming-soon';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: LucideIcon;
  accent: string;
  status: Status;
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: Boxes },
  { key: 'erp', label: 'ERP & Business', icon: Building2 },
  { key: 'lab', label: 'Lab & Instruments', icon: FlaskConical },
  { key: 'docs', label: 'Documents & eSign', icon: PenTool },
  { key: 'identity', label: 'Identity & SSO', icon: ShieldCheck },
  { key: 'comms', label: 'Communication', icon: MessageSquare },
  { key: 'bi', label: 'Analytics & BI', icon: BarChart3 },
  { key: 'storage', label: 'Storage & Files', icon: Cloud },
  { key: 'dev', label: 'Developer', icon: Webhook },
] as const;

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
);

const INTEGRATIONS: Integration[] = [
  { id: 'sap', name: 'SAP ERP', category: 'erp', icon: Building2, accent: '#0FAAFF', status: 'available',
    description: 'Sync material master, batches and vendor data with SAP for end-to-end traceability.' },
  { id: 'oracle', name: 'Oracle NetSuite', category: 'erp', icon: Building2, accent: '#1F6FEB', status: 'available',
    description: 'Push quality events and pull purchase / GRN records from NetSuite.' },
  { id: 'dynamics', name: 'Microsoft Dynamics 365', category: 'erp', icon: Building2, accent: '#6C5CE7', status: 'coming-soon',
    description: 'Two-way sync of supplier, item and inventory data with Dynamics.' },

  { id: 'empower', name: 'Waters Empower', category: 'lab', icon: FlaskConical, accent: '#0A8F5B', status: 'coming-soon',
    description: 'Import chromatography results (CDS) directly into LIMS sample tests.' },
  { id: 'chromeleon', name: 'Thermo Chromeleon', category: 'lab', icon: FlaskConical, accent: '#E23F2A', status: 'coming-soon',
    description: 'Pull instrument runs and OOS / OOT flags from Chromeleon CDS.' },
  { id: 'instruments', name: 'Instrument Interface', category: 'lab', icon: Cable, accent: '#0891B2', status: 'available',
    description: 'Capture balances, pH meters and analysers (OPC / RS-232) straight into worklists.' },

  { id: 'docusign', name: 'DocuSign', category: 'docs', icon: PenTool, accent: '#C99A06', status: 'available',
    description: '21 CFR Part 11 compliant electronic signatures on controlled documents.' },
  { id: 'adobesign', name: 'Adobe Acrobat Sign', category: 'docs', icon: PenTool, accent: '#E1341E', status: 'available',
    description: 'Route SOPs and change controls for compliant e-signature approval.' },
  { id: 'sharepoint', name: 'SharePoint / OneDrive', category: 'docs', icon: Cloud, accent: '#0364B8', status: 'available',
    description: 'Link and archive controlled documents to your SharePoint library.' },

  { id: 'entra', name: 'Microsoft Entra ID', category: 'identity', icon: ShieldCheck, accent: '#0F6CBD', status: 'connected',
    description: 'Single sign-on and automated user provisioning via SAML / SCIM.' },
  { id: 'okta', name: 'Okta', category: 'identity', icon: ShieldCheck, accent: '#1B2A6B', status: 'available',
    description: 'Enterprise SSO with MFA and lifecycle management.' },
  { id: 'ldap', name: 'LDAP / Active Directory', category: 'identity', icon: ShieldCheck, accent: '#475569', status: 'available',
    description: 'Authenticate against on-premise directory services.' },

  { id: 'm365', name: 'Microsoft 365 & Outlook', category: 'comms', icon: Mail, accent: '#D83B01', status: 'connected',
    description: 'Send task, approval and escalation notifications via Outlook mail.' },
  { id: 'teams', name: 'Microsoft Teams', category: 'comms', icon: MessageSquare, accent: '#5059C9', status: 'available',
    description: 'Post CAPA, deviation and audit alerts to Teams channels.' },
  { id: 'slack', name: 'Slack', category: 'comms', icon: MessageSquare, accent: '#611F69', status: 'available',
    description: 'Real-time quality-event notifications in your Slack workspace.' },
  { id: 'twilio', name: 'Twilio SMS', category: 'comms', icon: MessageSquare, accent: '#F22F46', status: 'available',
    description: 'Critical overdue / OOS alerts by SMS to on-call staff.' },

  { id: 'powerbi', name: 'Microsoft Power BI', category: 'bi', icon: BarChart3, accent: '#C9A404', status: 'available',
    description: 'Stream aggregated KPI data to Power BI for management review.' },
  { id: 'tableau', name: 'Tableau', category: 'bi', icon: BarChart3, accent: '#1F457E', status: 'available',
    description: 'Publish quality metrics to Tableau dashboards.' },

  { id: 's3', name: 'Amazon S3', category: 'storage', icon: Cloud, accent: '#E88B00', status: 'available',
    description: 'Store attachments and audit evidence in an S3 bucket.' },
  { id: 'azureblob', name: 'Azure Blob Storage', category: 'storage', icon: Database, accent: '#0089D6', status: 'available',
    description: 'Compliant long-term retention of records in Azure Blob.' },

  { id: 'rest', name: 'REST API & Webhooks', category: 'dev', icon: Webhook, accent: '#111827', status: 'connected',
    description: 'Build custom integrations with our documented REST API and event webhooks.' },
  { id: 'zapier', name: 'Zapier', category: 'dev', icon: Sparkles, accent: '#FF4A00', status: 'available',
    description: 'Automate no-code workflows across 6,000+ apps.' },
  { id: 'veeva', name: 'Veeva Vault', category: 'dev', icon: Boxes, accent: '#E4002B', status: 'coming-soon',
    description: 'Exchange controlled content with Veeva Vault QualityDocs.' },
];

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  connected: { label: 'Connected', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  available: { label: 'Available', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'coming-soon': { label: 'Coming soon', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

// Tools shown orbiting the hub (a representative, colourful mix).
const HUB_NODES = ['entra', 'm365', 'powerbi', 'docusign', 'slack', 'sap'];

export default function IntegrationsPage() {
  const [cat, setCat] = useState<string>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (it: Integration) =>
    !q || it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q);

  const list = useMemo(
    () => INTEGRATIONS.filter((it) => (cat === 'all' || it.category === cat) && matches(it)),
    [cat, q],
  );

  const grouped = useMemo(() => {
    if (cat !== 'all') return null;
    return CATEGORIES.filter((c) => c.key !== 'all')
      .map((c) => ({ ...c, items: INTEGRATIONS.filter((it) => it.category === c.key && matches(it)) }))
      .filter((g) => g.items.length > 0);
  }, [cat, q]);

  const counts = useMemo(
    () => ({
      connected: INTEGRATIONS.filter((i) => i.status === 'connected').length,
      available: INTEGRATIONS.filter((i) => i.status === 'available').length,
      total: INTEGRATIONS.length,
    }),
    [],
  );
  const catCount = (key: string) =>
    key === 'all' ? INTEGRATIONS.length : INTEGRATIONS.filter((i) => i.category === key).length;

  const act = (it: Integration) => {
    if (it.status === 'coming-soon') toast.success(`We'll notify you when ${it.name} is ready.`);
    else if (it.status === 'connected') toast(`${it.name} settings — configuration UI coming soon.`, { icon: '⚙️' });
    else toast.success(`Connection flow for ${it.name} will open here.`);
  };

  return (
    <PageContainer>
      <style>{`
        @keyframes qk-float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }
        @keyframes qk-dash { to { stroke-dashoffset: -24 } }
        @keyframes qk-pulse { 0%,100%{ opacity:.35; transform:scale(1) } 50%{ opacity:.7; transform:scale(1.06) } }
        @keyframes qk-spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200/70 bg-[#0f1522] text-white shadow-lg">
        {/* dotted texture + glows */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-gold-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-24 bottom-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative grid items-center gap-6 p-7 lg:grid-cols-[1.1fr_.9fr] lg:p-9">
          {/* Left */}
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gold-300">
              <Plug size={12} /> Integrations
            </div>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white sm:text-3xl">
              Connect Quantum Kairoz<br className="hidden sm:block" /> with your entire stack
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              Link the QMS with the ERP, laboratory, identity, communication and analytics tools
              your quality teams already rely on — plus a full REST API and webhooks for anything custom.
            </p>

            {/* Search */}
            <div className="relative mt-5 max-w-md">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search integrations…"
                className="h-11 w-full rounded-xl border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur transition focus:border-gold-400/60 focus:bg-white/15"
              />
            </div>

            {/* inline stats */}
            <div className="mt-5 flex flex-wrap gap-5">
              <Stat value={counts.connected} label="Connected" tone="text-emerald-400" />
              <span className="w-px self-stretch bg-white/10" />
              <Stat value={counts.available} label="Available" tone="text-sky-400" />
              <span className="w-px self-stretch bg-white/10" />
              <Stat value={counts.total} label="Total connectors" tone="text-gold-300" />
            </div>
          </div>

          {/* Right — connection hub */}
          <div className="hidden justify-center lg:flex">
            <ConnectionHub />
          </div>
        </div>
      </div>

      {/* ── Category segmented control ───────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = cat === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                active
                  ? 'border-gold-300 bg-gold-500 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
              )}
            >
              <Icon size={13} />
              {c.label}
              <span className={cn(
                'ml-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500',
              )}>
                {catCount(c.key)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {list.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Search size={20} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No integrations match “{query}”.</p>
        </div>
      ) : grouped ? (
        <div className="mt-6 space-y-8">
          {grouped.map((g) => {
            const Icon = g.icon;
            return (
              <section key={g.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white">
                    <Icon size={14} />
                  </span>
                  <h2 className="text-[15px] font-bold text-gray-900">{g.label}</h2>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                    {g.items.length}
                  </span>
                </div>
                <Grid items={g.items} onAct={act} />
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 text-[13px] font-semibold text-gray-500">
            {CATEGORY_LABEL[cat]} · {list.length}
          </div>
          <Grid items={list} onAct={act} />
        </div>
      )}

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gold-50/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
            <Webhook size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Don't see your tool?</p>
            <p className="text-[12px] text-gray-500">Build it with our REST API &amp; webhooks, or request a new connector.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toast.success('Thanks! Your integration request has been noted.')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-gold-600"
        >
          Request an integration <ArrowUpRight size={15} />
        </button>
      </div>
    </PageContainer>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div>
      <div className={cn('text-2xl font-bold leading-none tabular-nums', tone)}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/45">{label}</div>
    </div>
  );
}

function Grid({ items, onAct }: { items: Integration[]; onAct: (it: Integration) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => (
        <IntegrationCard key={it.id} it={it} onAct={onAct} />
      ))}
    </div>
  );
}

function IntegrationCard({ it, onAct }: { it: Integration; onAct: (it: Integration) => void }) {
  const Icon = it.icon;
  const s = STATUS_META[it.status];
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-[0_16px_36px_-16px_rgba(16,24,40,0.28)]"
    >
      {/* accent wash that appears on hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(180deg, ${it.accent}14, transparent)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-black/5"
          style={{ backgroundColor: `${it.accent}18`, color: it.accent }}
        >
          <Icon size={23} />
        </span>
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold', s.cls)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
          {s.label}
        </span>
      </div>
      <h3 className="relative mt-3.5 text-[15px] font-semibold text-gray-900">{it.name}</h3>
      <p className="relative mt-1 flex-1 text-[12.5px] leading-relaxed text-gray-500">{it.description}</p>
      <button
        type="button"
        onClick={() => onAct(it)}
        disabled={it.status === 'coming-soon'}
        className={cn(
          'relative mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold transition-colors',
          it.status === 'connected'
            ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            : it.status === 'available'
              ? 'bg-gray-900 text-white hover:bg-gray-700'
              : 'cursor-not-allowed border border-dashed border-gray-200 text-gray-400',
        )}
      >
        {it.status === 'connected' ? (
          <><CheckCircle2 size={14} /> Manage</>
        ) : it.status === 'available' ? (
          <>Connect <Plug size={13} /></>
        ) : (
          <>Notify me <Clock size={13} /></>
        )}
      </button>
    </div>
  );
}

/** Quantum Kairoz at the centre, wired to a ring of orbiting tool icons. */
function ConnectionHub() {
  const size = 340;
  const c = size / 2;
  const r = 128;
  const nodes = HUB_NODES.map((id) => INTEGRATIONS.find((i) => i.id === id)!).filter(Boolean);
  const pts = nodes.map((_, i) => {
    const a = (Math.PI * 2 * i) / nodes.length - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* rotating dashed guide ring */}
      <div
        className="absolute rounded-full border border-dashed border-white/15"
        style={{ inset: 26, animation: 'qk-spin 46s linear infinite' }}
      />
      {/* connector lines */}
      <svg width={size} height={size} className="absolute inset-0">
        {pts.map((p, i) => (
          <line
            key={i}
            x1={c} y1={c} x2={p.x} y2={p.y}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.5}
            strokeDasharray="4 6"
            style={{ animation: 'qk-dash 1.4s linear infinite' }}
          />
        ))}
      </svg>

      {/* centre glow */}
      <div className="absolute rounded-full bg-gold-500/25 blur-2xl"
        style={{ width: 120, height: 120, left: c - 60, top: c - 60, animation: 'qk-pulse 3.2s ease-in-out infinite' }} />

      {/* centre node */}
      <div
        className="absolute flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-[#0f1522] shadow-xl ring-4 ring-white/10"
        style={{ width: 76, height: 76, left: c - 38, top: c - 38 }}
      >
        <span className="text-2xl font-black leading-none">Q</span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider">Kairoz</span>
      </div>

      {/* satellite nodes */}
      {nodes.map((n, i) => {
        const Icon = n.icon;
        const p = pts[i]!;
        const connected = n.status === 'connected';
        return (
          <div
            key={n.id}
            title={n.name}
            className="absolute flex items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-black/5"
            style={{
              width: 48, height: 48, left: p.x - 24, top: p.y - 24,
              color: n.accent, animation: `qk-float ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`,
            }}
          >
            <Icon size={22} />
            {connected && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#0f1522]">
                <CheckCircle2 size={10} className="text-white" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
