import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  Gem,
  ReceiptIndianRupee,
  Hammer,
  Users,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Award,
  Coins,
  Scale,
  ClipboardList,
  ShieldCheck,
  BarChart3,
  Boxes,
  Wrench,
  X
} from 'lucide-react';
import { MetalRate, Branch } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { canAccessRoute, type Role } from '../lib/permissions';

interface SidebarProps {
  metalRates: MetalRate[];
  /** Shown in the footer so staff always know which branch they are operating as (M19). */
  activeBranch?: Branch | null;
  operatorName: string;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  /** The signed-in user's role (Milestone 32); null hides every gated screen. */
  currentRole?: Role | null;
}

export default function Sidebar({ metalRates, activeBranch, operatorName, sidebarOpen, setSidebarOpen, currentRole = null }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const { theme } = useTheme();
  const light = theme === 'light';

  const menuItems = [
    { id: '/dashboard', name: 'Dashboard Overview', icon: LayoutDashboard, desc: 'Executive control summary' },
    { id: '/catalog', name: 'Catalog & Showcase', icon: Gem, desc: 'Inventory showcase registry' },
    { id: '/stones', name: 'Stones & Diamonds', icon: Award, desc: 'Loose diamonds & vault ledger' },
    { id: '/billing', name: 'Billing Estimator', icon: ReceiptIndianRupee, desc: 'GST 3% sales invoicing' },
    { id: '/karigar', name: 'Karigar & Jobwork', icon: Hammer, desc: 'Gold manufacturing ledgers' },
    { id: '/jobbags', name: 'Job Bags Tracker', icon: Layers, desc: 'Visual factory floor workflow' },
    { id: '/oldgold', name: 'Old Gold Buyback', icon: Coins, desc: 'Purity testing & melt valuation' },
    { id: '/inventory', name: 'Inventory Ops', icon: Boxes, desc: 'Valuation, write-offs & melting' },
    { id: '/orders', name: 'Orders & Repairs', icon: Wrench, desc: 'Customer orders & pieces in custody' },
    { id: '/customers', name: 'Customers & Schemes', icon: Users, desc: 'CRM Swarna Nidhi scheme' },
    { id: '/purchases', name: 'Purchases', icon: ClipboardList, desc: 'Orders, receipts & supplier bills' },
    { id: '/accounting', name: 'Accounting', icon: Scale, desc: 'Day book, ledgers & trial balance' },
    { id: '/reports', name: 'Reports', icon: BarChart3, desc: 'Sales, stock & compliance' },
    { id: '/roles', name: 'Roles & Access', icon: ShieldCheck, desc: 'Permission matrix' },
  ];

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
          className="fixed inset-0 bg-[#0A0A0B]/80 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 lg:relative w-72 bg-[#0A0A0B] border-r border-[#262626] text-[#E5E5E5] flex flex-col h-full shrink-0 select-none font-sans transition-transform duration-300 transform lg:transform-none ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
      {/* Brand Header */}
      <div className="p-6 border-b border-[#262626] flex items-center justify-between gap-3 bg-[#0D0D0E]">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-[#C5A059] to-[#D9B875] p-2.5 rounded-xl shadow-lg shadow-[#C5A059]/10">
            <Sparkles className="w-6 h-6 text-[#0A0A0B] font-bold" />
          </div>
          <div>
            <h1 className="font-sans font-black tracking-tight text-base text-white">
              STITCH<span className="font-light text-[#C5A059]">ERP</span>
            </h1>
            <p className="font-mono text-[9px] text-[#C5A059] uppercase tracking-widest font-bold">
              Luxury Jewellery Suite
            </p>
          </div>
        </div>
        {/* Mobile-only close button — the sidebar panel (z-50) sits above the header's
            hamburger toggle once open, so that button can't be tapped again to dismiss it. */}
        <button
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
          className="lg:hidden p-1.5 -mr-1.5 text-[#71717A] hover:text-white rounded-lg hover:bg-[#1A1A1D] transition"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Live Metal Rates Ticker in Sidebar */}
      <div className="mx-4 my-5 p-4 rounded-xl bg-[#141416]/80 border border-[#262626]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] tracking-wider text-[#71717A] uppercase font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#C5A059]" /> Live Gold Exchange
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="space-y-2">
          {metalRates.slice(0, 3).map((rate) => (
            <div key={rate.metalType} className="flex justify-between items-center text-xs font-semibold">
              {/* #A1A1AA reads at 2.33:1 on the light rate card — legible on the dark one only. */}
              <span className={light ? 'text-zinc-600' : 'text-[#A1A1AA]'}>
                {rate.metalType.replace(' (', ' ')}
              </span>
              <span className={`font-mono font-bold ${light ? 'text-[#6B5526]' : 'text-[#C5A059]'}`}>
                ₹{rate.ratePerGram.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {/* Screens the role cannot reach are hidden rather than shown-and-refused: an
            affordance that always errors is worse than one that is not offered. */}
        {menuItems.filter(item => canAccessRoute(currentRole, item.id)).map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.id || (item.id === '/dashboard' && currentPath === '/');
          return (
            <Link
              key={item.id}
              to={item.id}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 text-left group relative ${
                isActive
                  ? (light
                      // Gold plaque with black type: 9.1:1, and unmistakably "you are here".
                      ? 'sidebar-active-light font-bold border border-[#B08D4A]'
                      : 'bg-[#1C1917] text-[#C5A059] font-bold border border-[#3A3222]')
                  : (light
                      // Hovering must not turn the label white — on a light plaque that reads
                      // at 1.1:1, which is invisible. Darken toward black-and-gold instead.
                      ? 'text-zinc-600 hover:bg-[#FBF6EA] hover:text-[#0A0A0B] border border-transparent'
                      : 'text-[#A1A1AA] hover:bg-[#141416] hover:text-white border border-transparent')
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 transition duration-150 ${
                isActive
                  ? (light ? 'text-[#0A0A0B]' : 'text-[#C5A059]')
                  : light
                    ? 'text-zinc-400 group-hover:text-[#8C6D34]'
                    : 'text-[#71717A] group-hover:text-[#C5A059]'
              }`} />
              <div className="flex flex-col">
                <span className="text-xs font-bold">{item.name}</span>
                <span className={`sidebar-sub text-[10px] transition-colors leading-tight ${
                  isActive
                    ? (light ? 'text-[#0A0A0B]/75' : 'text-[#C5A059]/70')
                    : light
                      ? 'text-zinc-500 group-hover:text-[#6B5526]'
                      : 'text-[#71717A] group-hover:text-[#A1A1AA]'
                }`}>
                  {item.desc}
                </span>
              </div>
              {isActive && (
                <div className={`absolute right-3.5 w-1.5 h-1.5 rounded-full ${
                  light ? 'bg-[#0A0A0B]' : 'bg-[#C5A059]'
                }`} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className={`p-4 border-t text-xs ${
        theme === 'light' 
          ? 'bg-zinc-50 border-zinc-200' 
          : 'bg-[#0E0E0F] border-[#262626]'
      }`}>
        <div className={`flex items-center justify-between mb-3 text-[10px] font-mono ${
          theme === 'light' ? 'text-zinc-500 font-medium' : 'text-[#71717A]'
        }`}>
          <span>OPERATOR: {operatorName.split(' ')[0].toUpperCase()}</span>
          <span>STORE: {activeBranch?.branchCode || '--'}</span>
        </div>
        <div className={`flex items-center gap-3 p-2 rounded-xl border ${
          theme === 'light' 
            ? 'bg-white border-zinc-200/80 shadow-xs' 
            : 'bg-[#141416] border-[#262626]'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono text-xs ${
            theme === 'light' 
              ? 'bg-amber-100 text-amber-800' 
              : 'bg-[#C5A059]/10 text-[#C5A059]'
          }`}>
            {operatorName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold truncate leading-none text-xs ${
              theme === 'light' ? 'text-zinc-800' : 'text-[#E5E5E5]'
            }`}>{operatorName}</p>
            <span className={`text-[10px] leading-none ${
              theme === 'light' ? 'text-zinc-500' : 'text-[#71717A]'
            }`}>Store Operator</span>
          </div>
          <button 
            title="Export System Data" 
            onClick={() => {
              alert("System Backup File exported successfully! (STITCH_BACKUP_" + new Date().toISOString().split('T')[0] + ".json)");
            }}
            className={`p-1.5 rounded transition ${
              theme === 'light' 
                ? 'hover:bg-zinc-100 text-zinc-500 hover:text-amber-800' 
                : 'hover:bg-[#262626] text-[#71717A] hover:text-[#C5A059]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
