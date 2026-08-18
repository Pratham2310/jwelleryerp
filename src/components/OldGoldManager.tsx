import React, { useState } from 'react';
import {
  Coins,
  Plus,
  Search,
  X,
  Scale,
  Filter,
  FileCheck,
  Printer,
  Eye,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import { OldGoldVoucher, OldGoldSettlementMode, Customer, MetalRate } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useHardware } from '../contexts/HardwareContext';
import {
  calculateOldGoldValuation,
  validateOldGoldValuation,
  PURITY_PRESETS,
} from '../lib/oldGoldValuation';
import { isPanRequired, isValidPanFormat, PAN_THRESHOLD } from '../lib/statutoryChecks';
import {
  canTransitionLot,
  nextLotStatuses,
  summariseVault,
  validateRecoveredWeight,
  LOT_STATUS_LABEL,
  ALL_LOT_STATUSES,
} from '../lib/oldGoldVault';
import type { OldGoldLotStatus } from '../types';

interface OldGoldManagerProps {
  vouchers: OldGoldVoucher[];
  setVouchers: React.Dispatch<React.SetStateAction<OldGoldVoucher[]>>;
  customers: Customer[];
  metalRates: MetalRate[];
}

/**
 * Old Gold buyback voucher series. A purchase transaction, so it gets its own
 * consecutive series and never touches the sales invoice numbering (PRD §8.3 / D-10).
 */
function nextVoucherNumber(): string {
  const year = new Date().getFullYear();
  const key = `stitch_old_gold_seq_${year}`;
  const next = Number(localStorage.getItem(key) || '300') + 1;
  localStorage.setItem(key, String(next));
  return `OGV-${year}-${next}`;
}

const SETTLEMENT_LABEL: Record<OldGoldSettlementMode, string> = {
  CASH: 'Cash Paid Out',
  BANK: 'Bank Transfer',
  ADJUSTED_AGAINST_INVOICE: 'Adjusted Against Sale',
};

const LOT_STATUS_BADGE: Record<OldGoldLotStatus, string> = {
  InSafe: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  SentForMelting: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Melted: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50',
  FineGoldStock: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50',
  ResaleAsIs: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50',
};

export default function OldGoldManager({ vouchers, setVouchers, customers, metalRates }: OldGoldManagerProps) {
  const { theme } = useTheme();
  const { registerWeightField } = useHardware();
  const dark = theme === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OldGoldLotStatus>('All');
  const [isVoucherModalOpen, setVoucherModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<OldGoldVoucher | null>(null);
  const [formError, setFormError] = useState('');

  // Vault lifecycle (Milestone 15) — moving a lot on, and capturing what the refiner returned
  const [lotToAdvance, setLotToAdvance] = useState<OldGoldVoucher | null>(null);
  const [targetStatus, setTargetStatus] = useState<OldGoldLotStatus | ''>('');
  const [recoveredWeightInput, setRecoveredWeightInput] = useState('');
  const [advanceError, setAdvanceError] = useState('');

  const vault = summariseVault(vouchers);

  const handleAdvanceLot = () => {
    if (!lotToAdvance || !targetStatus) return;
    if (!canTransitionLot(lotToAdvance.status, targetStatus)) {
      setAdvanceError(`A lot cannot move from ${LOT_STATUS_LABEL[lotToAdvance.status]} to ${LOT_STATUS_LABEL[targetStatus]}.`);
      return;
    }

    // Recovered fine weight is captured exactly once, on the melt confirmation — this is why
    // InSafe -> FineGoldStock is not a legal shortcut.
    let recovered: number | undefined;
    if (targetStatus === 'Melted') {
      const parsed = parseFloat(recoveredWeightInput);
      const err = validateRecoveredWeight(lotToAdvance, parsed);
      if (err) {
        setAdvanceError(err);
        return;
      }
      recovered = Number(parsed.toFixed(3));
    }

    setVouchers(prev => prev.map(v => v.id === lotToAdvance.id
      ? {
          ...v,
          status: targetStatus,
          ...(recovered !== undefined
            ? { recoveredFineWeight: recovered, meltedOn: new Date().toISOString().split('T')[0] }
            : {}),
        }
      : v));

    setLotToAdvance(null);
    setTargetStatus('');
    setRecoveredWeightInput('');
    setAdvanceError('');
  };

  // A buy-back rate is deliberately BELOW the prevailing sale rate (PRD §4.2/§8.2 step 4).
  // Seed it from the live 22K rate less a typical margin so staff aren't typing it blind.
  const sale22k = metalRates.find(r => r.metalType.includes('22K'))?.ratePerGram ?? 6650;
  const suggestedBuybackRate = Math.round(sale22k * 0.92);

  const emptyForm = {
    customerId: '',
    customerName: '',
    customerPhone: '',
    panNumber: '',
    itemDescription: '',
    grossWeight: 0,
    claimedPurityPercent: 0,
    testedPurityPercent: 91.6,
    meltingLossPercent: 3,
    buybackRatePerGram: suggestedBuybackRate,
    settlementMode: 'CASH' as OldGoldSettlementMode,
    linkedInvoiceNumber: '',
  };
  const [form, setForm] = useState(emptyForm);

  // Live valuation preview — PRD §8.2 step 5 requires showing the customer the
  // computed value for confirmation before the voucher is finalised.
  const valuation = calculateOldGoldValuation({
    grossWeight: form.grossWeight,
    testedPurityPercent: form.testedPurityPercent,
    meltingLossPercent: form.meltingLossPercent,
    buybackRatePerGram: form.buybackRatePerGram,
  });

  const panRequired = isPanRequired(valuation.buybackValue);

  const openNewVoucher = () => {
    setForm({ ...emptyForm, buybackRatePerGram: suggestedBuybackRate });
    setFormError('');
    setVoucherModalOpen(true);
  };

  const handleSelectCustomer = (id: string) => {
    const c = customers.find(x => x.id === id);
    setForm(prev => ({
      ...prev,
      customerId: id,
      customerName: c ? c.name : '',
      customerPhone: c ? c.phone : '',
    }));
  };

  const handleSaveVoucher = () => {
    const valuationError = validateOldGoldValuation(form);
    if (valuationError) {
      setFormError(valuationError);
      return;
    }
    if (!form.customerName.trim()) {
      setFormError('Old gold intake is a purchase — record who the shop is buying from (PRD §8.4).');
      return;
    }
    if (!form.itemDescription.trim()) {
      setFormError('Describe the item received, so the lot can be identified in the safe.');
      return;
    }
    // The PAN threshold applies to old-gold purchases just as it does to sales
    if (panRequired && !isValidPanFormat(form.panNumber)) {
      setFormError(`Buyback value is ₹${PAN_THRESHOLD.toLocaleString('en-IN')} or above — capture a valid PAN (ABCDE1234F).`);
      return;
    }
    if (form.settlementMode === 'ADJUSTED_AGAINST_INVOICE' && !form.linkedInvoiceNumber.trim()) {
      setFormError('Reference the sale invoice this buyback is being adjusted against.');
      return;
    }

    const voucher: OldGoldVoucher = {
      id: `ogv-${Date.now()}`,
      voucherNumber: nextVoucherNumber(),
      date: new Date().toISOString().split('T')[0],
      customerId: form.customerId || undefined,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim() || 'N/A',
      panNumber: form.panNumber.trim().toUpperCase() || undefined,
      itemDescription: form.itemDescription.trim(),
      grossWeight: valuation.grossWeight,
      // What the customer said it was, for the claimed-vs-tested gap (Milestone 53).
      // Left undefined when unrecorded rather than defaulted to the tested figure —
      // an assumed match would make the gap look smaller than it is.
      claimedPurityPercent: form.claimedPurityPercent > 0 ? form.claimedPurityPercent : undefined,
      testedPurityPercent: form.testedPurityPercent,
      meltingLossPercent: form.meltingLossPercent,
      netPayableWeight: valuation.netPayableWeight,
      buybackRatePerGram: form.buybackRatePerGram,
      buybackValue: valuation.buybackValue,
      settlementMode: form.settlementMode,
      linkedInvoiceNumber: form.linkedInvoiceNumber.trim() || undefined,
      // Every received lot lands in the safe first (PRD §8.2 step 7); Milestone 15 moves it on.
      status: 'InSafe',
    };

    setVouchers(prev => [voucher, ...prev]);
    setVoucherModalOpen(false);
    setSelectedVoucher(voucher);
  };

  const filtered = vouchers.filter(v => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      v.voucherNumber.toLowerCase().includes(q) ||
      v.customerName.toLowerCase().includes(q) ||
      v.itemDescription.toLowerCase().includes(q) ||
      v.customerPhone.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalPaidOut = vouchers.reduce((s, v) => s + v.buybackValue, 0);
  const totalGrossHeld = vouchers.reduce((s, v) => s + v.grossWeight, 0);
  const totalNetPayable = vouchers.reduce((s, v) => s + v.netPayableWeight, 0);

  const cardCls = dark ? 'bg-[#141416] border-zinc-800 text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const inputCls = dark
    ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
    : 'bg-white border-slate-200 text-slate-900';

  const labelCls = `block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${mutedCls}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`border p-6 rounded-2xl shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 uppercase tracking-wider font-mono">
                Purchase Voucher
              </span>
              <span className={`text-[10px] font-mono ${mutedCls}`}>VAULT-OG-01</span>
            </div>
            <h2 className="font-sans font-black text-2xl tracking-tight">Old Gold Buyback</h2>
            <p className={`text-sm mt-0.5 ${dark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Purity testing, melt valuation and outright purchase — settled separately from the sale (PRD §8.3).
            </p>
          </div>
          <button
            onClick={openNewVoucher}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition shrink-0"
          >
            <Plus className="w-4.5 h-4.5" /> New Buyback Voucher
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`border p-5 rounded-2xl shadow-sm ${cardCls}`}>
          <p className={`text-[10px] uppercase font-bold tracking-wider font-mono mb-1 ${mutedCls}`}>Vouchers Raised</p>
          <p className="text-2xl font-black font-mono">{vouchers.length}</p>
          <p className={`text-[10px] font-mono mt-1 ${mutedCls}`}>₹{totalPaidOut.toLocaleString('en-IN')} paid out lifetime</p>
        </div>
        <div className={`border p-5 rounded-2xl shadow-sm ${cardCls}`}>
          <p className={`text-[10px] uppercase font-bold tracking-wider font-mono mb-1 ${mutedCls}`}>Gross Weight Received</p>
          <p className="text-2xl font-black font-mono">{totalGrossHeld.toFixed(3)} <span className={`text-xs font-medium ${mutedCls}`}>g</span></p>
          <p className={`text-[10px] font-mono mt-1 ${mutedCls}`}>{totalNetPayable.toFixed(3)}g net payable</p>
        </div>
        <div className={`border p-5 rounded-2xl shadow-sm ${cardCls}`}>
          <p className={`text-[10px] uppercase font-bold tracking-wider font-mono mb-1 ${mutedCls}`}>Metal Held In Vault</p>
          <p className="text-2xl font-black font-mono text-amber-500">{vault.grossWeightHeld.toFixed(3)} <span className={`text-xs font-medium ${mutedCls}`}>g</span></p>
          <p className={`text-[10px] font-mono mt-1 ${mutedCls}`}>
            {vault.lotsInSafe} in safe · {vault.lotsAtRefiner} at refiner · {vault.lotsMelted} melted
          </p>
        </div>
        <div className={`border p-5 rounded-2xl shadow-sm ${cardCls}`}>
          <p className={`text-[10px] uppercase font-bold tracking-wider font-mono mb-1 ${mutedCls}`}>Fine Gold Recovered</p>
          <p className="text-2xl font-black font-mono">{vault.recoveredFineWeight.toFixed(3)} <span className={`text-xs font-medium ${mutedCls}`}>g</span></p>
          {/* A persistently negative variance means the melting-loss deduction is set too low */}
          {vault.refiningVariance !== 0 ? (
            <p className={`text-[10px] font-mono mt-1 font-bold ${vault.refiningVariance < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {vault.refiningVariance > 0 ? '+' : ''}{vault.refiningVariance.toFixed(3)}g vs melt estimate
            </p>
          ) : (
            <p className={`text-[10px] font-mono mt-1 ${mutedCls}`}>no refining variance yet</p>
          )}
        </div>
      </div>

      {/* Capital tied up in old gold not yet converted */}
      {vault.capitalDeployed > 0 && (
        <div className={`border rounded-2xl p-4 flex items-center gap-3 text-xs ${
          dark ? 'border-amber-900/40 bg-amber-950/20 text-amber-300' : 'border-amber-200 bg-amber-50/60 text-amber-900'
        }`}>
          <TrendingDown className="w-4 h-4 shrink-0" />
          <span>
            <span className="font-bold">₹{vault.capitalDeployed.toLocaleString('en-IN')}</span> of capital is tied up in{' '}
            {vault.lotsInSafe + vault.lotsAtRefiner + vault.lotsMelted} old-gold lot(s) not yet converted to sellable stock
            ({vault.expectedFineWeight.toFixed(3)}g fine gold expected).
          </span>
        </div>
      )}

      {/* Register */}
      <div className={`border p-5 rounded-2xl shadow-sm space-y-4 ${cardCls}`}>
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Old Gold Purchase Register</h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>Every lot received, its tested purity, and what the shop paid for it.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className={`absolute left-3 top-2.5 h-4 w-4 ${mutedCls}`} />
            <input
              type="text"
              placeholder="Search voucher, customer, item..."
              className={`w-full pl-9 pr-4 py-2 text-xs border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Vault stage filter (Milestone 15) */}
        <div className={`flex flex-wrap items-center gap-1.5 pt-3 border-t ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
          <span className={`text-[10px] uppercase font-bold font-mono tracking-wider mr-2 flex items-center gap-1 ${mutedCls}`}>
            <Filter className="w-3 h-3" /> Vault Stage:
          </span>
          {(['All', ...ALL_LOT_STATUSES] as ('All' | OldGoldLotStatus)[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition border ${
                statusFilter === s
                  ? 'bg-amber-500 text-black font-semibold border-amber-500'
                  : dark
                    ? 'bg-zinc-950 text-zinc-400 hover:bg-zinc-900 border-zinc-800'
                    : 'bg-white text-slate-700 hover:bg-amber-50/50 border-slate-200'
              }`}
            >
              {s === 'All' ? 'All' : LOT_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className={`uppercase font-mono text-[9px] border-b ${dark ? 'text-zinc-500 border-zinc-800' : 'text-slate-400 border-slate-100'}`}>
                <th className="py-3">Voucher No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Item</th>
                <th className="text-right">Gross</th>
                <th className="text-center">Purity</th>
                <th className="text-right">Net Payable</th>
                <th className="text-right">Value Paid</th>
                <th className="text-center">Settlement</th>
                <th className="text-center">Vault Stage</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-zinc-800 text-zinc-200' : 'divide-slate-100 text-slate-700'}`}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`py-10 text-center font-mono ${mutedCls}`}>
                    {vouchers.length === 0
                      ? 'No old gold received yet. Raise a buyback voucher when a customer brings in old jewellery.'
                      : 'No vouchers match that search.'}
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className={dark ? 'hover:bg-zinc-900/40' : 'hover:bg-slate-50/60'}>
                    <td className="py-3.5 font-mono font-bold text-amber-500">{v.voucherNumber}</td>
                    <td className={`font-mono ${mutedCls}`}>{v.date}</td>
                    <td className="font-bold">{v.customerName}</td>
                    <td className={`max-w-[180px] truncate ${mutedCls}`}>{v.itemDescription}</td>
                    <td className="text-right font-mono">{v.grossWeight.toFixed(3)}g</td>
                    <td className="text-center font-mono">{v.testedPurityPercent}%</td>
                    <td className="text-right font-mono font-bold">{v.netPayableWeight.toFixed(3)}g</td>
                    <td className="text-right font-mono font-bold">₹{v.buybackValue.toLocaleString('en-IN')}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        v.settlementMode === 'ADJUSTED_AGAINST_INVOICE'
                          ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50'
                          : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                      }`}>
                        {SETTLEMENT_LABEL[v.settlementMode]}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${LOT_STATUS_BADGE[v.status]}`}>
                        {LOT_STATUS_LABEL[v.status]}
                      </span>
                      {v.recoveredFineWeight !== undefined && (
                        <span className={`block text-[10px] font-mono mt-0.5 ${mutedCls}`}>
                          {v.recoveredFineWeight.toFixed(3)}g recovered
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedVoucher(v)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg transition"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                        {nextLotStatuses(v.status).length > 0 && (
                          <button
                            onClick={() => {
                              setLotToAdvance(v);
                              setTargetStatus('');
                              setRecoveredWeightInput(v.netPayableWeight.toFixed(3));
                              setAdvanceError('');
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border rounded-lg transition ${
                              dark
                                ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Move
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Move Lot Through the Vault (Milestone 15) ---------- */}
      {lotToAdvance && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2"><Scale className="w-4 h-4 text-amber-500" /> Move Lot Through Vault</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {lotToAdvance.voucherNumber} · currently {LOT_STATUS_LABEL[lotToAdvance.status]}
                </p>
              </div>
              <button
                onClick={() => { setLotToAdvance(null); setAdvanceError(''); }}
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Close move lot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Move To</label>
                <div className="space-y-2">
                  {nextLotStatuses(lotToAdvance.status).map(s => (
                    <button
                      key={s}
                      onClick={() => { setTargetStatus(s); setAdvanceError(''); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-bold transition ${
                        targetStatus === s
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : dark
                            ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {LOT_STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recovered weight is captured exactly once, on the melt confirmation */}
              {targetStatus === 'Melted' && (
                <div>
                  <label className={labelCls}>Fine Gold Recovered From Refiner (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                    value={recoveredWeightInput}
                    onChange={(e) => { setRecoveredWeightInput(e.target.value); setAdvanceError(''); }}
                  />
                  <p className={`text-[10px] mt-1 ${mutedCls}`}>
                    Melt valuation predicted {lotToAdvance.netPayableWeight.toFixed(3)}g. Recording what actually came
                    back is what reveals whether the shop's melting-loss deduction is set correctly.
                  </p>
                </div>
              )}

              {advanceError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-500 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {advanceError}
                </div>
              )}

              <button
                onClick={handleAdvanceLot}
                disabled={!targetStatus}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs py-2.5 rounded-xl transition"
              >
                Confirm Movement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- New Voucher Modal ---------- */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2"><Scale className="w-4 h-4 text-amber-500" /> Old Gold Purchase Voucher</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>Receive → test purity → deduct melting loss → value → settle (PRD §8.2).</p>
              </div>
              <button
                onClick={() => setVoucherModalOpen(false)}
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}
                aria-label="Close voucher"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[65vh] overflow-y-auto">
              {/* Left: intake + testing */}
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Selling Customer (KYC required — this is a purchase)</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                  >
                    <option value="">-- Walk-in seller (enter manually) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Seller Name</label>
                    <input
                      type="text"
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                      value={form.customerName}
                      onChange={(e) => setForm(p => ({ ...p, customerName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input
                      type="text"
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                      value={form.customerPhone}
                      onChange={(e) => setForm(p => ({ ...p, customerPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Item Description (as received)</label>
                  <input
                    type="text"
                    placeholder="e.g. Old 21KT chain, worn clasp"
                    className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                    value={form.itemDescription}
                    onChange={(e) => setForm(p => ({ ...p, itemDescription: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Gross Weight Received (g)</label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                      value={form.grossWeight || ''}
                      onChange={(e) => setForm(p => ({ ...p, grossWeight: parseFloat(e.target.value) || 0 }))}
                      onFocus={() => registerWeightField(
                        'Old gold — gross weight received',
                        (grams) => setForm(p => ({ ...p, grossWeight: grams }))
                      )}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Melting / Refining Loss (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                      value={form.meltingLossPercent}
                      onChange={(e) => setForm(p => ({ ...p, meltingLossPercent: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Claimed Purity (%) — optional</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="What the customer says it is"
                    className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                    value={form.claimedPurityPercent || ''}
                    onChange={(e) => setForm(p => ({ ...p, claimedPurityPercent: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className={`text-[10px] mt-1 ${mutedCls}`}>
                    Recorded before assay. Leave blank if not stated — the buyback report excludes
                    unclaimed lots rather than assuming they agree with the test.
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Tested Purity — Tunch (%)</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PURITY_PRESETS.map(preset => (
                      <button
                        key={preset.millesimal}
                        onClick={() => setForm(p => ({ ...p, testedPurityPercent: preset.percent }))}
                        className={`text-[10px] px-2 py-1 rounded-lg border font-bold transition ${
                          form.testedPurityPercent === preset.percent
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : dark
                              ? 'border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                    value={form.testedPurityPercent}
                    onChange={(e) => setForm(p => ({ ...p, testedPurityPercent: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className={`text-[10px] mt-1 ${mutedCls}`}>Enter as a percentage (87.5), not a millesimal touch value (875).</p>
                </div>
              </div>

              {/* Right: valuation + settlement */}
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Buy-back Rate (₹/g)</label>
                  <input
                    type="number"
                    className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                    value={form.buybackRatePerGram || ''}
                    onChange={(e) => setForm(p => ({ ...p, buybackRatePerGram: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className={`text-[10px] mt-1 ${mutedCls}`}>
                    Live 22K sale rate is ₹{sale22k.toLocaleString('en-IN')}/g — buy-back is normally set below it (PRD §4.2).
                  </p>
                </div>

                {/* Customer-facing valuation breakdown (PRD §8.2 step 5) */}
                <div className={`rounded-xl border p-4 space-y-2 text-xs ${
                  dark ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-200 bg-amber-50/60'
                }`}>
                  <p className="font-bold uppercase tracking-wider font-mono text-[10px] text-amber-600">Valuation Shown to Customer</p>
                  <div className="flex justify-between"><span>Gross weight received</span><span className="font-mono">{valuation.grossWeight.toFixed(3)} g</span></div>
                  <div className="flex justify-between"><span>Pure content @ {form.testedPurityPercent}%</span><span className="font-mono">{valuation.pureContentWeight.toFixed(3)} g</span></div>
                  <div className="flex justify-between"><span>Less melting loss @ {form.meltingLossPercent}%</span><span className="font-mono text-rose-500">−{valuation.meltingLossWeight.toFixed(3)} g</span></div>
                  <div className={`flex justify-between font-bold border-t pt-2 ${dark ? 'border-amber-900/40' : 'border-amber-200'}`}>
                    <span>Net payable weight</span><span className="font-mono">{valuation.netPayableWeight.toFixed(3)} g</span>
                  </div>
                  <div className="flex justify-between"><span>× Buy-back rate</span><span className="font-mono">₹{form.buybackRatePerGram.toLocaleString('en-IN')}/g</span></div>
                  <div className={`flex justify-between font-black text-sm border-t pt-2 ${dark ? 'border-amber-900/40' : 'border-amber-200'}`}>
                    <span>Buyback value payable</span>
                    <span className="font-mono text-amber-600">₹{valuation.buybackValue.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Settlement</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(['CASH', 'BANK', 'ADJUSTED_AGAINST_INVOICE'] as OldGoldSettlementMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setForm(p => ({ ...p, settlementMode: mode }))}
                        className={`text-xs py-2 px-3 rounded-lg border text-left font-bold transition ${
                          form.settlementMode === mode
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : dark
                              ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {SETTLEMENT_LABEL[mode]}
                      </button>
                    ))}
                  </div>
                </div>

                {form.settlementMode === 'ADJUSTED_AGAINST_INVOICE' && (
                  <div>
                    <label className={labelCls}>Linked Sale Invoice No.</label>
                    <input
                      type="text"
                      placeholder="INV-2026-1021"
                      className={`w-full text-xs font-mono px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                      value={form.linkedInvoiceNumber}
                      onChange={(e) => setForm(p => ({ ...p, linkedInvoiceNumber: e.target.value }))}
                    />
                    <p className={`text-[10px] mt-1 ${mutedCls}`}>
                      Netted at settlement only — this never reduces the sale's taxable value (PRD §8.3).
                    </p>
                  </div>
                )}

                {panRequired && (
                  <div>
                    <label className={labelCls}>Seller PAN (buyback ≥ ₹{PAN_THRESHOLD.toLocaleString('en-IN')})</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      className={`w-full text-xs font-mono uppercase px-3 py-2 rounded-lg border focus:outline-none focus:border-amber-500 ${inputCls}`}
                      value={form.panNumber}
                      onChange={(e) => setForm(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className={`p-5 border-t space-y-3 ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
              {formError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-500 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
              <button
                onClick={handleSaveVoucher}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs py-2.5 rounded-xl transition"
              >
                Confirm Buyback & Receive Into Safe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Voucher Detail / Print ---------- */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-150 p-8 rounded-3xl shadow-2xl max-w-2xl w-full relative my-8 text-slate-800">
            <div className="absolute top-6 right-6 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-lg transition"
              >
                <Printer className="w-4 h-4" /> Print Voucher
              </button>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg transition"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 pt-6 print:pt-0" id="print-area">
              <div className="text-center border-b pb-4 space-y-1">
                <h1 className="font-sans font-black text-2xl tracking-wider text-slate-900">AURUM JEWELLERY HOUSE</h1>
                <p className="text-xs text-slate-500">102, Gold Palace Plaza, Zaveri Bazaar, Mumbai, MH - 400002</p>
                <p className="text-[10px] font-mono text-slate-400">Tel: +91 22 2240 8710 | GSTIN: 27AACCS9948H1Z1</p>
                <h2 className="text-xs uppercase font-bold py-1 tracking-widest rounded mt-3 bg-amber-100 text-amber-900 border border-amber-300">
                  Old Gold Purchase Voucher
                </h2>
              </div>

              <div className="grid grid-cols-2 text-xs font-medium text-slate-600 gap-y-2">
                <div>
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Voucher Number:</span></p>
                  <p className="font-mono font-bold text-slate-900 text-sm">{selectedVoucher.voucherNumber}</p>
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Date:</span></p>
                  <p className="font-mono text-slate-900">{selectedVoucher.date}</p>
                </div>
                <div>
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Received From:</span></p>
                  <p className="font-bold text-slate-900">{selectedVoucher.customerName}</p>
                  <p className="font-mono text-[11px]">{selectedVoucher.customerPhone}</p>
                  {selectedVoucher.panNumber && (
                    <p className="font-mono text-[11px]">PAN: {selectedVoucher.panNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p><span className="text-slate-400 uppercase tracking-wide text-[10px]">Settlement:</span></p>
                  <p className="font-bold text-slate-900">{SETTLEMENT_LABEL[selectedVoucher.settlementMode]}</p>
                  {selectedVoucher.linkedInvoiceNumber && (
                    <p className="font-mono text-[11px]">vs {selectedVoucher.linkedInvoiceNumber}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-200 py-4">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-mono mb-1">Item Received</p>
                <p className="font-bold text-slate-900 text-sm">{selectedVoucher.itemDescription}</p>
              </div>

              <div className="w-full md:w-2/3 ml-auto text-xs font-medium space-y-2">
                <div className="flex justify-between text-slate-500">
                  <span>Gross Weight Received:</span>
                  <span className="font-mono">{selectedVoucher.grossWeight.toFixed(3)} g</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tested Purity (Tunch):</span>
                  <span className="font-mono">{selectedVoucher.testedPurityPercent}%</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Less Melting / Refining Loss:</span>
                  <span className="font-mono">{selectedVoucher.meltingLossPercent}%</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t pt-2">
                  <span>Net Payable Weight:</span>
                  <span className="font-mono">{selectedVoucher.netPayableWeight.toFixed(3)} g</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Buy-back Rate Applied:</span>
                  <span className="font-mono">₹{selectedVoucher.buybackRatePerGram.toLocaleString('en-IN')}/g</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 border-t-2 pt-2 text-sm bg-amber-50 px-2 py-1.5 rounded">
                  <span>Buyback Value Paid:</span>
                  <span className="font-mono text-amber-800">₹{selectedVoucher.buybackValue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 text-[10px] text-slate-500 space-y-1.5">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <FileCheck className="w-4 h-4 text-amber-600" /> Purchase Declaration
                </p>
                <p>
                  The seller confirms lawful ownership of the item described above and agrees the tested purity and
                  valuation shown. This is a purchase of second-hand goods from an unregistered individual and carries
                  no forward-charge GST from the seller (PRD §8.3). Weight and purity were verified in the seller's presence.
                </p>
              </div>

              <div className="grid grid-cols-2 pt-10 text-center text-[10px] font-semibold text-slate-400">
                <div><p className="border-t border-slate-200 pt-2 w-32 mx-auto">Seller Signature</p></div>
                <div><p className="border-t border-slate-200 pt-2 w-32 mx-auto">Authorized Signatory</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
