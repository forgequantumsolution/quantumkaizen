import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Shield, FileText, Activity, CheckCircle, AlertTriangle,
  BarChart3, ChevronRight, ArrowRight, Menu, X,
  TrendingUp, Clock, Award, Zap,
} from 'lucide-react';

// ── Floating stat card ────────────────────────────────────────────────────────
function FloatCard({
  title, children, style,
}: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '14px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        padding: '18px 22px',
        minWidth: '220px',
        ...style,
      }}
    >
      <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '10px' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Nav link ─────────────────────────────────────────────────────────────────
function NavLink({ label }: { label: string }) {
  return (
    <a
      href="#"
      style={{ fontSize: '13px', fontWeight: 500, color: '#374151', letterSpacing: '0.04em', textDecoration: 'none' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C9A84C'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
    >
      {label}
    </a>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, accent }: { icon: any; title: string; desc: string; accent: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: `3px solid ${accent}` }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <Icon size={20} style={{ color: accent }} strokeWidth={1.75} />
      </div>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '8px' }}>{title}</p>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: '#6B7280', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

// ── Compliance badge ──────────────────────────────────────────────────────────
function ComplianceBadge({ label }: { label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, color: '#374151' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
      {label}
    </div>
  );
}

// ── Main landing page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#FAFAF8', minHeight: '100vh' }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(255,255,255,0.96)' : '#fff',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #F3F4F6',
        boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 200ms',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: '#1A1A2E', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: '14px' }}>Q</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#111827' }}>
              Forge <span style={{ color: '#C9A84C' }}>Quantum</span> Solution
            </span>
          </div>

          {/* Nav links — desktop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }} className="hidden lg:flex">
            {['PRODUCT', 'FEATURES', 'HOW IT WORKS', 'COMPLIANCE', 'ROLES'].map(l => (
              <NavLink key={l} label={l} />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ fontSize: '13px', fontWeight: 600, color: '#374151', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', letterSpacing: '0.04em' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C9A84C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
            >
              SIGN IN
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{ fontSize: '13px', fontWeight: 700, color: '#fff', background: '#C9A84C', border: 'none', borderRadius: '6px', padding: '10px 22px', cursor: 'pointer', letterSpacing: '0.04em', transition: 'background 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#A88937'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#C9A84C'; }}
            >
              GET STARTED
            </button>
            <button className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{ borderTop: '1px solid #F3F4F6', padding: '16px 32px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff' }}>
            {['Product', 'Features', 'How It Works', 'Compliance', 'Roles'].map(l => (
              <a key={l} href="#" style={{ fontSize: '14px', color: '#374151', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 32px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
        {/* Left */}
        <div>
          {/* Tag */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '6px 14px', marginBottom: '32px' }}>
            <span style={{ width: '20px', height: '1px', background: '#C9A84C', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280' }}>
              Pharma Quality &amp; Lab Intelligence
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '58px', lineHeight: 1.08, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            Unified Quality.
          </h1>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '58px', lineHeight: 1.08, fontWeight: 400, fontStyle: 'italic', color: '#C9A84C', margin: '0 0 32px' }}>
            Intelligent Control.
          </h1>

          <p style={{ fontSize: '16px', color: '#6B7280', lineHeight: 1.7, maxWidth: '480px', marginBottom: '40px' }}>
            Quantum Kaizen is a GMP-compliant Pharmaceutical Quality &amp; Lab
            Intelligence platform — unifying lab registry, equipment, CAPA, audits,
            certifications, and partner management into one intelligent command centre.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '6px', padding: '14px 28px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', cursor: 'pointer', transition: 'background 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#A88937'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#C9A84C'; }}
            >
              SIGN IN TO PLATFORM
              <ArrowRight size={15} />
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '14px 28px', fontWeight: 600, fontSize: '14px', letterSpacing: '0.06em', cursor: 'pointer', transition: 'border-color 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#C9A84C'; (e.currentTarget as HTMLElement).style.color = '#C9A84C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}
            >
              EXPLORE PRODUCT
            </button>
          </div>
        </div>

        {/* Right — floating cards */}
        <div style={{ position: 'relative', height: '420px' }}>
          {/* CAPA Tracker */}
          <FloatCard title="CAPA Tracker" style={{ position: 'absolute', top: '0', right: '0', width: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
              <AlertTriangle size={15} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>3</span>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>open actions</span>
            </div>
            <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, #C9A84C, #EDAD2A)', borderRadius: '99px' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>72% resolved this month.</p>
          </FloatCard>

          {/* Cert Health */}
          <FloatCard title="Cert Health" style={{ position: 'absolute', top: '140px', left: '0', width: '220px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CheckCircle size={18} style={{ color: '#22C55E' }} />
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#22C55E' }}>96%</span>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>valid</span>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[100, 100, 100, 100, 100, 100, 100, 80, 60, 40].map((w, i) => (
                <div key={i} style={{ width: '16px', height: '6px', borderRadius: '3px', background: w === 100 ? '#22C55E' : w === 80 ? '#F59E0B' : '#E5E7EB', opacity: 0.9 }} />
              ))}
            </div>
          </FloatCard>

          {/* GMP Audit */}
          <FloatCard title="GMP Audit" style={{ position: 'absolute', bottom: '20px', right: '20px', width: '230px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EBF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={15} style={{ color: '#3B82F6' }} />
              </div>
              <div>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>92</span>
                <span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: '4px' }}>avg. score</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={13} style={{ color: '#22C55E' }} />
              <span style={{ fontSize: '12px', color: '#22C55E', fontWeight: 600 }}>+4.2% vs last quarter</span>
            </div>
          </FloatCard>

          {/* Decorative background blob */}
          <div style={{ position: 'absolute', top: '60px', left: '60px', width: '280px', height: '280px', background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ background: '#F9F7F2', borderTop: '1px solid #EDE9DC', borderBottom: '1px solid #EDE9DC' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '32px', textAlign: 'center' }}>
          {[
            { num: '12+', label: 'GMP-compliant Modules' },
            { num: '100%', label: 'Digital Audit Trail' },
            { num: '5', label: 'Role-based Access Levels' },
            { num: '21 CFR', label: 'Part 11 Ready' },
          ].map(s => (
            <div key={s.num}>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#C9A84C', marginBottom: '4px' }}>{s.num}</p>
              <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: '12px' }}>Platform Capabilities</p>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
            Everything Quality Needs.<br />Nothing It Doesn't.
          </h2>
          <p style={{ fontSize: '15px', color: '#6B7280', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Designed for regulated industries — Pharma, Chemical, Food &amp; Beverage —
            with industry-specific workflows built in from day one.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <FeatureCard icon={AlertTriangle} accent="#EF4444" title="Non-Conformance & CAPA"
            desc="Capture deviations, run root cause analysis, and track corrective actions from initiation to closure with full audit trail." />
          <FeatureCard icon={FileText} accent="#C9A84C" title="Document Management"
            desc="Version-controlled SOPs, work instructions, and templates with e-signature workflows and regulatory review cycles." />
          <FeatureCard icon={Shield} accent="#3B82F6" title="Risk Register & FMEA"
            desc="Quantified risk assessment with likelihood-severity matrices, FMEA worksheets, and automated escalation rules." />
          <FeatureCard icon={BarChart3} accent="#8B5CF6" title="Audits & Inspections"
            desc="Schedule internal and external audits, track findings, issue reports, and monitor closure rates in real time." />
          <FeatureCard icon={Activity} accent="#22C55E" title="Calibration & Maintenance"
            desc="Equipment calibration schedules, certificates, out-of-tolerance alerts, and maintenance history in one place." />
          <FeatureCard icon={Award} accent="#F59E0B" title="Training & Competency"
            desc="Assign training programs, track completion, manage competency matrices, and generate regulatory training records." />
        </div>
      </section>

      {/* ── Compliance section ── */}
      <section style={{ background: '#1A1A2E', padding: '80px 32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: '16px' }}>Compliance Ready</p>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: '20px' }}>
              Built for Regulated<br />Environments
            </h2>
            <p style={{ fontSize: '15px', color: '#9CA3AF', lineHeight: 1.7, marginBottom: '36px' }}>
              Quantum Kaizen is designed to meet the strictest regulatory requirements
              across pharmaceutical, chemical, and food &amp; beverage industries.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {['FDA 21 CFR Part 11', 'ICH Q10', 'ISO 9001:2015', 'GMP / GLP', 'EU Annex 11', 'FSSAI'].map(b => (
                <ComplianceBadge key={b} label={b} />
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { icon: Shield, label: 'E-Signature Workflows', color: '#C9A84C' },
              { icon: Clock, label: 'Automated Audit Trail', color: '#3B82F6' },
              { icon: CheckCircle, label: 'Role-Based Access', color: '#22C55E' },
              { icon: Zap, label: 'Real-time Alerts', color: '#F59E0B' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <item.icon size={22} style={{ color: item.color, marginBottom: '12px' }} strokeWidth={1.75} />
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section style={{ background: '#F9F7F2', padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
            Ready to Transform<br />Your Quality Operations?
          </h2>
          <p style={{ fontSize: '15px', color: '#6B7280', marginBottom: '36px', lineHeight: 1.7 }}>
            Join leading pharmaceutical and manufacturing organisations already running
            on Quantum Kaizen.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '6px', padding: '16px 36px', fontWeight: 700, fontSize: '15px', letterSpacing: '0.06em', cursor: 'pointer', transition: 'background 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#A88937'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#C9A84C'; }}
          >
            ACCESS PLATFORM
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#111827', padding: '32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '24px', height: '24px', background: '#C9A84C', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '11px' }}>Q</span>
          </div>
          <span style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 500 }}>Quantum Kaizen — Forge Quantum Solutions</span>
        </div>
        <p style={{ color: '#4B5563', fontSize: '12px' }}>© 2026 Forge Quantum Solutions. All rights reserved.</p>
      </footer>
    </div>
  );
}
