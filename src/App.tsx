import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { initialMetalRates, initialItemDesigns, initialTags, initialCustomers, initialKarigars, initialJobWorks, initialInvoices, initialLooseStones, initialOldGoldVouchers, initialKarigarLedger, initialBranches, initialTaxRates } from './data/mockData';
import { ItemDesign, Tag, Customer, Karigar, JobWork, SaleInvoice, MetalRate, LooseStone, OldGoldVoucher, KarigarLedgerEntry, Branch, StockTransfer, TaxRate } from './types';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { getActiveBranch, primaryBranchId, scopeToBranch } from './lib/branch';

// Custom layouts & Auth pages
import Sidebar from './components/Sidebar';
import Header from './components/layout/Header';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';

// Business modules
import Dashboard from './components/Dashboard';
import CatalogManager from './components/CatalogManager';
import StoneManager from './components/StoneManager';
import BillingEstimator from './components/BillingEstimator';
import KarigarManager from './components/KarigarManager';
import JobBagManager from './components/JobBagManager';
import CustomerManager from './components/CustomerManager';
import OldGoldManager from './components/OldGoldManager';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication State
  const [user, setUser] = useState<{ name: string; role: string; branch: string } | null>(() => {
    const saved = localStorage.getItem('stitch_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Responsive & Simulated API States
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [latency, setLatency] = useState(() => Number(localStorage.getItem('stitch_api_latency') || '600'));
  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem('stitch_api_force_offline') === 'true');
  const [isDeskOpen, setIsDeskOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // Core database states (with LocalStorage persistence)
  const [metalRates, setMetalRates] = useState<MetalRate[]>(() => {
    const saved = localStorage.getItem('stitch_metal_rates');
    return saved ? JSON.parse(saved) : initialMetalRates;
  });

  const [itemDesigns, setItemDesigns] = useState<ItemDesign[]>(() => {
    const saved = localStorage.getItem('stitch_item_designs');
    return saved ? JSON.parse(saved) : initialItemDesigns;
  });

  const [tags, setTags] = useState<Tag[]>(() => {
    const saved = localStorage.getItem('stitch_tags');
    return saved ? JSON.parse(saved) : initialTags;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('stitch_customers');
    return saved ? JSON.parse(saved) : initialCustomers;
  });

  const [karigars, setKarigars] = useState<Karigar[]>(() => {
    const saved = localStorage.getItem('stitch_karigars');
    return saved ? JSON.parse(saved) : initialKarigars;
  });

  // One unified Job-Work aggregate (Milestone 17). Previously `workOrders` and `jobBags` were
  // separate arrays describing the same real jobs, free to drift apart.
  const [jobWorks, setJobWorks] = useState<JobWork[]>(() => {
    const saved = localStorage.getItem('stitch_job_works');
    return saved ? JSON.parse(saved) : initialJobWorks;
  });

  const [invoices, setInvoices] = useState<SaleInvoice[]>(() => {
    const saved = localStorage.getItem('stitch_invoices');
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  const [stones, setStones] = useState<LooseStone[]>(() => {
    const saved = localStorage.getItem('stitch_loose_stones');
    return saved ? JSON.parse(saved) : initialLooseStones;
  });


  const [oldGoldVouchers, setOldGoldVouchers] = useState<OldGoldVoucher[]>(() => {
    const saved = localStorage.getItem('stitch_old_gold_vouchers');
    return saved ? JSON.parse(saved) : initialOldGoldVouchers;
  });

  // Branch Master (Milestone 19). Party masters (customers/karigars) are deliberately NOT
  // branch-scoped — see decision D-5 and src/lib/branch.ts.
  const [branches, setBranches] = useState<Branch[]>(() => {
    const saved = localStorage.getItem('stitch_branches');
    return saved ? JSON.parse(saved) : initialBranches;
  });

  const [activeBranchId, setActiveBranchId] = useState<string | null>(() =>
    localStorage.getItem('stitch_active_branch') || null
  );

  // Tax Master (Milestone 21). Tenant-wide, never branch-scoped — a GST notification applies
  // to the whole business. Rows are append-only with effective-date versioning (PRD §9.2).
  const [taxRates, setTaxRates] = useState<TaxRate[]>(() => {
    const saved = localStorage.getItem('stitch_tax_rates');
    return saved ? JSON.parse(saved) : initialTaxRates;
  });

  // Inter-branch stock transfers (Milestone 20). Deliberately NOT branch-scoped: a transfer
  // belongs to two branches at once, and the destination must be able to see it arriving.
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => {
    const saved = localStorage.getItem('stitch_stock_transfers');
    return saved ? JSON.parse(saved) : [];
  });

  // Append-only Karigar ledger (Milestone 16) — the single source of truth for karigar
  // balances, which are derived from it rather than stored (KNOWN_ISSUES #10 / D-2).
  const [karigarLedger, setKarigarLedger] = useState<KarigarLedgerEntry[]>(() => {
    const saved = localStorage.getItem('stitch_karigar_ledger');
    return saved ? JSON.parse(saved) : initialKarigarLedger;
  });

  // Global popup controllers
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isIssueModalOpen, setIssueModalOpen] = useState(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('stitch_metal_rates', JSON.stringify(metalRates));
  }, [metalRates]);

  useEffect(() => {
    localStorage.setItem('stitch_item_designs', JSON.stringify(itemDesigns));
  }, [itemDesigns]);

  useEffect(() => {
    localStorage.setItem('stitch_tags', JSON.stringify(tags));
  }, [tags]);

  useEffect(() => {
    localStorage.setItem('stitch_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('stitch_karigars', JSON.stringify(karigars));
  }, [karigars]);

  useEffect(() => {
    localStorage.setItem('stitch_job_works', JSON.stringify(jobWorks));
  }, [jobWorks]);

  useEffect(() => {
    localStorage.setItem('stitch_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('stitch_loose_stones', JSON.stringify(stones));
  }, [stones]);


  useEffect(() => {
    localStorage.setItem('stitch_old_gold_vouchers', JSON.stringify(oldGoldVouchers));
  }, [oldGoldVouchers]);

  useEffect(() => {
    localStorage.setItem('stitch_karigar_ledger', JSON.stringify(karigarLedger));
  }, [karigarLedger]);

  useEffect(() => {
    localStorage.setItem('stitch_branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    localStorage.setItem('stitch_stock_transfers', JSON.stringify(stockTransfers));
  }, [stockTransfers]);

  useEffect(() => {
    localStorage.setItem('stitch_tax_rates', JSON.stringify(taxRates));
  }, [taxRates]);

  useEffect(() => {
    if (activeBranchId) localStorage.setItem('stitch_active_branch', activeBranchId);
  }, [activeBranchId]);

  // Trigger simulated API load on navigation
  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);
    setApiError(null);
    setSidebarOpen(false); // Close sidebar on route change for mobile smoothness
    
    const delay = latency;
    const timer = setTimeout(() => {
      setIsLoading(false);
      if (forceOffline) {
        setApiError('The database server is currently offline or the connection failed. Try disabling "Force offline" in the Simulation Desk at the bottom right.');
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [location.pathname, forceOffline, latency, user]);

  const activeBranch = getActiveBranch(branches, activeBranchId);
  const fallbackBranchId = primaryBranchId(branches);

  // Branch-scoped views of stock-bearing records (Milestone 19). Party masters (customers,
  // karigars) are deliberately NOT scoped — D-5 calls branch-scoping them a compliance risk
  // that silently breaks chain-wide loyalty and TCS aggregation.
  const branchTags = scopeToBranch(tags, activeBranchId, fallbackBranchId);
  const branchStones = scopeToBranch(stones, activeBranchId, fallbackBranchId);
  const branchJobWorks = scopeToBranch(jobWorks, activeBranchId, fallbackBranchId);
  const branchInvoices = scopeToBranch(invoices, activeBranchId, fallbackBranchId);
  const branchOldGoldVouchers = scopeToBranch(oldGoldVouchers, activeBranchId, fallbackBranchId);

  const activeWorkOrdersCount = branchJobWorks.filter(j => j.stage !== 'Completed').length;

  const handleLoginSuccess = (userData: { name: string; role: string; branch: string }) => {
    setUser(userData);
    localStorage.setItem('stitch_auth_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('stitch_auth_user');
    navigate('/login');
  };

  // Guard routing based on authentication
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/register" element={<RegisterPage onRegisterSuccess={handleLoginSuccess} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className={`flex h-screen bg-[#0A0A0B] font-sans text-[#E5E5E5] overflow-hidden ${theme}`}>
      {/* LEFT RESPONSIVE SIDEBAR */}
      <Sidebar 
        metalRates={metalRates} 
        activeBranch={activeBranch}
        operatorName={user.name} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
      />

      {/* RIGHT MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* GLOBAL EXECUTIVE HEADER */}
        <Header
          user={user}
          onLogout={handleLogout}
          activeWorkOrdersCount={activeWorkOrdersCount}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          tags={tags}
          customers={customers}
          karigars={karigars}
          branches={branches}
          activeBranch={activeBranch}
          onSwitchBranch={setActiveBranchId}
        />

        {/* CORE SCROLLABLE CLIENT AREA */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 relative transition-colors duration-200 ${
          theme === 'light' ? 'bg-zinc-50' : 'bg-[#0A0A0B]'
        }`}>
          {apiError ? (
            /* ENTERPRISE SIMULATED ERROR STATE */
            <div className={`max-w-xl mx-auto my-12 border p-6 md:p-8 rounded-2xl shadow-2xl text-center space-y-6 ${
              theme === 'light' ? 'bg-white border-red-200' : 'bg-[#110C0C] border-[#3F1A1A]'
            }`}>
              <div className={`w-16 h-16 border rounded-full flex items-center justify-center mx-auto ${
                theme === 'light' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-[#271212] border-[#EA580C]/25 text-[#EF4444]'
              }`}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <div className="space-y-2">
                <h3 className={`text-base font-bold tracking-tight ${theme === 'light' ? 'text-zinc-800' : 'text-white'}`}>Database Connection Timeout</h3>
                <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {apiError}
                </p>
              </div>
              
              <div className={`p-4 rounded-xl text-left space-y-1 text-[10px] font-mono border ${
                theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-500' : 'bg-[#141416] border-[#262626] text-zinc-500'
              }`}>
                <p>RESOURCE: STITCH-METADATA-LEDGER</p>
                <p>SOCKET: ATTEMPT_REJECTED</p>
                <p>NODE: BOM-HQ-DB-01</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setForceOffline(false);
                    localStorage.setItem('stitch_api_force_offline', 'false');
                    setApiError(null);
                    setIsLoading(true);
                    setTimeout(() => setIsLoading(false), 500);
                  }}
                  className={`px-5 py-2.5 font-bold text-xs rounded-xl transition ${
                    theme === 'light' ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-[#C5A059] hover:bg-[#D9B875] text-[#0A0A0B]'
                  }`}
                >
                  Disable Offline & Reconnect
                </button>
                <button
                  onClick={() => {
                    setIsLoading(true);
                    setApiError(null);
                    setTimeout(() => {
                      setIsLoading(false);
                      if (forceOffline) {
                        setApiError('The database server is currently offline or the connection failed. Try disabling "Force offline" in the Simulation Desk at the bottom right.');
                      }
                    }, latency);
                  }}
                  className={`px-5 py-2.5 font-bold text-xs rounded-xl transition border ${
                    theme === 'light' ? 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700' : 'bg-zinc-900 hover:bg-zinc-800 border-[#262626] text-zinc-300'
                  }`}
                >
                  Retry Connection
                </button>
              </div>
            </div>
          ) : isLoading ? (
            /* HIGH-FIDELITY LUXURY SHIMMERING LOADING STATE */
            <div className="space-y-6 animate-pulse select-none">
              {/* Top Banner Skeleton */}
              <div className={`p-6 rounded-2xl h-28 w-full flex items-center justify-between border ${
                theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-[#141416] border-[#262626]'
              }`}>
                <div className="space-y-2 w-1/2">
                  <div className={`h-5 rounded-md w-1/3 ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
                  <div className={`h-3.5 rounded-md w-2/3 ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
                </div>
                <div className={`h-8 rounded-md w-24 hidden md:block ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
              </div>
              
              {/* KPI Cards Skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className={`p-5 h-24 rounded-2xl space-y-3 border ${
                    theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-[#141416] border-[#262626]'
                  }`}>
                    <div className={`h-3 rounded-md w-1/2 ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
                    <div className={`h-6 rounded-md w-3/4 ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
                  </div>
                ))}
              </div>
              
              {/* Table/List Skeleton */}
              <div className={`rounded-2xl p-6 space-y-4 border ${
                theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-[#141416] border-[#262626]'
              }`}>
                <div className={`h-4.5 rounded-md w-1/4 mb-6 ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className={`h-11 rounded-lg w-full ${theme === 'light' ? 'bg-zinc-200' : 'bg-[#262626]'}`} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* FULL APP CORE MODULES */
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route 
                path="/dashboard" 
                element={
                  <Dashboard
                    metalRates={metalRates}
                    setMetalRates={setMetalRates}
                    tags={branchTags}
                    customersCount={customers.length}
                    karigars={karigars}
                    invoices={branchInvoices}
                    jobWorks={branchJobWorks}
                    stones={branchStones}
                    activeWorkOrdersCount={activeWorkOrdersCount}
                    setActiveTab={(tab) => navigate('/' + tab)}
                    openAddModal={() => {
                      setAddModalOpen(true);
                      navigate('/catalog');
                    }}
                    openIssueOrderModal={() => {
                      setIssueModalOpen(true);
                      navigate('/karigar');
                    }}
                  />
                } 
              />
              <Route
                path="/catalog"
                element={
                  <CatalogManager
                    itemDesigns={itemDesigns}
                    setItemDesigns={setItemDesigns}
                    tags={branchTags}
                    setTags={setTags}
                    isAddModalOpen={isAddModalOpen}
                    setAddModalOpen={setAddModalOpen}
                    allTags={tags}
                    transfers={stockTransfers}
                    setTransfers={setStockTransfers}
                    branches={branches}
                    activeBranch={activeBranch}
                    metalRates={metalRates}
                  />
                }
              />
              <Route
                path="/stones"
                element={
                  <StoneManager
                    karigars={karigars}
                    stones={branchStones}
                    setStones={setStones}
                  />
                }
              />
              <Route
                path="/billing"
                element={
                  <BillingEstimator
                    tags={branchTags}
                    setTags={setTags}
                    customers={customers}
                    setCustomers={setCustomers}
                    metalRates={metalRates}
                    invoices={branchInvoices}
                    setInvoices={setInvoices}
                    activeBranch={activeBranch}
                    taxRates={taxRates}
                    setTaxRates={setTaxRates}
                    itemDesigns={itemDesigns}
                  />
                }
              />
              <Route 
                path="/karigar" 
                element={
                  <KarigarManager 
                    karigars={karigars}
                    setKarigars={setKarigars}
                    jobWorks={branchJobWorks}
                    setJobWorks={setJobWorks}
                    ledger={karigarLedger}
                    setLedger={setKarigarLedger}
                    stones={stones}
                    setStones={setStones}
                    isIssueModalOpen={isIssueModalOpen}
                    setIssueModalOpen={setIssueModalOpen}
                  />
                } 
              />
              <Route
                path="/jobbags"
                element={
                  <JobBagManager
                    karigars={karigars}
                    jobWorks={branchJobWorks}
                    setJobWorks={setJobWorks}
                  />
                }
              />
              <Route 
                path="/customers" 
                element={
                  <CustomerManager
                    customers={customers}
                    setCustomers={setCustomers}
                  />
                }
              />
              <Route
                path="/oldgold"
                element={
                  <OldGoldManager
                    vouchers={branchOldGoldVouchers}
                    setVouchers={setOldGoldVouchers}
                    customers={customers}
                    metalRates={metalRates}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </main>
      </div>

      {/* FLOATING INTERACTIVE SIMULATION CONTROL CENTRE */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsDeskOpen(!isDeskOpen)}
          className="flex items-center gap-2 bg-[#141416]/95 hover:bg-zinc-900 border border-[#C5A059]/40 hover:border-[#C5A059] px-3.5 py-2 rounded-xl text-xs font-bold text-[#C5A059] shadow-xl shadow-black/60 backdrop-blur-xs transition"
          title="Toggle Simulation Control Desk"
        >
          <span className={`w-2 h-2 rounded-full ${forceOffline ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
          <span className="font-sans font-bold">Simulation Desk</span>
        </button>
        
        {isDeskOpen && (
          <div className="absolute bottom-12 right-0 w-80 bg-[#141416] border border-[#262626] rounded-2xl shadow-2xl p-5 space-y-4 text-left select-none">
            <div className="flex justify-between items-center border-b border-[#262626] pb-2.5">
              <h4 className="font-bold text-white text-xs">Simulated API Settings</h4>
              <button 
                onClick={() => setIsDeskOpen(false)} 
                className="text-zinc-500 hover:text-white text-[10px] font-mono font-bold uppercase"
              >
                Close
              </button>
            </div>
            
            <div className="space-y-3.5 text-xs">
              {/* Latency setting */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-500 uppercase font-bold">API Roundtrip Latency</label>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                  {[0, 600, 1500].map((ms) => (
                    <button
                      key={ms}
                      onClick={() => {
                        setLatency(ms);
                        localStorage.setItem('stitch_api_latency', String(ms));
                      }}
                      className={`py-1.5 rounded-lg border text-center transition ${
                        latency === ms 
                          ? 'bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/40 font-bold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {ms === 0 ? '0ms' : `${ms}ms`}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Force Offline toggle */}
              <div className="flex justify-between items-center py-2.5 border-t border-[#262626]">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Force Network Offline</span>
                  <span className="text-[9px] text-zinc-600 leading-none">Simulate REST API gateway timeout</span>
                </div>
                <button
                  onClick={() => {
                    const next = !forceOffline;
                    setForceOffline(next);
                    localStorage.setItem('stitch_api_force_offline', String(next));
                    if (next) {
                      setApiError('The database server is currently offline or the connection failed. Try disabling "Force offline" in the Simulation Desk at the bottom right.');
                    } else {
                      setApiError(null);
                    }
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                    forceOffline ? 'bg-red-600' : 'bg-zinc-800'
                  }`}
                >
                  <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                    forceOffline ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Reset database */}
              <div className="pt-2.5 border-t border-[#262626]">
                <button
                  onClick={() => {
                    if (confirm("Reset local database to initial factory defaults? This clears custom entries.")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2 bg-rose-950/20 hover:bg-rose-950/45 border border-rose-900/30 text-rose-400 hover:text-rose-300 font-bold rounded-lg transition text-center text-xs"
                >
                  Clear DB / Restore Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}
