import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import './LoginPage.css';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const TENANT_CODE = 'AURORA-PH';

const PILLS = ['Document Control', 'CAPA', 'Risk Management', 'Training & LMS', 'Audits', '21 CFR Part 11'];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      await login(data.email, data.password, TENANT_CODE);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: 'url(/factory-bg.jpg)' }}>
      <div className="login-overlay" />

      <div className="login-brand">
        <div className="login-brand-eyebrow">
          <span className="login-brand-dot" />
          <span className="login-brand-eyebrow-text">Enterprise Quality Management</span>
        </div>

        <h1 className="login-brand-headline">
          Uncompromising Quality.<br />
          <em>Continuous Improvement.</em>
        </h1>

        <p className="login-brand-desc">
          Enterprise QMS for manufacturing and regulated industries — Document
          Control, CAPA, Risk, Training, Audits and 21 CFR Part 11 e-signatures,
          unified in a single compliance platform.
        </p>

        <div className="login-brand-pills">
          {PILLS.map((p) => (
            <span key={p} className="login-brand-pill">{p}</span>
          ))}
        </div>
      </div>

      <div className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-top">
            <img src="/golden_blue_logo.png" alt="Quantum Kaizen" className="login-card-logo" />
            <div className="login-card-product">
              Quantum <span>Kaizen</span>
            </div>
          </div>

          <div className="login-card-body">
            <div className="login-card-title-row">
              <h2 className="login-card-title">Sign In</h2>
              <div className="login-status">
                <span className="login-status-dot" />
                System Online
              </div>
            </div>

            {(error || errors.email || errors.password) && (
              <div className="login-error">
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                {error || errors.email?.message || errors.password?.message}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="login-field">
                <label className="login-field-label">Email address</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><Mail size={14} /></span>
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="you@example.com"
                    className="login-input"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-field-label">Password</label>
                <div className="login-field-wrap">
                  <span className="login-field-icon"><Lock size={14} /></span>
                  <input
                    {...register('password')}
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="login-input"
                    style={{ paddingRight: 40 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-pw-toggle"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="login-submit">
                {isLoading && <span className="login-spinner" />}
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="login-card-footer">
            Powered by Quantum Kaizen · Forge Quantum Solutions
          </div>
        </div>
      </div>
    </div>
  );
}
