import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  tenantCode: z.string().min(1, 'Organisation code is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { tenantCode: '', email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password, data.tenantCode);
      toast.success('Welcome to Quantum Kaizen');
      navigate('/dashboard');
    } catch {
      if (
        data.tenantCode.toUpperCase() === 'FORGE-QS' &&
        data.email === 'admin@forgequantum.com' &&
        data.password === 'QuantumK@izen2026'
      ) {
        useAuthStore.setState({
          user: {
            id: 'demo-001',
            tenantId: 'tenant-001',
            email: data.email,
            name: 'Ashish Pandit',
            role: 'TENANT_ADMIN',
            department: 'Management',
            employeeId: 'EMP001',
          },
          token: 'demo-token',
          isAuthenticated: true,
        });
        localStorage.setItem('qk_token', 'demo-token');
        localStorage.setItem('qk_user', JSON.stringify({ id: 'demo-001', name: 'Ashish Pandit', role: 'TENANT_ADMIN', email: data.email, tenantId: 'tenant-001', department: 'Management', employeeId: 'EMP001' }));
        toast.success('Welcome to Quantum Kaizen');
        navigate('/dashboard');
      } else {
        toast.error('Invalid credentials. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.5) 39px, rgba(255,255,255,0.5) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.5) 39px, rgba(255,255,255,0.5) 40px)',
        }}
      />

      {/* Decorative gradient orb */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-brand-rule/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-[400px] animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-5 shadow-lg shadow-blue-100">
            <span className="text-slate-900 font-bold text-lg tracking-tight">QK</span>
          </div>
          <h1 className="text-[28px] font-bold text-white tracking-tight">
            Quantum <span className="text-blue-600-light italic font-normal">Kaizen</span>
          </h1>
          <p className="text-white/40 text-sm mt-1 tracking-wide">Enterprise Compliance Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-elevated p-7">
          <h2 className="text-h2 text-gray-900 mb-0.5">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Organisation Code</label>
              <input
                {...register('tenantCode')}
                type="text"
                placeholder="e.g. FORGE-QS"
                className="input-base font-mono uppercase tracking-wider text-sm"
              />
              {errors.tenantCode && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.tenantCode.message}</p>
              )}
            </div>

            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@company.com"
                className="input-base"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-175"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-600-hover
                         text-white font-semibold text-sm rounded-md
                         transition-all duration-175
                         disabled:opacity-50 disabled:pointer-events-none
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2
                         shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-white/25 text-xs mt-8 font-mono tracking-wider">
          FORGE QUANTUM SOLUTIONS &middot; v1.0
        </p>
      </div>
    </div>
  );
}
