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
  Moon
} from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useTheme } from '../../contexts/ThemeContext';
import { Tag, Customer, Karigar } from '../../types';

interface HeaderProps {
  user: { name: string; role: string; branch: string } | null;
  onLogout: () => void;
  activeWorkOrdersCount: number;
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
  tags: Tag[];
  customers: Customer[];
  karigars: Karigar[];
}

export default function Header({ user, onLogout, activeWorkOrdersCount, sidebarOpen, setSidebarOpen, tags, customers, karigars }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // State controls
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      type: 'warning',
      title: 'Exchange Rate Surge',
      desc: 'Standard Gold (22K) rate increased to ₹6,650/g (+0.72%)',
      time: '5 mins ago',
      read: false
    },
    {
      id: 'notif-2',
      type: 'success',
      title: 'Job Completed',
      desc: 'Karigar Ramesh finished Peacock Ring (WO-2026-001)',
      time: '1 hour ago',
      read: false
    },
    {
      id: 'notif-3',
      type: 'info',
      title: 'Scheme Installment Due',
      desc: "Shrutika Deshpande's Swarna Nidhi savings deposit due today",
      time: '3 hours ago',
      read: true
    }
  ]);

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

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <header className="h-16 bg-[#0A0A0B] border-b border-[#262626] px-4 md:px-8 flex items-center justify-between shrink-0 select-none shadow-sm relative z-40">
        {/* Left Side: Breadcrumbs and System Time */}
        <div className="flex items-center gap-3 md:gap-6">
          <button 
            onClick={() => setSidebarOpen && setSidebarOpen(!sidebarOpen)}
            className="p-1.5 -ml-1 text-[#71717A] hover:text-white rounded-lg hover:bg-[#141416] border border-transparent hover:border-[#262626] transition lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5 text-[#C5A059]" />
          </button>
          <Breadcrumbs />
          <div className="h-4 w-px bg-[#262626] hidden lg:block" />
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-medium text-[#71717A] font-mono">
            <Globe className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>{user?.branch || 'Mumbai BST'} Showroom</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Right Side: Quick Action Icons */}
        <div className="flex items-center gap-4.5">
          {/* Active work orders tracker */}
          {activeWorkOrdersCount > 0 && (
            <Badge variant="gold" className="hidden sm:inline-flex gap-1 items-center px-3 py-1 rounded-full text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />
              {activeWorkOrdersCount} ACTIVE MANUFACTURING JOBS
            </Badge>
          )}

          {/* Interactive Global Search trigger */}
          <button 
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#141416] border border-[#262626] text-xs text-[#71717A] rounded-xl hover:border-[#C5A059]/40 transition duration-150 w-32 md:w-48 text-left"
          >
            <Search className="w-3.5 h-3.5 text-[#C5A059]" />
            <span className="hidden md:inline">Search records...</span>
            <span className="md:hidden">Search...</span>
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
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 rounded-full border-2 border-[#0A0A0B] text-[8px] font-bold text-white flex items-center justify-center animate-bounce">
                  {unreadCount}
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

                <div className={`divide-y max-h-64 overflow-y-auto space-y-2 ${
                  theme === 'light' ? 'divide-zinc-150' : 'divide-[#262626]'
                }`}>
                  {notifications.length === 0 ? (
                    <div className={`text-center py-6 text-xs ${
                      theme === 'light' ? 'text-zinc-400' : 'text-[#71717A]'
                    }`}>
                      No active alerts or events
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`pt-2.5 pb-2 flex gap-3 relative group rounded-xl px-2 transition ${
                          theme === 'light' 
                            ? (!notif.read ? 'bg-amber-50/40 border border-amber-200/40' : 'border border-transparent')
                            : (!notif.read ? 'bg-[#1C1917]/30 border border-[#3A3222]/30' : 'border border-transparent')
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.type === 'warning' && <TrendingUp className="w-4 h-4 text-[#C5A059]" />}
                          {notif.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          {notif.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex justify-between items-start gap-1.5">
                            <h5 className={`font-sans font-bold text-[11px] leading-tight ${
                              theme === 'light' ? 'text-zinc-800' : 'text-white'
                            }`}>{notif.title}</h5>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] font-mono whitespace-nowrap ${
                                theme === 'light' ? 'text-zinc-400' : 'text-[#71717A]'
                              }`}>{notif.time}</span>
                              <button 
                                onClick={() => dismissNotification(notif.id)}
                                className={`p-0.5 rounded transition opacity-0 group-hover:opacity-100 ${
                                  theme === 'light' 
                                    ? 'hover:bg-zinc-150 text-zinc-400 hover:text-zinc-700' 
                                    : 'hover:bg-[#262626] text-[#71717A] hover:text-[#E5E5E5]'
                                }`}
                                title="Dismiss notification"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${
                            theme === 'light' ? 'text-zinc-600' : 'text-[#A1A1AA]'
                          }`}>{notif.desc}</p>
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
              <div className="hidden md:block pr-1 select-none">
                <p className="text-[11px] font-bold text-white leading-tight">{user?.name || 'Operator'}</p>
                <span className="text-[9px] text-[#71717A] font-mono block leading-none uppercase">{user?.role || 'Store Manager'}</span>
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-[#141416] border border-[#262626] rounded-2xl shadow-2xl p-4 space-y-3.5 z-50 animate-in fade-in-50 duration-150">
                <div className="border-b border-[#262626] pb-3 text-left">
                  <p className="font-bold text-white text-xs">{user?.name || 'Operator'}</p>
                  <p className="text-[10px] text-[#A1A1AA] font-mono">{user?.role || 'Store Manager'} • {user?.branch || 'Mumbai BST'}</p>
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
                      alert("Database backup STITCH_BACKUP_" + new Date().toISOString().split('T')[0] + ".json successfully exported to desktop downloads.");
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
