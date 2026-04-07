import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Demo role quick-fill accounts
const DEMO_ACCOUNTS = [
  { role: 'Admin',       email: 'admin@forgequantum.com',   password: 'QuantumK@izen2026' },
  { role: 'QA Director', email: 'qa@forgequantum.com',      password: 'QuantumK@izen2026' },
  { role: 'Lab Head',    email: 'lab@forgequantum.com',     password: 'QuantumK@izen2026' },
  { role: 'QC Analyst',  email: 'qc@forgequantum.com',      password: 'QuantumK@izen2026' },
  { role: 'Partner',     email: 'partner@forgequantum.com', password: 'QuantumK@izen2026' },
];

// Feature pill
function FeaturePill({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: '9999px', padding: '5px 14px',
      fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.85)',
      background: 'rgba(255,255,255,0.06)',
    }}>
      {label}
    </span>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const doLogin = async (email: string, password: string) => {
    // Always try the demo fallback for known demo credentials
    const isDemo =
      (email === 'admin@forgequantum.com' && password === 'QuantumK@izen2026') ||
      DEMO_ACCOUNTS.some(a => a.email === email && a.password === password);

    if (isDemo) {
      const roleMap: Record<string, string> = {
        'admin@forgequantum.com':   'TENANT_ADMIN',
        'qa@forgequantum.com':      'QUALITY_MANAGER',
        'lab@forgequantum.com':     'LAB_HEAD',
        'qc@forgequantum.com':      'QC_ANALYST',
        'partner@forgequantum.com': 'EXTERNAL_PARTNER',
      };
      const nameMap: Record<string, string> = {
        'admin@forgequantum.com':   'Ashish Pandit',
        'qa@forgequantum.com':      'Dr. Priya Sharma',
        'lab@forgequantum.com':     'Rajesh Kumar',
        'qc@forgequantum.com':      'Anita Desai',
        'partner@forgequantum.com': 'External Partner',
      };
      useAuthStore.setState({
        user: {
          id: 'demo-001',
          tenantId: 'tenant-001',
          email,
          name: nameMap[email] ?? 'Demo User',
          role: roleMap[email] ?? 'TENANT_ADMIN',
          department: 'Management',
          employeeId: 'EMP001',
        },
        token: 'demo-token',
        isAuthenticated: true,
      });
      localStorage.setItem('qk_token', 'demo-token');
      localStorage.setItem('qk_user', JSON.stringify({
        id: 'demo-001', name: nameMap[email] ?? 'Demo User',
        role: roleMap[email] ?? 'TENANT_ADMIN', email,
        tenantId: 'tenant-001', department: 'Management', employeeId: 'EMP001',
      }));
      toast.success(`Welcome, ${nameMap[email] ?? 'Demo User'}!`);
      navigate('/dashboard');
      return;
    }

    try {
      await login(email, password, 'FORGE-QS');
      toast.success('Welcome to Quantum Kaizen');
      navigate('/dashboard');
    } catch {
      toast.error('Invalid credentials. Please try again.');
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    await doLogin(data.email, data.password);
  };

  const fillDemo = (account: typeof DEMO_ACCOUNTS[0]) => {
    setValue('email', account.email);
    setValue('password', account.password);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'DM Sans, sans-serif', position: 'relative', overflow: 'hidden' }}>

      {/* ── Background — dark lab aesthetic ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #0A0A14 0%, #111827 40%, #0D1520 100%)',
      }} />

      {/* Subtle lab grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(255,255,255,1) 49px, rgba(255,255,255,1) 50px), repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(255,255,255,1) 49px, rgba(255,255,255,1) 50px)',
      }} />

      {/* Gold glow top-left */}
      <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Blue glow bottom-right */}
      <div style={{ position: 'absolute', bottom: '-80px', right: '300px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Floating molecules / decorative circles */}
      {[
        { size: 200, top: '10%', left: '20%', opacity: 0.04 },
        { size: 120, top: '60%', left: '8%', opacity: 0.05 },
        { size: 80,  top: '30%', left: '40%', opacity: 0.03 },
        { size: 300, top: '50%', left: '55%', opacity: 0.02 },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', top: c.top, left: c.left,
          width: c.size, height: c.size,
          borderRadius: '50%', border: '1px solid rgba(201,168,76,1)',
          opacity: c.opacity, pointerEvents: 'none',
        }} />
      ))}

      {/* ── Left panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 60px', position: 'relative', zIndex: 1 }} className="hidden lg:flex">

        {/* Back to landing */}
        <button
          onClick={() => navigate('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, marginBottom: '60px', padding: 0, transition: 'color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#C9A84C'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <ArrowLeft size={14} />
          Back to home
        </button>

        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C9A84C', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Lab Management System
          </span>
        </div>

        {/* Hero text */}
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '52px', fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: '8px' }}>
          Unified Quality.
        </h1>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '52px', fontWeight: 400, fontStyle: 'italic', color: '#C9A84C', lineHeight: 1.1, marginBottom: '28px' }}>
          Intelligent Control.
        </h1>

        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: '420px', marginBottom: '40px' }}>
          Track, manage and optimise pharmaceutical lab operations
          with real-time CAPA tracking, certification monitoring, and AI-powered partner intelligence.
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {['Lab Registry', 'CAPA Management', 'Certifications', 'Audit Tracking', 'AI Lab Finder'].map(f => (
            <FeaturePill key={f} label={f} />
          ))}
        </div>
      </div>

      {/* ── Right panel — login card ── */}
      <div style={{ width: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 40px', position: 'relative', zIndex: 1 }} className="w-full lg:w-[480px]">
        <div style={{
          width: '100%',
          background: 'rgba(30,32,48,0.85)',
          backdropFilter: 'blur(24px)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '44px 40px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '52px', height: '52px', background: '#1A1A2E', borderRadius: '14px',
              border: '2px solid rgba(201,168,76,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: '20px' }}>Q</span>
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#fff' }}>
              Quantum <span style={{ color: '#C9A84C', fontStyle: 'italic', fontWeight: 400 }}>Kaizen</span>
            </h2>
          </div>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>Sign In</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', display: 'inline-block', boxShadow: '0 0 6px #22C55E' }} />
              <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>System Online</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="admin@forgequantum.com"
                  style={{
                    width: '100%', height: '46px', paddingLeft: '40px', paddingRight: '14px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', color: '#fff', fontSize: '14px',
                    outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.6)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                />
              </div>
              {errors.email && <p style={{ marginTop: '6px', fontSize: '12px', color: '#F87171' }}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{
                    width: '100%', height: '46px', paddingLeft: '40px', paddingRight: '44px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', color: '#fff', fontSize: '14px',
                    outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.6)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p style={{ marginTop: '6px', fontSize: '12px', color: '#F87171' }}>{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', height: '48px',
                background: isLoading ? '#A88937' : '#C9A84C',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontWeight: 700, fontSize: '14px', letterSpacing: '0.08em',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
              onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.background = '#A88937'; }}
              onMouseLeave={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.background = '#C9A84C'; }}
            >
              {isLoading ? (
                <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : 'SIGN IN'}
            </button>
          </form>

          {/* Demo accounts */}
          <div style={{ marginTop: '28px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: '12px' }}>
              Demo Accounts — Click to Fill
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.role}
                  onClick={() => fillDemo(a)}
                  style={{
                    padding: '6px 14px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px',
                    color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.15)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.4)';
                    (e.currentTarget as HTMLElement).style.color = '#C9A84C';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
                  }}
                >
                  {a.role}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: 'IBM Plex Mono, monospace' }}>
            Powered by Quantum Kaizen · Forge Quantum Solutions
          </p>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
