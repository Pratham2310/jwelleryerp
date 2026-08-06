import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { initialMetalRates, initialItemDesigns, initialTags, initialCustomers, initialKarigars, initialJobWorks, initialInvoices, initialLooseStones, initialOldGoldVouchers, initialKarigarLedger, initialBranches, initialTaxRates, initialSavingsSchemes, initialSchemeEnrollments, initialSchemeInstalments, initialSuppliers, initialPurchaseOrders } from './data/mockData';
import { ItemDesign, Tag, Customer, Karigar, JobWork, SaleInvoice, MetalRate, LooseStone, OldGoldVoucher, KarigarLedgerEntry, Branch, StockTransfer, TaxRate, MetalRateVersion, HallmarkBatch, HallmarkPolicy, SavingsScheme, SchemeEnrollment, SchemeInstalment, Supplier, PurchaseOrder, GoodsReceipt, PurchaseInvoice, PurchaseReturn, ManualVoucher, StatutoryParameters, ApprovalRecord } from './types';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { HardwareProvider } from './contexts/HardwareContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import ToastStack from './components/ToastStack';
import { NOTIFY } from './lib/notifications';
import { DEFAULT_USERS, supervisorsFromUsers, activeUsers, type OperatorUser } from './lib/users';
import HardwarePanel from './components/HardwarePanel';
import OfflineQueueDrawer from './components/OfflineQueueDrawer';
import { syncQueue, summariseQueue, queueSale, type QueuedSale } from './lib/offlineQueue';
import { nextBranchInvoiceNumber } from './lib/branch';
import { getActiveBranch, primaryBranchId, scopeToBranch } from './lib/branch';
import { projectCurrentRates, seedVersionsFromRates } from './lib/rateMaster';
import { DEFAULT_ROLES, roleByName, canAccessRoute, can, type Role } from './lib/permissions';
import AdminSettings from './components/AdminSettings';
import {
  DEFAULT_STATUTORY_PARAMETERS,
  DEFAULT_SUPERVISOR_PINS,
  type SupervisorPin,
} from './lib/statutoryParameters';
import ReportsHub from './components/ReportsHub';
import InventoryOperations from './components/InventoryOperations';
import CustomerJobs from './components/CustomerJobs';
import type { RepairJob } from './lib/repairJob';
import type { CustomerOrder } from './lib/customerOrder';
import type { MemoVoucher } from './lib/memoOut';
import type { CustomerReceipt } from './lib/receivables';
import { DEFAULT_INCENTIVE_SCHEME, type IncentiveScheme } from './lib/salesAttribution';
import type { LoyaltyEntry } from './lib/loyalty';
import type { StockAdjustment } from './lib/stockAdjustment';
import type { MeltBatch } from './lib/melting';
import { DEFAULT_HALLMARK_POLICY } from './lib/hallmarkGuard';

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
import AccountingManager from './components/AccountingManager';
import PurchaseManager from './components/PurchaseManager';

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
  const { notify } = useNotifications();

  // Core database states (with LocalStorage persistence)
  // Metal metadata (id/metalType/purity). Since Milestone 48 the RATE itself is projected from
  // the append-only version history below, so nothing writes ratePerGram here directly.
  const [metalRates, setMetalRates] = useState<MetalRate[]>(() => {
    const saved = localStorage.getItem('stitch_metal_rates');
    return saved ? JSON.parse(saved) : initialMetalRates;
  });

  /**
   * Append-only metal rate history (Milestone 48, decision D-4). A rate is never overwritten;
   * a change is a new version. Shops that predate M48 have their existing sparkline points
   * reconstructed into an opening trail so no movement is lost.
   */
  const [rateVersions, setRateVersions] = useState<MetalRateVersion[]>(() => {
    const saved = localStorage.getItem('stitch_rate_versions');
    if (saved) return JSON.parse(saved);
    const base = localStorage.getItem('stitch_metal_rates');
    return seedVersionsFromRates(base ? JSON.parse(base) : initialMetalRates);
  });

  /** The current-rate view every other screen consumes, derived from the version history. */
  const projectedRates = useMemo(
    () => projectCurrentRates(rateVersions, metalRates),
    [rateVersions, metalRates]
  );

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

  // AHC hallmarking dispatch register (Milestone 24). A batch is a physical shipment to an
  // Assaying & Hallmarking Centre; results assign the legally-required HUID per piece.
  const [hallmarkBatches, setHallmarkBatches] = useState<HallmarkBatch[]>(() => {
    const saved = localStorage.getItem('stitch_hallmark_batches');
    return saved ? JSON.parse(saved) : [];
  });

  // Purchase Orders (Milestone 38). Branch-scoped: goods are delivered somewhere specific,
  // unlike the supplier who supplies the whole chain.
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem('stitch_purchase_orders');
    return saved ? JSON.parse(saved) : initialPurchaseOrders;
  });

  // Roles & permissions (Milestone 32). Gates the interface only — see src/lib/permissions.ts.
  const [roles, setRoles] = useState<Role[]>(() => {
    const saved = localStorage.getItem('stitch_roles');
    return saved ? JSON.parse(saved) : DEFAULT_ROLES;
  });

  // Manual Payment/Receipt/Contra vouchers (Milestone 45) — posted into the same journal.
  const [manualVouchers, setManualVouchers] = useState<ManualVoucher[]>(() => {
    const saved = localStorage.getItem('stitch_manual_vouchers');
    return saved ? JSON.parse(saved) : [];
  });

  // Purchase returns / debit notes (Milestone 41) — reverses stock AND the ITC claimed on it.
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>(() => {
    const saved = localStorage.getItem('stitch_purchase_returns');
    return saved ? JSON.parse(saved) : [];
  });

  // Supplier invoices & input tax credit (Milestone 40) — the purchase side of GST.
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(() => {
    const saved = localStorage.getItem('stitch_purchase_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  // Goods Receipts (Milestone 39). Branch-scoped, and the origin of purchased Tag records.
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>(() => {
    const saved = localStorage.getItem('stitch_goods_receipts');
    return saved ? JSON.parse(saved) : [];
  });

  // Supplier Master (Milestone 37). Tenant-wide, no branchId — decision D-5.
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('stitch_suppliers');
    return saved ? JSON.parse(saved) : initialSuppliers;
  });

  // Gold Savings Schemes (Milestones 26-27). Tenant-wide like the other masters (D-5): a
  // customer's scheme follows them across branches. The balance is NOT stored anywhere — it is
  // folded from `schemeInstalments`, the same way karigar balances and metal rates work.
  const [savingsSchemes, setSavingsSchemes] = useState<SavingsScheme[]>(() => {
    const saved = localStorage.getItem('stitch_savings_schemes');
    return saved ? JSON.parse(saved) : initialSavingsSchemes;
  });

  const [schemeEnrollments, setSchemeEnrollments] = useState<SchemeEnrollment[]>(() => {
    const saved = localStorage.getItem('stitch_scheme_enrollments');
    return saved ? JSON.parse(saved) : initialSchemeEnrollments;
  });

  const [schemeInstalments, setSchemeInstalments] = useState<SchemeInstalment[]>(() => {
    const saved = localStorage.getItem('stitch_scheme_instalments');
    return saved ? JSON.parse(saved) : initialSchemeInstalments;
  });

  // Non-hallmarked sale guard policy (Milestone 25). PRD §11.3 requires this be configurable
  // rather than absolute, because mandatory hallmarking has genuine exemptions.
  const [hallmarkPolicy, setHallmarkPolicy] = useState<HallmarkPolicy>(() => {
    const saved = localStorage.getItem('stitch_hallmark_policy');
    // Merge over the default so a policy saved before a new field was added still loads.
    return saved ? { ...DEFAULT_HALLMARK_POLICY, ...JSON.parse(saved) } : DEFAULT_HALLMARK_POLICY;
  });

  // Statutory thresholds (Milestone 34). Held as data rather than constants because they move by
  // notification — a shop must be able to comply the same day, not wait for a release.
  const [statutoryParameters, setStatutoryParameters] = useState<StatutoryParameters>(() => {
    const saved = localStorage.getItem('stitch_statutory_parameters');
    // Merged over the default so a set saved before a new parameter existed still loads, and
    // an unconfigured threshold falls back to the statutory figure rather than to zero.
    return saved ? { ...DEFAULT_STATUTORY_PARAMETERS, ...JSON.parse(saved) } : DEFAULT_STATUTORY_PARAMETERS;
  });

  // Supervisor approvals (Milestone 33). Append-only: an approval that happened cannot un-happen,
  // and the audit trail is the whole point of collecting it.
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(() => {
    const saved = localStorage.getItem('stitch_approvals');
    return saved ? JSON.parse(saved) : [];
  });

  const [supervisorPins, setSupervisorPins] = useState<SupervisorPin[]>(() => {
    const saved = localStorage.getItem('stitch_supervisor_pins');
    return saved ? JSON.parse(saved) : DEFAULT_SUPERVISOR_PINS;
  });

  // Loyalty points ledger (Milestone 59). Append-only: balances are derived from it, so an
  // expiry sweep run twice cannot double-count.
  const [loyaltyEntries, setLoyaltyEntries] = useState<LoyaltyEntry[]>(() => {
    const saved = localStorage.getItem('stitch_loyalty_entries');
    return saved ? JSON.parse(saved) : [];
  });

  // Incentive schemes (Milestone 58). Append-only in spirit: a new scheme carries a later
  // effective date and never restates what past sales already earned.
  const [incentiveSchemes, setIncentiveSchemes] = useState<IncentiveScheme[]>(() => {
    const saved = localStorage.getItem('stitch_incentive_schemes');
    return saved ? JSON.parse(saved) : [DEFAULT_INCENTIVE_SCHEME];
  });

  // Customer receipts against credit sales (Milestone 57). Allocations are explicit, so
  // "which bill did this payment settle" always has an answer.
  const [customerReceipts, setCustomerReceipts] = useState<CustomerReceipt[]>(() => {
    const saved = localStorage.getItem('stitch_customer_receipts');
    return saved ? JSON.parse(saved) : [];
  });

  // Memo / approval vouchers (Milestone 56). Pieces out with a customer are still the shop's
  // asset — the one case where "in stock" and "sellable" genuinely differ.
  const [memos, setMemos] = useState<MemoVoucher[]>(() => {
    const saved = localStorage.getItem('stitch_memos');
    return saved ? JSON.parse(saved) : [];
  });

  // Customer orders (Milestone 55). Advances held here are a LIABILITY until delivery — the
  // same treatment scheme instalments get in M26, and for the same reason.
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>(() => {
    const saved = localStorage.getItem('stitch_customer_orders');
    return saved ? JSON.parse(saved) : [];
  });

  // Repair jobs (Milestone 54). Customer property held in custody — deliberately NOT tags,
  // because booking someone else's chain as stock would overstate what the business owns.
  const [repairJobs, setRepairJobs] = useState<RepairJob[]>(() => {
    const saved = localStorage.getItem('stitch_repair_jobs');
    return saved ? JSON.parse(saved) : [];
  });

  // Operator accounts (Milestone 49). Deactivated, never deleted — see src/lib/users.ts.
  const [users, setUsers] = useState<OperatorUser[]>(() => {
    const saved = localStorage.getItem('stitch_users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });

  // Stock write-offs (Milestone 42) and melt batches (Milestone 43). Both are append-only
  // registers: a loss that happened cannot un-happen, and a melt is physically irreversible.
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    const saved = localStorage.getItem('stitch_stock_adjustments');
    return saved ? JSON.parse(saved) : [];
  });

  const [meltBatches, setMeltBatches] = useState<MeltBatch[]>(() => {
    const saved = localStorage.getItem('stitch_melt_batches');
    return saved ? JSON.parse(saved) : [];
  });

  // Offline POS queue (Milestone 36). A sale raised while the terminal is offline is held here
  // rather than in the register, because it has no confirmed place in the invoice series yet.
  const [offlineQueue, setOfflineQueue] = useState<QueuedSale[]>(() => {
    const saved = localStorage.getItem('stitch_offline_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isQueueDrawerOpen, setQueueDrawerOpen] = useState(false);

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

  /**
   * Drains the offline queue into the register (Milestone 36). Partial by design: a clean bill
   * lands even when another conflicts, because holding a good sale hostage to an unrelated
   * collision leaves the books understated for as long as the conflict goes unresolved.
   */
  const runQueueSync = React.useCallback(() => {
    const result = syncQueue(offlineQueue, invoices);
    if (result.invoicesToCommit.length > 0) {
      setInvoices(prev => [...result.invoicesToCommit, ...prev]);
    }
    // A conflict is a compliance problem, not a notice — it is raised loudly and stays until read.
    for (const conflict of result.conflicts) {
      notify(NOTIFY.syncConflict(conflict.invoice.invoiceNumber));
    }
    // Rebuilt in the order the sales were made, so the drawer reads as a till roll rather than
    // resorting itself every time one entry changes state.
    const byId = new Map([...result.synced, ...result.conflicts].map(q => [q.id, q]));
    setOfflineQueue(offlineQueue.map(q => byId.get(q.id) ?? q));
  }, [offlineQueue, invoices, notify]);

  // Coming back online drains the queue by itself. A counter that has to remember to press a
  // button is a counter that leaves sales out of the books.
  const wasOffline = React.useRef(forceOffline);
  useEffect(() => {
    if (wasOffline.current && !forceOffline) runQueueSync();
    wasOffline.current = forceOffline;
  }, [forceOffline, runQueueSync]);

  // Global popup controllers
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isIssueModalOpen, setIssueModalOpen] = useState(false);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('stitch_metal_rates', JSON.stringify(metalRates));
  }, [metalRates]);

  useEffect(() => {
    localStorage.setItem('stitch_rate_versions', JSON.stringify(rateVersions));
  }, [rateVersions]);

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
    localStorage.setItem('stitch_statutory_parameters', JSON.stringify(statutoryParameters));
  }, [statutoryParameters]);

  useEffect(() => {
    localStorage.setItem('stitch_approvals', JSON.stringify(approvals));
  }, [approvals]);

  useEffect(() => {
    localStorage.setItem('stitch_supervisor_pins', JSON.stringify(supervisorPins));
  }, [supervisorPins]);

  useEffect(() => {
    localStorage.setItem('stitch_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem('stitch_stock_adjustments', JSON.stringify(stockAdjustments));
  }, [stockAdjustments]);

  useEffect(() => {
    localStorage.setItem('stitch_melt_batches', JSON.stringify(meltBatches));
  }, [meltBatches]);

  useEffect(() => {
    localStorage.setItem('stitch_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('stitch_repair_jobs', JSON.stringify(repairJobs));
  }, [repairJobs]);

  useEffect(() => {
    localStorage.setItem('stitch_customer_orders', JSON.stringify(customerOrders));
  }, [customerOrders]);

  useEffect(() => {
    localStorage.setItem('stitch_memos', JSON.stringify(memos));
  }, [memos]);

  useEffect(() => {
    localStorage.setItem('stitch_customer_receipts', JSON.stringify(customerReceipts));
  }, [customerReceipts]);

  useEffect(() => {
    localStorage.setItem('stitch_incentive_schemes', JSON.stringify(incentiveSchemes));
  }, [incentiveSchemes]);

  useEffect(() => {
    localStorage.setItem('stitch_loyalty_entries', JSON.stringify(loyaltyEntries));
  }, [loyaltyEntries]);

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
    localStorage.setItem('stitch_hallmark_batches', JSON.stringify(hallmarkBatches));
  }, [hallmarkBatches]);

  useEffect(() => {
    localStorage.setItem('stitch_hallmark_policy', JSON.stringify(hallmarkPolicy));
  }, [hallmarkPolicy]);

  useEffect(() => {
    localStorage.setItem('stitch_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('stitch_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  useEffect(() => {
    localStorage.setItem('stitch_goods_receipts', JSON.stringify(goodsReceipts));
  }, [goodsReceipts]);

  useEffect(() => {
    localStorage.setItem('stitch_purchase_invoices', JSON.stringify(purchaseInvoices));
  }, [purchaseInvoices]);

  useEffect(() => {
    localStorage.setItem('stitch_purchase_returns', JSON.stringify(purchaseReturns));
  }, [purchaseReturns]);

  useEffect(() => {
    localStorage.setItem('stitch_manual_vouchers', JSON.stringify(manualVouchers));
  }, [manualVouchers]);

  useEffect(() => {
    localStorage.setItem('stitch_roles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('stitch_savings_schemes', JSON.stringify(savingsSchemes));
  }, [savingsSchemes]);

  useEffect(() => {
    localStorage.setItem('stitch_scheme_enrollments', JSON.stringify(schemeEnrollments));
  }, [schemeEnrollments]);

  useEffect(() => {
    localStorage.setItem('stitch_scheme_instalments', JSON.stringify(schemeInstalments));
  }, [schemeInstalments]);

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

  /** The signed-in user's role. An unrecognised name resolves to null, which grants nothing. */
  const currentRole = useMemo(() => roleByName(roles, user?.role || ''), [roles, user]);
  const queueSummary = useMemo(() => summariseQueue(offlineQueue), [offlineQueue]);

  /**
   * The counter keeps selling through an outage (Milestone 36). Blanking the billing screen when
   * the connection drops is what an offline queue exists to prevent — a shop cannot tell a
   * customer holding a chain to come back when the server is up. Every other screen is a read or
   * a report that genuinely needs the server, so those still show the outage.
   */
  const OFFLINE_CAPABLE_ROUTES = ['/billing'];
  const isOfflineCapableRoute = OFFLINE_CAPABLE_ROUTES.includes(location.pathname);

  /**
   * Hiding a nav link is not a guard — a typed URL would still render the screen. This bounces
   * any route the role cannot reach back to the Dashboard, which is deliberately ungated so a
   * denied user always lands somewhere rather than on a blank page.
   */
  useEffect(() => {
    if (!user) return;
    if (!canAccessRoute(currentRole, location.pathname)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, currentRole, location.pathname, navigate]);
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
        metalRates={projectedRates} 
        activeBranch={activeBranch}
        operatorName={user.name} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        currentRole={currentRole}
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
          {apiError && !isOfflineCapableRoute ? (
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
                    metalRates={projectedRates}
                    rateVersions={rateVersions}
                    setRateVersions={setRateVersions}
                    operatorName={user?.name || 'Operator'}
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
                    metalRates={projectedRates}
                    hallmarkBatches={hallmarkBatches}
                    setHallmarkBatches={setHallmarkBatches}
                    hallmarkPolicy={hallmarkPolicy}
                    setHallmarkPolicy={setHallmarkPolicy}
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
                    metalRates={projectedRates}
                    invoices={branchInvoices}
                    setInvoices={setInvoices}
                    activeBranch={activeBranch}
                    taxRates={taxRates}
                    setTaxRates={setTaxRates}
                    itemDesigns={itemDesigns}
                    hallmarkPolicy={hallmarkPolicy}
                    statutoryParameters={statutoryParameters}
                    supervisors={supervisorsFromUsers(users, roles)}
                    currentUserName={user?.name || 'Counter'}
                    customerReceipts={customerReceipts}
                    salespeople={activeUsers(users).map(u => ({ id: u.id, name: u.name }))}
                    incentiveSchemes={incentiveSchemes}
                    loyaltyEntries={loyaltyEntries}
                    onLoyaltyEntries={fresh => setLoyaltyEntries(prev => [...prev, ...fresh])}
                    onApprovalRecorded={record => {
                      setApprovals(prev => [record, ...prev]);
                      notify(NOTIFY.supervisorApproval(record.kind === 'LARGE_DISCOUNT'
                        ? 'Large discount' : 'Price override', record.amount, record.approvedBy));
                    }}
                    isOffline={forceOffline}
                    onQueueSale={invoice => {
                      setOfflineQueue(prev => [...prev, queueSale(invoice)]);
                      notify(NOTIFY.saleQueuedOffline(invoice.invoiceNumber, invoice.grandTotal));
                    }}
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
                    loyaltyEntries={loyaltyEntries}
                    customers={customers}
                    setCustomers={setCustomers}
                    schemes={savingsSchemes}
                    setSchemes={setSavingsSchemes}
                    enrollments={schemeEnrollments}
                    setEnrollments={setSchemeEnrollments}
                    instalments={schemeInstalments}
                    setInstalments={setSchemeInstalments}
                    activeBranch={activeBranch}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    invoices={invoices}
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
                    metalRates={projectedRates}
                  />
                }
              />
              <Route
                path="/purchases"
                element={
                  <PurchaseManager
                    purchaseOrders={purchaseOrders}
                    setPurchaseOrders={setPurchaseOrders}
                    suppliers={suppliers}
                    itemDesigns={itemDesigns}
                    branches={branches}
                    activeBranch={activeBranch}
                    goodsReceipts={goodsReceipts}
                    setGoodsReceipts={setGoodsReceipts}
                    allTags={tags}
                    setTags={setTags}
                    purchaseInvoices={purchaseInvoices}
                    setPurchaseInvoices={setPurchaseInvoices}
                    purchaseReturns={purchaseReturns}
                    setPurchaseReturns={setPurchaseReturns}
                  />
                }
              />
              <Route
                path="/accounting"
                element={
                  <AccountingManager
                    invoices={invoices}
                    oldGoldVouchers={oldGoldVouchers}
                    schemeInstalments={schemeInstalments}
                    karigarLedger={karigarLedger}
                    karigars={karigars}
                    manualVouchers={manualVouchers}
                    setManualVouchers={setManualVouchers}
                    customers={customers}
                    receipts={customerReceipts}
                    setReceipts={setCustomerReceipts}
                    currentUserName={user?.name || 'Counter'}
                    activeBranch={activeBranch}
                  />
                }
              />
              <Route
                path="/reports"
                element={
                  <ReportsHub
                    invoices={invoices}
                    tags={tags}
                    customers={customers}
                    suppliers={suppliers}
                    karigars={karigars}
                    karigarLedger={karigarLedger}
                    purchaseInvoices={purchaseInvoices}
                    branches={branches}
                    metalRates={projectedRates}
                    stockAdjustments={stockAdjustments}
                    incentiveSchemes={incentiveSchemes}
                    setIncentiveSchemes={setIncentiveSchemes}
                    oldGoldVouchers={branchOldGoldVouchers}
                  />
                }
              />
              <Route
                path="/inventory"
                element={
                  <InventoryOperations
                    tags={branchTags}
                    setTags={setTags}
                    metalRates={projectedRates}
                    oldGoldVouchers={branchOldGoldVouchers}
                    setOldGoldVouchers={setOldGoldVouchers}
                    adjustments={stockAdjustments}
                    setAdjustments={setStockAdjustments}
                    meltBatches={meltBatches}
                    setMeltBatches={setMeltBatches}
                    memos={memos}
                    setMemos={setMemos}
                    activeBranch={activeBranch}
                    currentRole={currentRole}
                    currentUserName={user?.name || 'Counter'}
                    lastAudit={null}
                  />
                }
              />
              <Route
                path="/orders"
                element={
                  <CustomerJobs
                    orders={customerOrders}
                    setOrders={setCustomerOrders}
                    repairJobs={repairJobs}
                    setRepairJobs={setRepairJobs}
                    karigars={karigars}
                    metalRates={projectedRates}
                    activeBranch={activeBranch}
                    currentUserName={user?.name || 'Counter'}
                    canManage={can(currentRole, 'billing.create')}
                  />
                }
              />
              <Route
                path="/roles"
                element={
                  <AdminSettings
                    roles={roles}
                    setRoles={setRoles}
                    assignedRoleNames={user?.role ? [user.role] : []}
                    currentRole={currentRole}
                    statutoryParameters={statutoryParameters}
                    setStatutoryParameters={setStatutoryParameters}
                    approvals={approvals}
                    supervisors={supervisorsFromUsers(users, roles)}
                    users={users}
                    setUsers={setUsers}
                    branches={branches}
                    forceOffline={forceOffline}
                    latencyMs={latency}
                    queuedSales={queueSummary.pending}
                    queueConflicts={queueSummary.conflicts}
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
          className="surface-dark flex items-center gap-2 bg-[#141416]/95 hover:bg-zinc-900 border border-[#C5A059]/40 hover:border-[#C5A059] px-3.5 py-2 rounded-xl text-xs font-bold text-[#C5A059] shadow-xl shadow-black/60 backdrop-blur-xs transition"
          title="Toggle Simulation Control Desk"
        >
          <span className={`w-2 h-2 rounded-full ${forceOffline ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
          <span className="font-sans font-bold">Simulation Desk</span>
          {queueSummary.pending + queueSummary.conflicts > 0 && (
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-black ${
              queueSummary.conflicts > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-[#0A0A0B]'
            }`}>
              {queueSummary.pending + queueSummary.conflicts}
            </span>
          )}
        </button>
        
        {/* `surface-dark` opts this panel out of the light-mode override sheet: it stays
            dark in both themes — see the block at the end of index.css. */}
        {isDeskOpen && (
          <div className="surface-dark absolute bottom-12 right-0 w-80 bg-[#141416] border border-[#262626] rounded-2xl shadow-2xl p-5 space-y-4 text-left select-none">
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

              {/* Offline sales queue (Milestone 36) */}
              <div className="pt-2.5 border-t border-[#262626] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Offline Sales Queue</span>
                  <span className={`text-[9px] font-mono font-bold uppercase ${
                    queueSummary.conflicts > 0 ? 'text-rose-400'
                      : queueSummary.pending > 0 ? 'text-amber-400' : 'text-zinc-600'
                  }`}>
                    {queueSummary.conflicts > 0
                      ? `${queueSummary.conflicts} conflict${queueSummary.conflicts === 1 ? '' : 's'}`
                      : queueSummary.pending > 0 ? `${queueSummary.pending} pending` : 'clear'}
                  </span>
                </div>
                {queueSummary.pendingValue > 0 && (
                  <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">
                    ₹{queueSummary.pendingValue.toLocaleString('en-IN')} not yet in the register
                  </p>
                )}
                <button
                  onClick={() => setQueueDrawerOpen(true)}
                  className="w-full py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-[10px] font-mono font-bold text-zinc-400 transition"
                >
                  Open Queue{queueSummary.conflicts > 0 ? ' — Resolve Conflicts' : ''}
                </button>
              </div>

              {/* Simulated hardware (Milestone 35) */}
              <div className="pt-2.5 border-t border-[#262626]">
                <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold mb-2.5">Peripherals</p>
                <HardwarePanel />
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

      {isQueueDrawerOpen && (
        <OfflineQueueDrawer
          queue={offlineQueue}
          setQueue={setOfflineQueue}
          invoices={invoices}
          nextInvoiceNumber={() => nextBranchInvoiceNumber(activeBranch)}
          onSync={runQueueSync}
          isOffline={forceOffline}
          onClose={() => setQueueDrawerOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <HardwareProvider>
          <Router>
            <AppContent />
            <ToastStack />
          </Router>
        </HardwareProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
