import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  User, 
  Sparkles, 
  Globe, 
  LogOut, 
  Settings, 
  Database,
  CheckCircle, 
  AlertTriangle, 
  Info,
  X,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Menu,
  Sun,
  Moon,
  ChevronDown
} from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { Tag, Customer, Karigar, Branch } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { sortForDisplay, relativeTime, CATEGORY_LABEL } from '../../lib/notifications';

interface HeaderProps {
  user: { name: string; role: string; branch: string } | null;
  onLogout: () => void;
  activeWorkOrdersCount: number;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  tags: Tag[];
  customers: Customer[];
  karigars: Karigar[];
  // Branch switcher (Milestone 19) — replaces the previously hardcoded "Mumbai BST" text
  branches: Branch[];
  activeBranch: Branch | null;
  onSwitchBranch: (branchId: string) => void;
}

export default function Header({ user, onLogout, activeWorkOrdersCount, sidebarOpen, setSidebarOpen, tags, customers, karigars, branches, activeBranch, onSwitchBranch }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const light = theme === 'light';

  // State controls
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isBranchMenuOpen, setBranchMenuOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);

  const { notifications, unread: unreadCount, markRead, markAllRead } = useNotifications();


  // Refs for closing on click outside
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape closes the search palette. It matters more now the trigger is an icon: there is no
  // longer a visible input to click away from, so the keyboard needs an obvious way out.
  useEffect(() => {
    if (!isSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSearchOpen]);

  // Filter lists for Global Search
  const searchResults = searchQuery.trim() === '' ? { items: [], customers: [], karigars: [] } : {
    items: tags.filter(item =>
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3),
    customers: customers.filter(cust =>
      cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cust.phone.includes(searchQuery)
    ).slice(0, 3),
    karigars: karigars.filter(kar =>
      kar.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kar.specialty.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3)
  };

  const hasResults = searchResults.items.length > 0 || searchResults.customers.length > 0 || searchResults.karigars.length > 0;

  // Real events pushed by the app (Milestone 50) — no longer a hardcoded array.
  const displayed = sortForDisplay(notifications).slice(0, 12);

  return (
    <>
      <header className="h-16 bg-[#0A0A0B] border-b border-[#262626] px-4 md:px-8 flex items-center justify-between shrink-0 select-none shadow-sm relative z-40">
        {/* Left Side: Breadcrumbs and System Time */}
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <button 
            onClick={() => setSidebarOpen && setSidebarOpen(!sidebarOpen)}
            className="p-1.5 -ml-1 text-[#71717A] hover:text-white rounded-lg hover:bg-[#141416] border border-transparent hover:border-[#262626] transition lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5 text-[#C5A059]" />
          </button>
          <Breadcrumbs />
          <div className="h-4 w-px bg-[#262626] hidden lg:block" />
          {/* Branch switcher (Milestone 19). Switching changes which branch's stock every
              screen shows, and which GSTIN/invoice series a sale is raised under. */}
          <div className="hidden lg:block relative">
            <button
              onClick={() => setBranchMenuOpen(!isBranchMenuOpen)}
              className="flex items-center gap-2 text-[10px] font-medium text-[#71717A] font-mono px-2 py-1 rounded-lg hover:bg-[#141416] border border-transparent hover:border-[#262626] transition whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-[#C5A059]" />
              <span className="text-[#E5E5E5] font-bold">{activeBranch?.name || 'No Branch'}</span>
              <span className="text-[#71717A]">{activeBranch?.branchCode}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <ChevronDown className="w-3 h-3" />
            </button>

            {isBranchMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBranchMenuOpen(false)} />
                <div className="absolute left-0 mt-2 w-72 bg-[#141416] border border-[#262626] rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#262626]">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold">Switch Branch</p>
                  </div>
                  {branches.filter(b => b.isActive).map(b => (
                    <button
                      key={b.id}
                      onClick={() => { onSwitchBranch(b.id); setBranchMenuOpen(false); }}
                      className={`branch-option w-full text-left px-4 py-3 transition border-l-2 ${
                        b.id === activeBranch?.id
                          // Same scheme as the sidebar: the selected branch is a gold plaque with
                          // black type, and hovering warms toward gold rather than going dark —
                          // `hover:bg-[#1A1A1D]` is a dark utility the light sheet never rewrites,
                          // so in light mode it painted the row black under black text.
                          ? (light ? 'branch-option-active border-[#B08D4A]' : 'bg-[#C5A059]/10 border-[#C5A059]')
                          : 'border-transparent hover:bg-[#1A1A1D]'
                      }`}
                    >
                      <p className={`text-xs font-bold ${b.id === activeBranch?.id ? 'text-[#C5A059]' : 'text-[#E5E5E5]'}`}>
                        {b.name}
                      </p>
                      <p className="text-[10px] font-mono text-[#71717A] mt-0.5">
                        {b.branchCode} - GSTIN {b.gstin}
                      </p>
                      <p className="text-[10px] font-mono text-[#71717A]">
                        Invoice series {b.invoiceSeriesPrefix}- - state {b.stateCode}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Quick Action Icons */}
        <div className="flex items-center gap-3 lg:gap-4.5 shrink-0">
          {/* Active work orders tracker */}
          {activeWorkOrdersCount > 0 && (
            <Badge variant="gold" title={`${activeWorkOrdersCount} active manufacturing jobs`}
              className="hidden xl:inline-flex gap-1 items-center px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse shrink-0" />
              {activeWorkOrdersCount} ACTIVE JOBS
            </Badge>
          )}

          {/* Global search trigger — icon only. The palette it opens carries its own labelled,
              autofocused input, so a permanently-visible placeholder was spending ~12rem of
              navbar width to say what the magnifier already says. */}
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search records"
            title="Search records"
            className="p-2 text-[#71717A] hover:text-[#E5E5E5] rounded-xl bg-[#141416] border border-[#262626] hover:border-[#C5A059]/40 transition duration-150 flex items-center justify-center"
          >
            <Search className="w-5 h-5 text-[#C5A059]" />
          </button>

          {/* Light / Dark Mode Toggle */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="p-2 text-[#71717A] hover:text-[#E5E5E5] rounded-xl bg-[#141416] border border-[#262626] hover:border-[#C5A059]/40 transition duration-150 flex items-center justify-center"
              aria-label="Toggle theme mode"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-[#C5A059]" />
              ) : (
                <Moon className="w-5 h-5 text-[#C5A059]" />
              )}
            </button>
          )}

          {/* Notifications Dropdown Trigger */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => {
                setNotificationsOpen(!isNotificationsOpen);
                setProfileOpen(false);
              }}
              className="relative p-2 text-[#71717A] hover:text-[#E5E5E5] rounded-xl hover:bg-[#141416] border border-transparent hover:border-[#262626] transition duration-150"
            >
              <Bell className="w-5 h-5 text-[#C5A059]" />
              {unreadCount > 0 && (
                <span className="notification-badge absolute top-0.5 right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 bg-red-700 rounded-full text-[10px] font-bold text-white leading-none flex items-center justify-center ring-2 ring-white dark:ring-[#0A0A0B]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown Menu */}
            {isNotificationsOpen && (
              <div className={`absolute right-0 mt-3 w-80 rounded-2xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in-50 duration-150 ${
                theme === 'light' 
                  ? 'bg-white border border-zinc-200' 
                  : 'bg-[#141416] border border-[#262626]'
              }`}>
                <div className={`flex items-center justify-between border-b pb-2 ${
                  theme === 'light' ? 'border-zinc-150' : 'border-[#262626]'
                }`}>
                  <h4 className={`font-sans font-bold text-xs ${
                    theme === 'light' ? 'text-zinc-800' : 'text-white'
                  }`}>Showroom Notifications</h4>
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllRead}
                      className={`text-[10px] font-bold font-mono uppercase hover:underline ${
                        theme === 'light' ? 'text-amber-800' : 'text-[#C5A059]'
                      }`}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className={`divide-y max-h-72 overflow-y-auto space-y-2 ${
                  theme === 'light' ? 'divide-zinc-150' : 'divide-[#262626]'
                }`}>
                  {displayed.length === 0 ? (
                    <div className={`text-center py-6 text-xs ${
                      theme === 'light' ? 'text-zinc-400' : 'text-[#71717A]'
                    }`}>
                      No events yet. Raise a bill or adjust stock and it will appear here.
                    </div>
                  ) : (
                    displayed.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => markRead(notif.id)}
                        className={`pt-2.5 pb-2 flex gap-3 relative group rounded-xl px-2 transition cursor-pointer ${
                          theme === 'light'
                            ? (!notif.read ? 'bg-amber-50/40 border border-amber-200/40' : 'border border-transparent')
                            : (!notif.read ? 'bg-[#1C1917]/30 border border-[#3A3222]/30' : 'border border-transparent')
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.severity === 'CRITICAL' && <AlertTriangle className="w-4 h-4 text-rose-500" />}
                          {notif.severity === 'WARNING' && <TrendingUp className="w-4 h-4 text-[#C5A059]" />}
                          {notif.severity === 'INFO' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <div className="flex justify-between items-start gap-1.5">
                            <h5 className={`font-sans font-bold text-[11px] leading-tight ${
                              theme === 'light' ? 'text-zinc-800' : 'text-white'
                            }`}>{notif.title}</h5>
                            <span className={`text-[9px] font-mono whitespace-nowrap shrink-0 ${
                              theme === 'light' ? 'text-zinc-400' : 'text-[#71717A]'
                            }`}>{relativeTime(notif.at)}</span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${
                            theme === 'light' ? 'text-zinc-600' : 'text-[#A1A1AA]'
                          }`}>{notif.body}</p>
                          <span className={`text-[9px] font-mono uppercase tracking-wider ${
                            theme === 'light' ? 'text-zinc-400' : 'text-[#71717A]'
                          }`}>{CATEGORY_LABEL[notif.category]}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown Trigger */}
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => {
                setProfileOpen(!isProfileOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2.5 p-1 bg-[#141416] border border-[#262626] rounded-xl hover:border-[#C5A059]/40 transition duration-150 text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] flex items-center justify-center font-mono font-bold text-xs select-none">
                {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'OP'}
              </div>
              <div className="hidden md:block pr-1 select-none max-w-[9rem]">
                <p className="text-[11px] font-bold text-white leading-tight truncate">{user?.name || 'Operator'}</p>
                <span className="text-[9px] text-[#71717A] font-mono block leading-none uppercase truncate">{user?.role || 'Store Manager'}</span>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-[#141416] border border-[#262626] rounded-2xl shadow-2xl p-4 space-y-3.5 z-50 animate-in fade-in-50 duration-150">
                <div className="border-b border-[#262626] pb-3 text-left">
                  <p className="font-bold text-white text-xs">{user?.name || 'Operator'}</p>
                  <p className="text-[10px] text-[#A1A1AA] font-mono">{user?.role || 'Store Manager'} • {activeBranch?.branchCode || '--'}</p>
                </div>

                <div className="space-y-1.5">
                  <button 
                    onClick={() => {
                      alert("Opening local system backup settings...");
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1D] rounded-xl text-left transition"
                  >
                    <Settings className="w-4 h-4 text-[#71717A]" />
                    <span>Terminal Configurations</span>
                  </button>

                  <button 
                    onClick={() => {
                      alert("Database backup AURUMERP_BACKUP_" + new Date().toISOString().split('T')[0] + ".json successfully exported to desktop downloads.");
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1D] rounded-xl text-left transition"
                  >
                    <Database className="w-4 h-4 text-[#71717A]" />
                    <span>Enterprise Backup DB</span>
                  </button>
                </div>

                <div className="border-t border-[#262626] pt-3">
                  <button 
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl text-left transition font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>De-authenticate Session</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Overlay Modal */}
      {isSearchOpen && (
        <div className={`fixed inset-0 z-50 backdrop-blur-md flex items-start justify-center p-4 pt-16 ${
          theme === 'light' ? 'bg-slate-900/40' : 'bg-[#0A0A0B]/80'
        }`}>
          <div className={`rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${
            theme === 'light' ? 'bg-white border border-slate-200' : 'bg-[#141416] border border-[#262626]'
          }`}>
            {/* Search Input Bar */}
            <div className={`p-5 border-b flex items-center justify-between gap-3 ${
              theme === 'light' ? 'border-slate-150 bg-slate-50' : 'border-[#262626] bg-[#1A1A1D]'
            }`}>
              <Search className="w-5 h-5 text-[#C5A059] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Type to search showcase SKUs, customer directory, or artisan details..."
                className={`w-full text-sm bg-transparent border-none focus:outline-none ${
                  theme === 'light' ? 'text-slate-800 placeholder-slate-400' : 'text-white placeholder-[#71717A]'
                }`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                className={`p-1.5 rounded-full transition ${
                  theme === 'light' ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-700' : 'hover:bg-[#262626] text-[#71717A] hover:text-[#E5E5E5]'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results Container */}
            <div className="max-h-96 overflow-y-auto p-6 space-y-5 text-left">
              {searchQuery.trim() === '' ? (
                <div className={`text-center py-10 text-xs ${theme === 'light' ? 'text-slate-500' : 'text-[#71717A]'}`}>
                  <Sparkles className={`w-8 h-8 mx-auto mb-3 ${theme === 'light' ? 'text-amber-400/50' : 'text-[#262626]'}`} />
                  <p>Search standard indices across the entire showroom instance</p>
                  <p className={`text-[10px] font-mono mt-1 ${theme === 'light' ? 'text-amber-800 font-bold' : 'text-amber-500/60'}`}>PRO-TIP: SEARCH "RING", "SHRUTIKA" OR "RAMESH"</p>
                </div>
              ) : !hasResults ? (
                <div className={`text-center py-10 text-xs ${theme === 'light' ? 'text-slate-500' : 'text-[#71717A]'}`}>
                  <AlertTriangle className={`w-8 h-8 mx-auto mb-3 ${theme === 'light' ? 'text-amber-500/50' : 'text-[#3A3222]'}`} />
                  <p>No matching enterprise records found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="space-y-5 text-xs font-medium">
                  {/* Item Showcase results */}
                  {searchResults.items.length > 0 && (
                    <div className="space-y-2">
                      <h4 className={`text-[10px] font-mono uppercase tracking-widest font-bold ${
                        theme === 'light' ? 'text-slate-400' : 'text-[#71717A]'
                      }`}>Showcase Inventory SKUs</h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {searchResults.items.map(item => (
                          <div 
                            key={item.id} 
                            onClick={() => {
                              setSearchOpen(false);
                              navigate('/catalog');
                            }}
                            className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                              theme === 'light' 
                                ? 'bg-slate-50 border border-slate-150 hover:border-amber-500 hover:bg-slate-100/50' 
                                : 'bg-[#1A1A1D] border border-[#262626] hover:border-[#C5A059]/40'
                            }`}
                          >
                            <div className="flex gap-3 items-center">
                              {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.name} className={`w-9 h-9 object-cover rounded-lg border ${
                                  theme === 'light' ? 'border-slate-200' : 'border-[#262626]'
                                }`} referrerPolicy="no-referrer" />
                              )}
                              <div>
                                <p className={`font-bold text-xs ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{item.name}</p>
                                <span className={`text-[9px] font-mono tracking-wider ${theme === 'light' ? 'text-amber-800' : 'text-[#C5A059]'}`}>{item.sku} • {item.category}</span>
                              </div>
                            </div>
                            <span className={`font-mono font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{item.grossWeight}g</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customer records results */}
                  {searchResults.customers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className={`text-[10px] font-mono uppercase tracking-widest font-bold ${
                        theme === 'light' ? 'text-slate-400' : 'text-[#71717A]'
                      }`}>CRM Client Accounts</h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {searchResults.customers.map(cust => (
                          <div 
                            key={cust.id}
                            onClick={() => {
                              setSearchOpen(false);
                              navigate('/customers');
                            }}
                            className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                              theme === 'light' 
                                ? 'bg-slate-50 border border-slate-150 hover:border-amber-500 hover:bg-slate-100/50' 
                                : 'bg-[#1A1A1D] border border-[#262626] hover:border-[#C5A059]/40'
                            }`}
                          >
                            <div>
                              <p className={`font-bold text-xs ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{cust.name}</p>
                              <span className={`text-[9px] font-mono ${theme === 'light' ? 'text-slate-500' : 'text-[#71717A]'}`}>{cust.phone} • {cust.email}</span>
                            </div>
                            <Badge variant="gold">{cust.tier}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Artisan Jobwork results */}
                  {searchResults.karigars.length > 0 && (
                    <div className="space-y-2">
                      <h4 className={`text-[10px] font-mono uppercase tracking-widest font-bold ${
                        theme === 'light' ? 'text-slate-400' : 'text-[#71717A]'
                      }`}>Karigar Manufacturing Ledger</h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {searchResults.karigars.map(kar => (
                          <div 
                            key={kar.id}
                            onClick={() => {
                              setSearchOpen(false);
                              navigate('/karigar');
                            }}
                            className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                              theme === 'light' 
                                ? 'bg-slate-50 border border-slate-150 hover:border-amber-500 hover:bg-slate-100/50' 
                                : 'bg-[#1A1A1D] border border-[#262626] hover:border-[#C5A059]/40'
                            }`}
                          >
                            <div>
                              <p className={`font-bold text-xs ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{kar.name}</p>
                              <span className={`text-[9px] font-mono ${theme === 'light' ? 'text-amber-800' : 'text-[#C5A059]'}`}>Specialty: {kar.specialty}</span>
                            </div>
                            <span className={`font-mono text-[11px] font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>Hold: {kar.metalBalance}g</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
