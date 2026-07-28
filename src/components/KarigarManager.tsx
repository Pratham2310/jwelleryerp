import React, { useState } from 'react';
import { 
  Hammer, 
  UserCheck, 
  Coins, 
  Scale, 
  Calendar, 
  TrendingUp, 
  ChevronRight, 
  FilePlus, 
  CheckCircle,
  X,
  History,
  Sparkles,
  RefreshCw,
  Wallet,
  AlertTriangle
} from 'lucide-react';
import { Karigar, JobWork, KarigarLedgerEntry } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  fineGoldEquivalent,
  purityPercentForMetal,
  assessWastage,
  deriveKarigarBalance,
  buildLedgerStatement,
  LEDGER_ENTRY_LABEL,
} from '../lib/fineGoldLedger';
import { nextJobNumber, canReceiveFinishedGoods, receiptBlockedReason, STAGE_LABEL } from '../lib/jobWork';
import {
  buildWastageReview,
  pendingReviews,
  summariseReviewQueue,
  reviewBlockedReason,
  resolutionClearsBalance,
  validateReviewNote,
  validateScrapReturn,
  REVIEW_STATUS_LABEL,
} from '../lib/wastageReview';
import type { WastageReviewStatus, LooseStone } from '../types';

interface KarigarManagerProps {
  karigars: Karigar[];
  setKarigars: React.Dispatch<React.SetStateAction<Karigar[]>>;
  jobWorks: JobWork[];
  setJobWorks: React.Dispatch<React.SetStateAction<JobWork[]>>;
  ledger: KarigarLedgerEntry[];
  setLedger: React.Dispatch<React.SetStateAction<KarigarLedgerEntry[]>>;
  // Needed so unused stones issued to a karigar can be returned to the vault (Milestone 18)
  stones: LooseStone[];
  setStones: React.Dispatch<React.SetStateAction<LooseStone[]>>;
  isIssueModalOpen: boolean;
  setIssueModalOpen: (open: boolean) => void;
}

export default function KarigarManager({
  karigars,
  setKarigars,
  jobWorks,
  setJobWorks,
  ledger,
  setLedger,
  stones,
  setStones,
  isIssueModalOpen,
  setIssueModalOpen
}: KarigarManagerProps) {
  // Ledger statement viewer (Milestone 16). Explicitly theme-aware — index.css's dark-mode
  // repaint only remaps a fixed list of classes, so anything new must branch itself
  // (KNOWN_ISSUES #12; this bit the Stock Audit panel and the Dashboard chart before).
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [statementKarigarId, setStatementKarigarId] = useState<string | null>(null);

  /**
   * Appends to the append-only ledger. Entries are never edited or deleted — this is the
   * only write path for a karigar balance (KNOWN_ISSUES #10 / decision D-2).
   */
  const appendLedger = (entries: Omit<KarigarLedgerEntry, 'id' | 'sequence'>[]) => {
    setLedger(prev => {
      let seq = prev.length;
      const created = entries.map((e, i) => ({
        ...e,
        id: `kle-${Date.now()}-${i}`,
        sequence: ++seq,
      }));
      return [...prev, ...created];
    });
  };
  // Navigation tabs for Karigar Manager
  const [activeSubTab, setActiveSubTab] = useState<'artisans' | 'orders'>('artisans');

  // Form states for issuing order
  const [selectedKarigarId, setSelectedKarigarId] = useState('');
  const [designName, setDesignName] = useState('');
  const [category, setCategory] = useState('Earrings');
  const [goldIssued, setGoldIssued] = useState<number>(0);
  const [metalType, setMetalType] = useState('Gold (22K)');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Form states for receiving finished order
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [finishedWeight, setFinishedWeight] = useState<number>(0);
  const [allowedWastage, setAllowedWastage] = useState<number>(3); // 3%
  const [laborCharge, setLaborCharge] = useState<number>(0);
  // A karigar can return a piece at a different purity than was issued — capturing this is
  // what makes the fine-gold comparison meaningful (PRD §6.2, Milestone 16).
  const [receivedMetalType, setReceivedMetalType] = useState('Gold (22K)');
  const [receiptError, setReceiptError] = useState('');

  // Excess-wastage review + scrap/stone return (Milestone 18)
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [scrapKarigarId, setScrapKarigarId] = useState<string | null>(null);
  const [scrapWeight, setScrapWeight] = useState<number>(0);
  const [scrapPurity, setScrapPurity] = useState<number>(91.6);
  const [scrapStoneIds, setScrapStoneIds] = useState<string[]>([]);
  const [scrapError, setScrapError] = useState('');

  const reviewQueue = summariseReviewQueue(jobWorks);

  // Inline payout confirmation state
  const [payoutConfirmId, setPayoutConfirmId] = useState<string | null>(null);

  const handleIssueWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKarigarId || !designName || !goldIssued || !dueDate) {
      alert("Please fill in all mandatory fields!");
      return;
    }

    const karigar = karigars.find(k => k.id === selectedKarigarId);
    if (!karigar) return;

    const today = new Date().toISOString().split('T')[0];
    const newOrder: JobWork = {
      id: `job-${Date.now()}`,
      jobNo: nextJobNumber(jobWorks),
      karigarId: selectedKarigarId,
      karigarName: karigar.name,
      designName,
      category,
      metalType,
      goldIssued: Number(goldIssued),
      issueDate: today,
      dueDate,
      // A newly issued job starts off the board until the karigar begins casting
      stage: 'Issued',
      priority: 'Normal',
      stonesIssued: 'None',
      metalLossRecorded: 0,
      receiptStatus: 'Pending',
      notes,
      createdAt: today,
    };

    // One unified record — this same job is now immediately visible on the Job Bags board
    setJobWorks(prev => [newOrder, ...prev]);

    // Metal issued is recorded in FINE gold equivalent, so a 22K issue and an 18K receipt
    // are comparable later (PRD §6.2). The gross weight and purity are kept alongside so
    // the maths stays auditable.
    const purity = purityPercentForMetal(metalType);
    const fineIssued = fineGoldEquivalent(Number(goldIssued), purity);

    appendLedger([{
      karigarId: selectedKarigarId,
      date: newOrder.issueDate,
      type: 'METAL_ISSUED',
      workOrderId: newOrder.id,
      narration: `${newOrder.jobNo} — ${designName} (${metalType})`,
      fineWeightDelta: fineIssued,
      grossWeight: Number(goldIssued),
      purityPercent: purity,
    }]);

    // Reset Form
    setSelectedKarigarId('');
    setDesignName('');
    setGoldIssued(0);
    setNotes('');
    setIssueModalOpen(false);
  };

  const handleReceiveOrderDetails = (order: JobWork) => {
    setReceivingOrderId(order.id);
    // Suggest estimated labor charge
    setLaborCharge(Math.round(order.goldIssued * 450));
    setFinishedWeight(order.goldIssued);
    // Default to the purity that was issued; staff change it if the piece came back different
    setReceivedMetalType(order.metalType);
    setReceiptError('');
  };

  const handleCompleteReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingOrderId || !finishedWeight || !laborCharge) return;

    const order = jobWorks.find(o => o.id === receivingOrderId);
    if (!order) return;

    // Finished goods can only be booked once the piece has actually finished on the floor.
    // This is precisely the drift the old two-model split allowed (Milestone 17).
    const blocked = receiptBlockedReason(order);
    if (blocked) {
      setReceiptError(blocked);
      return;
    }

    // Wastage is assessed in FINE gold, not raw grams (PRD §6.2). Comparing raw grams
    // across different purities understates the loss badly — issuing 22K and receiving
    // 18K back would otherwise look almost lossless.
    const issuedPurity = purityPercentForMetal(order.metalType);
    const receivedPurity = purityPercentForMetal(receivedMetalType);
    const fineIssued = fineGoldEquivalent(order.goldIssued, issuedPurity);
    const fineReturned = fineGoldEquivalent(Number(finishedWeight), receivedPurity);
    const assessment = assessWastage(fineIssued, fineReturned, allowedWastage);
    const today = new Date().toISOString().split('T')[0];

    setJobWorks(prev => prev.map(o => {
      if (o.id === receivingOrderId) {
        return {
          ...o,
          receiptStatus: 'Received' as const,
          finishedWeight: Number(finishedWeight),
          finishedMetalType: receivedMetalType,
          actualWastage: assessment.fineLost,
          laborCharge: Number(laborCharge),
          // Excess beyond the agreed cap is flagged for owner review rather than absorbed
          // (PRD §6.2, Milestone 18) — a possible loss/theft indicator.
          wastageReview: buildWastageReview(assessment, today) ?? undefined,
        };
      }
      return o;
    }));

    const entries: Omit<KarigarLedgerEntry, 'id' | 'sequence'>[] = [
      {
        karigarId: order.karigarId,
        date: today,
        type: 'METAL_RETURNED',
        workOrderId: order.id,
        narration: `${order.jobNo} — received ${Number(finishedWeight).toFixed(3)}g ${receivedMetalType}`,
        fineWeightDelta: -fineReturned,
        grossWeight: Number(finishedWeight),
        purityPercent: receivedPurity,
      },
      {
        karigarId: order.karigarId,
        date: today,
        type: 'WASTAGE_ALLOWED',
        workOrderId: order.id,
        narration: `${order.jobNo} — wastage absorbed @ ${allowedWastage}% (${assessment.wastagePercent.toFixed(2)}% actual)`,
        // Only the agreed portion is written off here. Anything beyond the cap stays on the
        // karigar's balance for owner review rather than being silently absorbed — the
        // previous code capped it away with Math.min(). The review workflow is Milestone 18.
        fineWeightDelta: -Math.min(assessment.fineLost, assessment.allowedFineWeight),
      },
    ];

    // Labour is a money liability and must never net against the weight ledger (D-2)
    if (Number(laborCharge) > 0) {
      entries.push({
        karigarId: order.karigarId,
        date: today,
        type: 'LABOUR_CHARGED',
        workOrderId: order.id,
        narration: `${order.jobNo} — making charges`,
        moneyDelta: Number(laborCharge),
      });
    }

    appendLedger(entries);
    setReceivingOrderId(null);
  };

  /**
   * Owner decision on an over-cap wastage flag. Writing it off means the SHOP absorbs the
   * loss, so a ledger entry clears it from the karigar's balance. Recovering means the
   * KARIGAR bears it, so the balance is deliberately left alone — they still owe the metal.
   */
  const handleResolveReview = (status: WastageReviewStatus) => {
    const job = jobWorks.find(j => j.id === reviewJobId);
    if (!job || !job.wastageReview) return;

    const blocked = reviewBlockedReason(job);
    if (blocked) { setReviewError(blocked); return; }
    const noteError = validateReviewNote(reviewNote);
    if (noteError) { setReviewError(noteError); return; }

    const today = new Date().toISOString().split('T')[0];
    const excess = job.wastageReview.excessFineWeight;

    setJobWorks(prev => prev.map(j => j.id === job.id
      ? { ...j, wastageReview: { ...j.wastageReview!, status, reviewedOn: today, reviewNote: reviewNote.trim() } }
      : j));

    if (resolutionClearsBalance(status)) {
      appendLedger([{
        karigarId: job.karigarId,
        date: today,
        type: 'WASTAGE_EXCESS_WRITTEN_OFF',
        workOrderId: job.id,
        narration: `${job.jobNo} — excess wastage written off: ${reviewNote.trim()}`,
        fineWeightDelta: -excess,
      }]);
    }

    setReviewJobId(null);
    setReviewNote('');
    setReviewError('');
  };

  /**
   * Scrap / unused stone return (PRD §6.2 workflow step 3). Returned filings reduce the
   * karigar's fine-gold payable; returned stones go back to the vault, reusing StoneManager's
   * existing Issued/In Vault states rather than inventing a parallel status.
   */
  const handleScrapReturn = () => {
    const karigarId = scrapKarigarId;
    if (!karigarId) return;
    const karigar = karigars.find(k => k.id === karigarId);
    if (!karigar) return;

    const hasScrap = Number(scrapWeight) > 0;
    const hasStones = scrapStoneIds.length > 0;
    if (!hasScrap && !hasStones) {
      setScrapError('Record returned scrap metal, unused stones, or both.');
      return;
    }
    if (hasScrap) {
      const err = validateScrapReturn({ grossWeight: scrapWeight, purityPercent: scrapPurity });
      if (err) { setScrapError(err); return; }
    }

    const today = new Date().toISOString().split('T')[0];

    if (hasScrap) {
      const fine = fineGoldEquivalent(Number(scrapWeight), Number(scrapPurity));
      appendLedger([{
        karigarId,
        date: today,
        type: 'SCRAP_RETURNED',
        narration: `Scrap / filings returned — ${Number(scrapWeight).toFixed(3)}g @ ${scrapPurity}%`,
        fineWeightDelta: -fine,
        grossWeight: Number(scrapWeight),
        purityPercent: Number(scrapPurity),
      }]);
    }

    if (hasStones) {
      setStones(prev => prev.map(st => scrapStoneIds.includes(st.id)
        ? { ...st, status: 'In Vault' as const, assignedKarigarName: undefined }
        : st));
    }

    setScrapKarigarId(null);
    setScrapWeight(0);
    setScrapStoneIds([]);
    setScrapError('');
  };

  const handlePayoutKarigar = (id: string, amount: number) => {
    setKarigars(prev => prev.map(k => {
      if (k.id === id) {
        return {
          ...k,
          laborChargesOwed: Math.max(0, k.laborChargesOwed - amount)
        };
      }
      return k;
    }));
    // Money ledger only — a payout must never touch the weight ledger (D-2)
    appendLedger([{
      karigarId: id,
      date: new Date().toISOString().split('T')[0],
      type: 'LABOUR_PAID',
      narration: 'Labour payout cleared',
      moneyDelta: -Math.abs(amount),
    }]);
    setPayoutConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Excess-wastage review queue (Milestone 18, PRD §6.2). Only rendered when something
          is actually outstanding — an empty alert bar trains staff to ignore it. */}
      {reviewQueue.pendingCount > 0 && (
        <div className={`border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          dark ? 'border-rose-900/50 bg-rose-950/25 text-rose-300' : 'border-rose-200 bg-rose-50/70 text-rose-900'
        }`}>
          <div className="flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <span className="font-bold block">
                {reviewQueue.pendingCount} job{reviewQueue.pendingCount === 1 ? '' : 's'} exceeded the agreed wastage cap
                — {reviewQueue.totalExcessFineWeight.toFixed(3)}g fine gold awaiting owner review
              </span>
              {reviewQueue.worstOffenderKarigarName && (
                <span className="opacity-80">
                  Highest exposure: {reviewQueue.worstOffenderKarigarName} ({reviewQueue.worstOffenderExcess.toFixed(3)}g).
                  Repeated flags against one artisan are the pattern PRD §6.2 asks the system to surface.
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => setActiveSubTab('orders')}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white transition shrink-0"
          >
            Review Flagged Jobs
          </button>
        </div>
      )}

      {/* Sub tabs */}
      <div className="flex border-b border-slate-150 gap-4">
        <button
          onClick={() => setActiveSubTab('artisans')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeSubTab === 'artisans'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Artisans Ledger
        </button>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeSubTab === 'orders'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Jobwork Orders
        </button>
      </div>

      {activeSubTab === 'artisans' ? (
        /* ARTISANS LEDGER GRID */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {karigars.map((kar) => {
              const activeOrders = jobWorks.filter(o => o.karigarId === kar.id && o.receiptStatus === 'Pending');
              const completedOrders = jobWorks.filter(o => o.karigarId === kar.id && o.receiptStatus === 'Received');
              // Balances are DERIVED from the append-only ledger, never read from a stored
              // running total (Milestone 16, KNOWN_ISSUES #10).
              const balance = deriveKarigarBalance(ledger, kar.id);

              return (
                <div 
                  key={kar.id}
                  className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-sans font-bold text-slate-800 text-base">{kar.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">Specialty: {kar.specialty}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold font-mono">
                        Rating: {kar.rating}★
                      </span>
                    </div>
                  </div>

                  {/* Ledger balances — weight and money kept strictly separate (D-2) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100/50">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider block">Fine Gold Payable</span>
                      <span className={`font-mono text-base font-black ${balance.fineWeightPayable < 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {balance.fineWeightPayable.toFixed(3)} g
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-1">
                        {balance.fineWeightPayable < 0
                          ? 'Shop owes artisan metal'
                          : '24K equivalent held by artisan'}
                      </span>
                    </div>
                    {/* Unlike text-amber-800, index.css does not remap indigo for dark mode,
                        so this must branch explicitly or it renders indigo-on-black (KNOWN_ISSUES #12). */}
                    <div className={`p-3 rounded-xl border ${dark ? 'bg-indigo-950/25 border-indigo-900/40' : 'bg-indigo-50/30 border-indigo-100/50'}`}>
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider block">Labor Charges Due</span>
                      <span className={`font-mono text-base font-black ${dark ? 'text-indigo-300' : 'text-indigo-900'}`}>
                        ₹{balance.moneyPayable.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-1">Pending approval payout</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setStatementKarigarId(kar.id)}
                      className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                    >
                      <History className="w-3.5 h-3.5" />
                      Ledger ({balance.entryCount})
                    </button>
                    <button
                      onClick={() => {
                        setScrapKarigarId(kar.id);
                        setScrapWeight(0);
                        setScrapPurity(91.6);
                        setScrapStoneIds([]);
                        setScrapError('');
                      }}
                      className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Return Scrap
                    </button>
                  </div>

                  {/* Active & Completed Orders Ledger List */}
                  <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wider">
                        Assigned Jobwork Ledger
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {activeOrders.length} Active / {completedOrders.length} Completed
                      </span>
                    </div>

                    {activeOrders.length === 0 && completedOrders.length === 0 ? (
                      <div className="p-2.5 bg-slate-50/60 rounded-xl text-center border border-slate-100">
                        <p className="text-[11px] text-slate-400 italic">No jobwork orders registered for this artisan.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {/* Active Orders */}
                        {activeOrders.map(order => (
                          <div 
                            key={order.id} 
                            className="p-2 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-lg flex justify-between items-center transition"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-black text-amber-600 bg-amber-500/10 px-1 rounded">
                                  {order.jobNo}
                                </span>
                                <span className="font-bold text-slate-800 text-[11px] truncate max-w-[120px] md:max-w-[150px]">
                                  {order.designName}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-mono uppercase">{order.category} • Due: {order.dueDate}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-mono font-bold text-amber-700">{order.goldIssued.toFixed(3)}g</p>
                              <span className="inline-block text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded uppercase tracking-wider scale-95 origin-right">
                                Active
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Completed Orders */}
                        {completedOrders.map(order => (
                          <div 
                            key={order.id} 
                            className="p-2 bg-slate-50 hover:bg-slate-100/75 border border-slate-150/70 rounded-lg flex justify-between items-center transition"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1 rounded">
                                  {order.jobNo}
                                </span>
                                <span className="font-medium text-slate-600 text-[11px] line-through decoration-slate-300 truncate max-w-[120px] md:max-w-[150px]">
                                  {order.designName}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-mono uppercase">{order.category}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-mono font-bold text-slate-500">{order.goldIssued.toFixed(3)}g</p>
                              <span className="inline-block text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded uppercase tracking-wider scale-95 origin-right">
                                Finished
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick payout triggers */}
                  {kar.laborChargesOwed > 0 && (
                    <div className="pt-2 flex justify-end">
                      {payoutConfirmId === kar.id ? (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400">Confirm ₹{kar.laborChargesOwed.toLocaleString('en-IN')}?</span>
                          <button
                            onClick={() => handlePayoutKarigar(kar.id, kar.laborChargesOwed)}
                            className="px-2.5 py-1 text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition cursor-pointer"
                          >
                            Yes, Pay
                          </button>
                          <button
                            onClick={() => setPayoutConfirmId(null)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPayoutConfirmId(kar.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" /> Clear Labor Payout
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* JOBWORK ORDERS LIST */
        <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
            <h4 className="font-sans font-bold text-slate-800 text-sm">Manufacturing Track List</h4>
            <button
              onClick={() => setIssueModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              <FilePlus className="w-4 h-4" /> Issue New Job
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-600">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 font-mono font-bold uppercase tracking-wider">
                  <th className="p-4">Order No</th>
                  <th>Artisan</th>
                  <th>Design / Category</th>
                  <th>Gold Issued (g)</th>
                  <th>Standard</th>
                  <th>Target Date</th>
                  <th>Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${dark ? 'divide-zinc-800 text-zinc-200' : 'divide-slate-100 text-slate-700'}`}>
                {jobWorks.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/30 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{order.jobNo}</td>
                    <td>{order.karigarName}</td>
                    <td>
                      <div className="font-bold text-slate-850">{order.designName}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">{order.category}</div>
                    </td>
                    <td className="font-mono text-slate-900 font-semibold">{order.goldIssued.toFixed(3)}g</td>
                    <td className="font-mono text-slate-500">{order.metalType}</td>
                    <td className="font-mono text-slate-500">{order.dueDate}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        order.receiptStatus === 'Received'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {order.receiptStatus === 'Received' ? 'Received' : STAGE_LABEL[order.stage]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {canReceiveFinishedGoods(order) && (
                        <button
                          onClick={() => handleReceiveOrderDetails(order)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition"
                        >
                          Receive Finished
                        </button>
                      )}
                      {order.wastageReview?.status === 'Pending' && (
                        <button
                          onClick={() => { setReviewJobId(order.id); setReviewNote(''); setReviewError(''); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition"
                        >
                          <AlertTriangle className="w-3 h-3" /> Review {order.wastageReview.excessFineWeight.toFixed(3)}g
                        </button>
                      )}
                      {order.wastageReview && order.wastageReview.status !== 'Pending' && (
                        <span className="text-[10px] font-mono text-slate-400" title={order.wastageReview.reviewNote}>
                          {REVIEW_STATUS_LABEL[order.wastageReview.status]}
                        </span>
                      )}
                      {order.receiptStatus === 'Received' && (
                        <div className="text-[10px] text-slate-400 font-bold">
                          Loss: {order.actualWastage?.toFixed(3)}g
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ISSUE NEW JOBWORK MODAL */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Hammer className="w-5 h-5 text-amber-500" />
                <h3 className="font-sans font-bold text-slate-900 text-base">Issue Jobwork Order</h3>
              </div>
              <button
                onClick={() => setIssueModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueWorkOrder} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Assign Karigar *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  value={selectedKarigarId}
                  onChange={(e) => setSelectedKarigarId(e.target.value)}
                >
                  <option value="">-- Choose Artisan --</option>
                  {karigars.map(k => (
                    <option key={k.id} value={k.id}>{k.name} ({k.specialty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Design Specification *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Classic Bridal Choker - Floral Filigree"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Category</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Rings">Rings</option>
                    <option value="Necklaces">Necklaces</option>
                    <option value="Earrings">Earrings</option>
                    <option value="Bangles">Bangles</option>
                    <option value="Chains">Chains</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Purity Standard</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    value={metalType}
                    onChange={(e) => setMetalType(e.target.value)}
                  >
                    <option value="Gold (22K)">Gold (22K)</option>
                    <option value="Gold (18K)">Gold (18K)</option>
                    <option value="Platinum (950)">Platinum (950)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Pure Gold Issued (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                    value={goldIssued || ''}
                    onChange={(e) => setGoldIssued(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Special Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Notes for stone selection or wire design..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none resize-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIssueModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition"
                >
                  Issue Alloy & Record Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE FINISHED WORK DIALOG OVERLAY */}
      {receivingOrderId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-sans font-bold text-slate-900 text-base">Reconcile Finished Ornament</h3>
              </div>
              <button
                onClick={() => setReceivingOrderId(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteReceipt} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-0.5">Assigned Job</span>
                <p className="font-bold text-slate-800 text-sm">
                  {jobWorks.find(o => o.id === receivingOrderId)?.designName}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Gold Issued: {jobWorks.find(o => o.id === receivingOrderId)?.goldIssued.toFixed(3)}g
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Finished Weight (g) *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                    value={finishedWeight || ''}
                    onChange={(e) => setFinishedWeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  {/* Capturing the RETURNED purity is what makes the fine-gold comparison
                      meaningful — a piece can come back at a different karat than was issued */}
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Finished Purity *</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                    value={receivedMetalType}
                    onChange={(e) => setReceivedMetalType(e.target.value)}
                  >
                    {['Gold (24K)', 'Gold (22K)', 'Gold (18K)', 'Silver (999)', 'Platinum (950)'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Wastage Cap (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                    value={allowedWastage}
                    onChange={(e) => setAllowedWastage(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-500 mb-1.5">Artisan Labor Fees (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none"
                  value={laborCharge || ''}
                  onChange={(e) => setLaborCharge(parseFloat(e.target.value) || 0)}
                />
              </div>

              {finishedWeight > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                  <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">Metal Reconciliation</span>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Actual Metal Loss:</span>
                    <span className="font-mono text-slate-800 font-bold">
                      {Math.max(0, Number(( (jobWorks.find(o => o.id === receivingOrderId)?.goldIssued || 0) - finishedWeight ).toFixed(3)))}g
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReceivingOrderId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition"
                >
                  Confirm Receipt & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Excess Wastage Review (Milestone 18) ---------- */}
      {reviewJobId && (() => {
        const jr = jobWorks.find(j => j.id === reviewJobId);
        if (!jr || !jr.wastageReview) return null;
        const rv = jr.wastageReview;
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
              dark ? 'bg-[#141416] border-zinc-800 text-zinc-100' : 'bg-white border-slate-150 text-slate-800'
            }`}>
              <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" /> Excess Wastage Review
                  </h3>
                  <p className={`text-[11px] mt-0.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    {jr.jobNo} - {jr.karigarName}
                  </p>
                </div>
                <button
                  onClick={() => { setReviewJobId(null); setReviewError(''); }}
                  className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                  aria-label="Close wastage review"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className={`rounded-xl border p-3 space-y-1.5 text-xs ${
                  dark ? 'border-rose-900/40 bg-rose-950/20' : 'border-rose-200 bg-rose-50/60'
                }`}>
                  <div className="flex justify-between"><span>Actual wastage</span><span className="font-mono font-bold">{rv.wastagePercent.toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span>Agreed cap</span><span className="font-mono">{rv.allowedPercent.toFixed(2)}%</span></div>
                  <div className={`flex justify-between font-bold border-t pt-1.5 ${dark ? 'border-rose-900/40' : 'border-rose-200'}`}>
                    <span>Excess fine gold</span>
                    <span className="font-mono text-rose-500">{rv.excessFineWeight.toFixed(3)} g</span>
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    Owner Decision Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bad casting batch, accepted by owner"
                    className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${
                      dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    value={reviewNote}
                    onChange={(e) => { setReviewNote(e.target.value); setReviewError(''); }}
                  />
                </div>

                {reviewError && (
                  <p className="text-[11px] text-rose-500 font-semibold">{reviewError}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleResolveReview('WrittenOff')}
                    className="text-xs font-bold py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black transition"
                  >
                    Shop Absorbs (Write Off)
                  </button>
                  <button
                    onClick={() => handleResolveReview('RecoveredFromKarigar')}
                    className={`text-xs font-bold py-2.5 rounded-xl border transition ${
                      dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-900' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Karigar Bears It
                  </button>
                </div>
                <p className={`text-[10px] leading-snug ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  Writing off appends a ledger entry clearing {rv.excessFineWeight.toFixed(3)}g from this artisan's balance.
                  Recovering leaves the balance untouched - they still owe the metal.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------- Scrap & Unused Stone Return (Milestone 18) ---------- */}
      {scrapKarigarId && (() => {
        const kar = karigars.find(k => k.id === scrapKarigarId);
        if (!kar) return null;
        const issuedStones = stones.filter(st => st.status === 'Issued' && st.assignedKarigarName === kar.name);
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
              dark ? 'bg-[#141416] border-zinc-800 text-zinc-100' : 'bg-white border-slate-150 text-slate-800'
            }`}>
              <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-500" /> Return Scrap & Unused Stones
                  </h3>
                  <p className={`text-[11px] mt-0.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>{kar.name}</p>
                </div>
                <button
                  onClick={() => { setScrapKarigarId(null); setScrapError(''); }}
                  className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                  aria-label="Close scrap return"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>Scrap Weight (g)</label>
                    <input
                      type="number" step="0.001" placeholder="0.000"
                      className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${
                        dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                      value={scrapWeight || ''}
                      onChange={(e) => { setScrapWeight(parseFloat(e.target.value) || 0); setScrapError(''); }}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>Scrap Purity (%)</label>
                    <input
                      type="number" step="0.1"
                      className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${
                        dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                      value={scrapPurity}
                      onChange={(e) => { setScrapPurity(parseFloat(e.target.value) || 0); setScrapError(''); }}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    Unused Stones Issued to This Artisan
                  </label>
                  {issuedStones.length === 0 ? (
                    <p className={`text-[11px] ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>No stone lots are currently issued to this artisan.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {issuedStones.map(st => (
                        <label
                          key={st.id}
                          className={`flex items-center gap-3 text-xs border rounded-lg px-3 py-2 cursor-pointer transition ${
                            scrapStoneIds.includes(st.id)
                              ? 'border-amber-500 bg-amber-50 text-amber-900'
                              : dark ? 'border-zinc-800 hover:bg-zinc-900' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-amber-500"
                            checked={scrapStoneIds.includes(st.id)}
                            onChange={(e) => {
                              setScrapError('');
                              setScrapStoneIds(prev => e.target.checked ? [...prev, st.id] : prev.filter(i => i !== st.id));
                            }}
                          />
                          <span className="flex-1">
                            <span className="font-bold block">{st.lotNo} - {st.stoneType}</span>
                            <span className={dark ? 'text-zinc-500' : 'text-slate-400'}>{st.caratWeight}ct - {st.quantity} pcs</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {scrapError && <p className="text-[11px] text-rose-500 font-semibold">{scrapError}</p>}

                <p className={`text-[10px] leading-snug ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  Returned scrap reduces the artisan's fine-gold payable; selected stone lots go back to the vault as In Vault.
                </p>
              </div>

              <div className={`p-5 border-t ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
                <button
                  onClick={handleScrapReturn}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 rounded-xl transition"
                >
                  Record Return
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ---------- Append-Only Ledger Statement (Milestone 16) ---------- */}
      {statementKarigarId && (() => {
        const kar = karigars.find(k => k.id === statementKarigarId);
        const rows = buildLedgerStatement(ledger, statementKarigarId);
        const balance = deriveKarigarBalance(ledger, statementKarigarId);
        if (!kar) return null;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`border rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden ${dark ? 'bg-[#141416] border-zinc-800 text-zinc-100' : 'bg-white border-slate-150 text-slate-800'}`}>
              <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-500" /> Karigar Ledger Statement
                  </h3>
                  <p className={`text-[11px] mt-0.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    {kar.name} · append-only, every balance is the sum of the rows below
                  </p>
                </div>
                <button
                  onClick={() => setStatementKarigarId(null)}
                  className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                  aria-label="Close ledger statement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[55vh] overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="py-14 text-center">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className={`text-xs font-bold ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>No ledger entries yet</p>
                    <p className={`text-[11px] mt-0.5 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>Issue metal or book labour and it will appear here.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-medium">
                    <thead className={`sticky top-0 ${dark ? 'bg-[#141416]' : 'bg-white'}`}>
                      <tr className={`uppercase font-mono text-[9px] border-b ${dark ? 'text-zinc-500 border-zinc-800' : 'text-slate-400 border-slate-100'}`}>
                        <th className="py-3 pl-5">Date</th>
                        <th>Entry</th>
                        <th className="text-right">Fine Wt (g)</th>
                        <th className="text-right">Money (₹)</th>
                        <th className="text-right">Bal. Fine</th>
                        <th className="text-right pr-5">Bal. Money</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${dark ? 'divide-zinc-800 text-zinc-200' : 'divide-slate-100 text-slate-700'}`}>
                      {rows.map(r => (
                        <tr key={r.id} className={dark ? 'hover:bg-zinc-900/50' : 'hover:bg-slate-50/60'}>
                          <td className={`py-3 pl-5 font-mono whitespace-nowrap ${dark ? 'text-zinc-500' : 'text-slate-500'}`}>{r.date}</td>
                          <td>
                            <span className="font-bold block">{LEDGER_ENTRY_LABEL[r.type]}</span>
                            <span className={`text-[10px] ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>{r.narration}</span>
                            {r.grossWeight !== undefined && r.purityPercent !== undefined && (
                              <span className={`text-[10px] block font-mono ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                                {r.grossWeight.toFixed(3)}g × {r.purityPercent}%
                              </span>
                            )}
                          </td>
                          <td className={`text-right font-mono ${(r.fineWeightDelta || 0) < 0 ? 'text-emerald-500' : (dark ? 'text-zinc-200' : 'text-slate-800')}`}>
                            {r.fineWeightDelta ? `${r.fineWeightDelta > 0 ? '+' : ''}${r.fineWeightDelta.toFixed(3)}` : '—'}
                          </td>
                          <td className={`text-right font-mono ${(r.moneyDelta || 0) < 0 ? 'text-emerald-500' : (dark ? 'text-zinc-200' : 'text-slate-800')}`}>
                            {r.moneyDelta ? `${r.moneyDelta > 0 ? '+' : ''}${r.moneyDelta.toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="text-right font-mono font-bold">{r.runningFineWeight.toFixed(3)}</td>
                          <td className="text-right font-mono font-bold pr-5">{r.runningMoney.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className={`p-5 border-t grid grid-cols-2 gap-4 ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
                <div className={`p-3 rounded-xl border ${dark ? 'bg-amber-950/25 border-amber-900/40' : 'bg-amber-50/50 border-amber-100'}`}>
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider block ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>Closing Fine Gold Payable</span>
                  <span className={`font-mono text-base font-black ${dark ? 'text-amber-400' : 'text-amber-800'}`}>{balance.fineWeightPayable.toFixed(3)} g</span>
                </div>
                <div className={`p-3 rounded-xl border ${dark ? 'bg-indigo-950/25 border-indigo-900/40' : 'bg-indigo-50/40 border-indigo-100'}`}>
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider block ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>Closing Labour Payable</span>
                  <span className={`font-mono text-base font-black ${dark ? 'text-indigo-300' : 'text-indigo-900'}`}>₹{balance.moneyPayable.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
