import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Shield, User, Mail, Lock, Building, Store } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface RegisterPageProps {
  onRegisterSuccess: (user: { name: string; role: string; branch: string }) => void;
}

export default function RegisterPage({ onRegisterSuccess }: RegisterPageProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [branchLocation, setBranchLocation] = useState('Mumbai Central');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !enterpriseName || !password) {
      setError('Please fill in all mandatory fields');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      onRegisterSuccess({
        name: name,
        role: 'Enterprise Owner',
        branch: branchLocation
      });
      setIsLoading(false);
      navigate('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E5E5E5] flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#C5A059]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#C5A059]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left pane details */}
        <div className="md:col-span-5 space-y-6 text-left p-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-[#C5A059] to-[#D9B875] p-2.5 rounded-2xl shadow-xl shadow-[#C5A059]/10">
              <Sparkles className="w-6 h-6 text-[#0A0A0B] font-black" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">
                STITCH<span className="font-light text-[#C5A059]">ERP</span>
              </h2>
              <p className="font-mono text-[9px] text-[#C5A059] uppercase tracking-widest font-bold">
                Enterprise Registration
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-2xl font-light text-white leading-tight">
              Scale Your <span className="font-medium text-[#C5A059]">Jewellery Enterprise</span> with Institutional Controls
            </h3>
            <ul className="space-y-3.5 text-xs text-[#A1A1AA]">
              <li className="flex items-start gap-2.5">
                <span className="text-[#C5A059] mt-0.5">✦</span>
                <span>Unlimited barcode tracking & custom tags</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#C5A059] mt-0.5">✦</span>
                <span>Dual metal weight ledgers (Gross vs. Net purity)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#C5A059] mt-0.5">✦</span>
                <span>Automated 3% GST calculation & digital invoicing</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right pane card */}
        <div className="md:col-span-7">
          <Card className="p-8 border-[#262626] bg-[#141416]/90 backdrop-blur-md shadow-2xl">
            <div className="space-y-1.5 mb-6">
              <h3 className="text-lg font-bold text-white">Initialize Workspace</h3>
              <p className="text-xs text-[#71717A]">
                Provision a secure database instance for your jewelry showrooms
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Administrator Name"
                  required
                  placeholder="e.g. Prathamesh S."
                  icon={<User className="w-4 h-4" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Registered Email"
                  type="email"
                  required
                  placeholder="name@enterprise.com"
                  icon={<Mail className="w-4 h-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Enterprise / Brand Name"
                  required
                  placeholder="e.g. Stitch Jewellers"
                  icon={<Building className="w-4 h-4" />}
                  value={enterpriseName}
                  onChange={(e) => setEnterpriseName(e.target.value)}
                />
                <Input
                  label="Showroom Branch City"
                  placeholder="e.g. Mumbai Central"
                  icon={<Store className="w-4 h-4" />}
                  value={branchLocation}
                  onChange={(e) => setBranchLocation(e.target.value)}
                />
              </div>

              <Input
                label="Create Master PIN / Password"
                type="password"
                required
                placeholder="••••••••••••"
                icon={<Lock className="w-4 h-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="text-[11px] text-[#71717A] leading-relaxed pt-1">
                By clicking authenticate, you agree to instantiate local secure caching variables and accept the STITCH ERP operator license guidelines.
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="gold"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Provisioning Instance...' : 'Deploy Secured Workspace'}
                </Button>
              </div>
            </form>

            <p className="text-[11px] text-center text-[#71717A] mt-6">
              Already have an enterprise?{' '}
              <Link to="/login" className="text-[#C5A059] font-bold hover:underline">
                Operator Login
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
