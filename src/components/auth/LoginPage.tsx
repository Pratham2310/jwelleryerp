import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Key, Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { DEFAULT_ROLES } from '../../lib/permissions';

interface LoginPageProps {
  onLoginSuccess: (user: { name: string; role: string; branch: string }) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('operator@stitcherp.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Which role to sign in as — the permission matrix is only observable if you can pick one.
  const [demoRole, setDemoRole] = useState('Store Manager');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide all details');
      return;
    }
    
    setIsLoading(true);
    setTimeout(() => {
      // Successful login mock
      onLoginSuccess({
        name: 'Prathamesh S.',
        role: demoRole,
        branch: 'Mumbai BST'
      });
      setIsLoading(false);
      navigate('/dashboard');
    }, 800);
  };

  const handleGuestLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      onLoginSuccess({
        name: 'Prathamesh S.',
        // Must match a role in the permission matrix (Milestone 32). An unrecognised name
        // resolves to no role at all, which by design grants nothing.
        role: demoRole,
        branch: 'Mumbai BST'
      });
      setIsLoading(false);
      navigate('/dashboard');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E5E5E5] flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Background Decorative Rings/Glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#C5A059]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#C5A059]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left branding panel */}
        <div className="md:col-span-6 space-y-6 text-left p-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-[#C5A059] to-[#D9B875] p-3 rounded-2xl shadow-xl shadow-[#C5A059]/10">
              <Sparkles className="w-7 h-7 text-[#0A0A0B] font-black animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                STITCH<span className="font-light text-[#C5A059]">ERP</span>
              </h1>
              <p className="font-mono text-[9px] text-[#C5A059] uppercase tracking-widest font-bold">
                Luxury Jewellery ERP Suite
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-3xl font-light text-white leading-tight">
              Crafting Digital Precision for <span className="font-medium text-[#C5A059] underline decoration-[#C5A059]/30 underline-offset-8">Artisanal Enterprise</span>
            </h2>
            <p className="text-xs text-[#71717A] leading-relaxed max-w-sm">
              Manage physical metal inventory, live exchange standard rates, custom item catalogs, interactive GST billing, and Karigar ledgers in a unified premium dashboard.
            </p>
          </div>

          <div className="pt-6 border-t border-[#262626] flex items-center gap-4 text-[11px] text-[#71717A] font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C5A059]" /> ISO 27001 Secure
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#262626]" />
            <div>v4.2-STABLE</div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="md:col-span-6">
          <Card className="p-8 border-[#262626] bg-[#141416]/90 backdrop-blur-md shadow-2xl relative">
            <div className="space-y-1.5 mb-6">
              <h3 className="text-lg font-bold text-white">Security Gateway</h3>
              <p className="text-xs text-[#71717A]">
                Access the Mumbai Branch terminal dashboard
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Registered Operator Email"
                type="email"
                required
                placeholder="operator@stitcherp.com"
                icon={<Mail className="w-4 h-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="relative">
                <Input
                  label="Terminal Security PIN / Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-[34px] text-[#71717A] hover:text-[#E5E5E5] transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <label className="flex items-center gap-2 text-[#71717A] cursor-pointer">
                  <input type="checkbox" className="rounded border-[#262626] bg-[#0A0A0B] text-[#C5A059] focus:ring-[#C5A059]" />
                  Remember terminal
                </label>
                <a href="#" className="text-[#C5A059] hover:underline">Forgot PIN?</a>
              </div>

              <div className="space-y-3 pt-3">
                <Button
                  type="submit"
                  variant="gold"
                  className="w-full flex items-center gap-2 justify-center"
                  disabled={isLoading}
                >
                  {isLoading ? 'Verifying Credentials...' : 'Authenticate Terminals'}
                </Button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-[#262626]"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-[#71717A] uppercase font-mono tracking-widest">or sandbox access</span>
                  <div className="flex-grow border-t border-[#262626]"></div>
                </div>

                {/* Role picker (Milestone 32) — the permission matrix is only observable if you
                    can sign in as something other than the fully-privileged role. */}
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#71717A]">
                    Sign in as
                  </span>
                  <select
                    value={demoRole}
                    onChange={(e) => setDemoRole(e.target.value)}
                    aria-label="Sign in as role"
                    className="w-full text-xs px-3 py-2.5 rounded-xl bg-[#141416] border border-[#262626] text-[#E5E5E5] focus:outline-none focus:border-[#C5A059]"
                  >
                    {DEFAULT_ROLES.map(r => (
                      <option key={r.id} value={r.name}>{r.name} — {r.description}</option>
                    ))}
                  </select>
                </label>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center gap-2 justify-center"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <Key className="w-4 h-4 text-[#C5A059]" /> Guest / Demo Direct Sign In
                </Button>
              </div>
            </form>

            <p className="text-[11px] text-center text-[#71717A] mt-6">
              Don't have a workspace?{' '}
              <Link to="/register" className="text-[#C5A059] font-bold hover:underline">
                Register New Enterprise
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
