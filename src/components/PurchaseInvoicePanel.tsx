import { useState } from 'react';
import { FileText, Plus, X, AlertTriangle, Repeat } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { PurchaseInvoice, GoodsReceipt, Supplier, Branch } from '../types';
import {
  nextPurchaseInvoiceRef,
  purchaseSupplyType,
  computePurchaseTax,
  reverseChargeLegs,
  assessItcEligibility,
  validatePurchaseInvoice,
  summarisePurchaseRegister,
  unbilledReceiptIds,
} from '../lib/purchaseInvoice';
import { selectableSuppliers } from '../lib/supplier';

interface PurchaseInvoicePanelProps {
  invoices: PurchaseInvoice[];
  setInvoices: React.Dispatch<React.SetStateAction<PurchaseInvoice[]>>;
  goodsReceipts: GoodsReceipt[];
  suppliers: Supplier[];
  activeBranch: Branch | null;
}

export default function PurchaseInvoicePanel({
  invoices, setInvoices, goodsReceipts, suppliers, activeBranch,
}: PurchaseInvoicePanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isOpen, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [grnId, setGrnId] = useState('');
  const [taxableValue, setTaxableValue] = useState('');
  const [gstRatePercent, setGstRatePercent] = useState('3');
  const [isRcm, setRcm] = useState(false);
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summarisePurchaseRegister(invoices);
  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? 'Unknown supplier';
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const selected = suppliers.find(s => s.id === supplierId) ?? null;
  const supplyType = purchaseSupplyType(selected, activeBranch);
  const preview = computePurchaseTax(Number(taxableValue) || 0, Number(gstRatePercent) || 0, supplyType, isRcm);
  const itc = assessItcEligibility(selected, isRcm);
  const legs = isRcm ? reverseChargeLegs(preview.totalTax) : null;

  const unbilled = unbilledReceiptIds(goodsReceipts.map(g => g.id), invoices);
  const billableReceipts = goodsReceipts.filter(g =>
    unbilled.includes(g.id) && (!supplierId || g.supplierId === supplierId));

  const reset = () => {
    setSupplierId(''); setSupplierInvoiceNo(''); setGrnId('');
    setSupplierInvoiceDate(new Date().toISOString().slice(0, 10));
    setTaxableValue(''); setGstRatePercent('3'); setRcm(false); setError('');
  };

  const handleSave = () => {
    const draft = {
      supplierId, supplierInvoiceNo, supplierInvoiceDate,
      goodsReceiptId: grnId || undefined,
      taxableValue: Number(taxableValue), gstRatePercent: Number(gstRatePercent),
      isReverseCharge: isRcm, branchId: activeBranch?.id,
    };
    const err = validatePurchaseInvoice(draft, invoices, selected);
    if (err) { setError(err); return; }

    const tax = computePurchaseTax(draft.taxableValue, draft.gstRatePercent, supplyType, isRcm);
    const eligibility = assessItcEligibility(selected, isRcm);

    setInvoices(prev => [{
      ...draft,
      id: `pinv-${Date.now()}`,
      internalRef: nextPurchaseInvoiceRef(prev, supplierInvoiceDate),
      supplierInvoiceNo: supplierInvoiceNo.trim(),
      cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst,
      totalTax: tax.totalTax, taxableValue: tax.taxableValue,
      invoiceTotal: tax.invoiceTotal,
      itcEligible: eligibility.eligible,
      itcIneligibleReason: eligibility.reason ?? undefined,
      postedOn: new Date().toISOString().slice(0, 10),
    } as PurchaseInvoice, ...prev]);
    reset();
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> Purchase Invoices & Input Tax Credit
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Output tax has existed since the Tax Master; input tax has not. A return built
              without this side declares everything collected and nothing paid.
            </p>
          </div>
          <button
            onClick={() => { reset(); setOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Book Supplier Invoice
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Invoices Booked', value: String(summary.invoiceCount) },
            { label: 'Taxable Value', value: money(summary.totalTaxableValue) },
            { label: 'Claimable ITC', value: money(summary.claimableItc), accent: true },
            { label: 'Reverse-Charge Liability', value: money(summary.reverseChargeLiability), warn: summary.reverseChargeLiability > 0 },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.warn ? 'border-rose-500/40 bg-rose-500/5'
                : kpi.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                kpi.warn ? 'text-rose-500' : kpi.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
              }`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {summary.reverseChargeInvoices > 0 && (
          <p className={`mt-3 text-[11px] flex items-start gap-1.5 ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
            <Repeat className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {summary.reverseChargeInvoices} reverse-charge invoice(s): the shop owes{' '}
            {money(summary.reverseChargeLiability)} of tax directly to the government and claims the
            same amount back. Both legs are recorded — they net to zero in cash, but the liability
            must still be declared.
          </p>
        )}
        {unbilled.length > 0 && (
          <p className={`mt-2 text-[11px] ${mutedCls}`}>
            {unbilled.length} goods receipt(s) not yet billed by the supplier — an unbilled receipt
            is stock held against an unbooked liability.
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Purchase Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Ref</th>
                <th className="px-4">Supplier</th>
                <th className="px-4">Their Invoice</th>
                <th className="px-4 text-right">Taxable</th>
                <th className="px-4 text-right">CGST</th>
                <th className="px-4 text-right">SGST</th>
                <th className="px-4 text-right">IGST</th>
                <th className="px-4 text-center">ITC</th>
                <th className="px-4 text-right">Payable</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {invoices.map(p => (
                <tr key={p.id} className={`border-b last:border-0 ${rowCls}`}>
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-500">
                    {p.internalRef}
                    {p.isReverseCharge && (
                      <span className="block text-[9px] font-bold text-rose-500">REVERSE CHARGE</span>
                    )}
                  </td>
                  <td className="px-4 font-bold">{supplierName(p.supplierId)}</td>
                  <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>
                    {p.supplierInvoiceNo}
                    <span className="block">{p.supplierInvoiceDate}</span>
                  </td>
                  <td className="px-4 text-right font-mono">{money(p.taxableValue)}</td>
                  <td className={`px-4 text-right font-mono ${p.cgst ? '' : mutedCls}`}>{p.cgst ? money(p.cgst) : '—'}</td>
                  <td className={`px-4 text-right font-mono ${p.sgst ? '' : mutedCls}`}>{p.sgst ? money(p.sgst) : '—'}</td>
                  <td className={`px-4 text-right font-mono ${p.igst ? '' : mutedCls}`}>{p.igst ? money(p.igst) : '—'}</td>
                  <td className="px-4 text-center">
                    {p.itcEligible ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                        {money(p.totalTax)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-500/10 text-slate-600 dark:text-zinc-400 border-slate-500/30"
                        title={p.itcIneligibleReason}>
                        Not claimable
                      </span>
                    )}
                  </td>
                  <td className="px-4 text-right font-mono font-bold">{money(p.invoiceTotal)}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} className={`py-10 text-center ${mutedCls}`}>
                    No supplier invoices booked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" /> Book Supplier Invoice
              </h3>
              <button onClick={() => setOpen(false)} aria-label="Close purchase invoice"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Supplier" muted={mutedCls}>
                  <select value={supplierId}
                    onChange={e => { setSupplierId(e.target.value); setGrnId(''); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Select…</option>
                    {selectableSuppliers(suppliers).map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.gstin ? '' : ' (unregistered)'}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Against Goods Receipt" muted={mutedCls}>
                  <select value={grnId} onChange={e => setGrnId(e.target.value)}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Not linked</option>
                    {billableReceipts.map(g => <option key={g.id} value={g.id}>{g.grnNumber}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Supplier's Invoice No." muted={mutedCls}>
                  <input value={supplierInvoiceNo} placeholder="ZB/2026/881"
                    onChange={e => { setSupplierInvoiceNo(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Their Invoice Date" muted={mutedCls}>
                  <input type="date" value={supplierInvoiceDate}
                    onChange={e => { setSupplierInvoiceDate(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Taxable Value (₹)" muted={mutedCls}>
                  <input type="number" value={taxableValue} placeholder="725000"
                    onChange={e => { setTaxableValue(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="GST Rate %" muted={mutedCls}>
                  <input type="number" step="0.5" value={gstRatePercent}
                    onChange={e => { setGstRatePercent(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRcm}
                  onChange={e => { setRcm(e.target.checked); setError(''); }}
                  className="accent-amber-500" />
                <span className={`text-[11px] ${dark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Reverse charge — a notified supply from an unregistered supplier (PRD §9.7)
                </span>
              </label>

              {/* Live computation, so the operator sees the split before committing */}
              <div className={`p-3 rounded-xl border text-[11px] space-y-1 ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-150 bg-slate-50/60'}`}>
                <div className="flex justify-between">
                  <span className={mutedCls}>Supply type</span>
                  <span className="font-mono font-bold">
                    {supplyType === 'INTRA_STATE' ? 'Intra-state — CGST + SGST' : 'Inter-state — IGST'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={mutedCls}>Tax</span>
                  <span className="font-mono">
                    {preview.igst > 0
                      ? `IGST ${money(preview.igst)}`
                      : `CGST ${money(preview.cgst)} + SGST ${money(preview.sgst)}`}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Payable to supplier</span>
                  <span className="font-mono">{money(preview.invoiceTotal)}</span>
                </div>

                {legs && (
                  <div className={`mt-2 pt-2 border-t space-y-0.5 ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
                    <p className={`font-bold ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
                      Reverse charge posts BOTH legs:
                    </p>
                    <div className="flex justify-between">
                      <span className={mutedCls}>Output liability (shop owes government)</span>
                      <span className="font-mono">{money(legs.outputLiability)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={mutedCls}>Input credit (shop claims back)</span>
                      <span className="font-mono">{money(legs.inputCredit)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Net cash effect</span>
                      <span className="font-mono">{money(legs.netCashEffect)}</span>
                    </div>
                    <p className={mutedCls}>
                      They net to zero, which is why recording only the credit is such an easy
                      mistake — the books would balance while the liability went undeclared.
                    </p>
                  </div>
                )}

                {!itc.eligible && itc.reason && (
                  <p className={`flex items-start gap-1 pt-1 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {itc.reason}
                  </p>
                )}
              </div>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleSave}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                Book Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, muted, children }: { label: string; muted: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${muted}`}>{label}</span>
      {children}
    </label>
  );
}
