import { useState } from 'react';
import { ClipboardList, Plus, X, Trash2, AlertTriangle, Ban } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type {
  PurchaseOrder, PurchaseOrderLine, Supplier, Branch, MetalStandard, ItemDesign, GoodsReceipt, Tag, PurchaseInvoice, PurchaseReturn,
} from '../types';
import GoodsReceiptPanel from './GoodsReceiptPanel';
import PurchaseInvoicePanel from './PurchaseInvoicePanel';
import PurchaseReturnPanel from './PurchaseReturnPanel';
import {
  nextPoNumber,
  validatePoDraft,
  validatePoCancellation,
  canTransitionPo,
  poValue,
  poCommittedWeight,
  lineProgress,
  isFullyReceived,
  summarisePos,
  PO_STATUS_LABEL,
} from '../lib/purchaseOrder';
import { selectableSuppliers } from '../lib/supplier';

interface PurchaseManagerProps {
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  suppliers: Supplier[];
  itemDesigns: ItemDesign[];
  branches: Branch[];
  activeBranch: Branch | null;
  /** Goods receipts (Milestone 39) — where a purchase becomes real stock. */
  goodsReceipts: GoodsReceipt[];
  setGoodsReceipts: React.Dispatch<React.SetStateAction<GoodsReceipt[]>>;
  allTags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  /** Supplier invoices and the input credit they carry (Milestone 40). */
  purchaseInvoices: PurchaseInvoice[];
  setPurchaseInvoices: React.Dispatch<React.SetStateAction<PurchaseInvoice[]>>;
  /** Debit notes reversing purchases and their ITC (Milestone 41). */
  purchaseReturns: PurchaseReturn[];
  setPurchaseReturns: React.Dispatch<React.SetStateAction<PurchaseReturn[]>>;
}

const METALS: MetalStandard[] = ['Gold (24K)', 'Gold (22K)', 'Gold (18K)', 'Silver (999)', 'Platinum (950)'];

const STATUS_BADGE: Record<string, string> = {
  Draft: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700',
  Sent: 'bg-amber-500/10 text-[#8C6D34] dark:text-[#C5A059] border-amber-500/30',
  PartiallyReceived: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  Closed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  Cancelled: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

const blankLine = (): PurchaseOrderLine => ({
  id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind: 'RAW_METAL', description: '', metalType: 'Gold (24K)', purityPercent: 99.9,
  orderedWeight: undefined, ratePerGram: undefined,
});

export default function PurchaseManager({
  purchaseOrders, setPurchaseOrders, suppliers, itemDesigns, branches, activeBranch,
  goodsReceipts, setGoodsReceipts, allTags, setTags, purchaseInvoices, setPurchaseInvoices,
  purchaseReturns, setPurchaseReturns,
}: PurchaseManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'orders' | 'receipts' | 'invoices' | 'returns'>('orders');

  const [isOpen, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState('');
  const [rateBasis, setRateBasis] = useState<PurchaseOrder['rateBasis']>('FIXED');
  const [lines, setLines] = useState<PurchaseOrderLine[]>([blankLine()]);
  const [error, setError] = useState('');

  const [cancelling, setCancelling] = useState<PurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const today = new Date().toISOString().slice(0, 10);
  const summary = summarisePos(purchaseOrders, today);
  const openSuppliers = selectableSuppliers(suppliers);
  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? 'Unknown supplier';
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const resetDraft = () => {
    setSupplierId('');
    setOrderDate(today);
    setDeliveryDate('');
    setRateBasis('FIXED');
    setLines([blankLine()]);
    setError('');
  };

  const patchLine = (id: string, patch: Partial<PurchaseOrderLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const handleSave = () => {
    const draft = {
      supplierId, orderDate,
      expectedDeliveryDate: deliveryDate || undefined,
      rateBasis, lines, branchId: activeBranch?.id,
    };
    const err = validatePoDraft(draft);
    if (err) { setError(err); return; }

    setPurchaseOrders(prev => [{
      id: `po-${Date.now()}`,
      poNumber: nextPoNumber(prev, orderDate),
      supplierId,
      orderDate,
      expectedDeliveryDate: deliveryDate || undefined,
      rateBasis,
      status: 'Sent',
      lines,
      branchId: activeBranch?.id,
    }, ...prev]);
    resetDraft();
    setOpen(false);
  };

  const handleCancel = () => {
    if (!cancelling) return;
    const err = validatePoCancellation(cancelling, cancelReason);
    if (err) { setCancelError(err); return; }
    setPurchaseOrders(prev => prev.map(p => p.id === cancelling.id
      ? { ...p, status: 'Cancelled', cancelledReason: cancelReason.trim() }
      : p));
    setCancelling(null);
    setCancelReason('');
    setCancelError('');
  };

  const closePo = (po: PurchaseOrder) => {
    if (!canTransitionPo(po.status, 'Closed')) return;
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, status: 'Closed' } : p));
  };

  return (
    <div className="space-y-6">
      {/* The procurement chain in order: what was ordered, then what actually arrived. */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 pb-px gap-6 items-center">
        {([
          { key: 'orders', label: 'Purchase Orders' },
          { key: 'receipts', label: 'Goods Receipts' },
          { key: 'invoices', label: 'Supplier Invoices & ITC' },
          { key: 'returns', label: 'Returns & Debit Notes' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-sm font-bold transition relative cursor-pointer ${
              activeTab === t.key ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            {activeTab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
        ))}
      </div>

      {activeTab === 'returns' ? (
        <PurchaseReturnPanel
          returns={purchaseReturns}
          setReturns={setPurchaseReturns}
          purchaseInvoices={purchaseInvoices}
          suppliers={suppliers}
          allTags={allTags}
          setTags={setTags}
          activeBranch={activeBranch}
        />
      ) : activeTab === 'invoices' ? (
        <PurchaseInvoicePanel
          invoices={purchaseInvoices}
          setInvoices={setPurchaseInvoices}
          goodsReceipts={goodsReceipts}
          suppliers={suppliers}
          activeBranch={activeBranch}
        />
      ) : activeTab === 'receipts' ? (
        <GoodsReceiptPanel
          receipts={goodsReceipts}
          setReceipts={setGoodsReceipts}
          purchaseOrders={purchaseOrders}
          setPurchaseOrders={setPurchaseOrders}
          suppliers={suppliers}
          allTags={allTags}
          setTags={setTags}
          itemDesigns={itemDesigns}
          activeBranch={activeBranch}
        />
      ) : (
      <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-500" /> Purchase Orders
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Bullion is often bought <span className="font-bold">unfixed</span> — the metal is
              booked now and the rate settled later. Those orders carry a weight but no value yet,
              and are shown as such rather than as ₹0.
            </p>
          </div>
          <button
            onClick={() => { resetDraft(); setOpen(true); }}
            disabled={openSuppliers.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Raise Purchase Order
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          {[
            { label: 'Open Orders', value: String(summary.open) },
            { label: 'Awaiting Delivery', value: String(summary.awaitingDelivery) },
            { label: 'Overdue', value: String(summary.overdue), danger: summary.overdue > 0 },
            { label: 'Committed Value', value: money(summary.committedValue), accent: true },
            { label: 'Metal Committed', value: `${summary.committedWeight.toFixed(3)} g`, accent: true },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.danger ? 'border-rose-500/40 bg-rose-500/5'
                : kpi.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                kpi.danger ? 'text-rose-500' : kpi.accent ? 'text-amber-500' : ''
              }`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {summary.unpricedOrders > 0 && (
          <p className={`mt-3 text-[11px] ${mutedCls}`}>
            Committed value excludes {summary.unpricedOrders} order(s) bought on an unfixed rate —
            their metal is counted, their price is not yet knowable.
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Purchase Order Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">PO No.</th>
                <th className="px-4">Supplier</th>
                <th className="px-4">Ordered</th>
                <th className="px-4">Rate Basis</th>
                <th className="px-4 text-right">Value</th>
                <th className="px-4">Delivery</th>
                <th className="px-4 text-center">Status</th>
                <th className="px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {purchaseOrders.map(po => {
                const value = poValue(po);
                const overdue = !!po.expectedDeliveryDate && po.expectedDeliveryDate < today
                  && po.status !== 'Closed' && po.status !== 'Cancelled';
                return (
                  <tr key={po.id} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-500">{po.poNumber}</td>
                    <td className="px-4 font-bold">{supplierName(po.supplierId)}</td>
                    <td className="px-4">
                      {po.lines.map(l => {
                        const p = lineProgress(l);
                        return (
                          <p key={l.id} className="text-[11px]">
                            {l.description}
                            <span className={`ml-1 font-mono ${mutedCls}`}>
                              {p.received > 0 ? `${p.received}/${p.ordered}` : p.ordered}{p.unit}
                            </span>
                            {p.isOverReceived && (
                              <span className="ml-1 text-[9px] font-bold text-amber-500">over</span>
                            )}
                          </p>
                        );
                      })}
                    </td>
                    <td className="px-4">
                      <span className={`text-[10px] font-bold ${po.rateBasis === 'UNFIXED' ? 'text-amber-500' : mutedCls}`}>
                        {po.rateBasis === 'UNFIXED' ? 'To be fixed' : 'Fixed'}
                      </span>
                    </td>
                    <td className="px-4 text-right font-mono font-bold">
                      {value === null
                        ? <span className={`text-[10px] font-normal ${mutedCls}`}>rate not fixed</span>
                        : money(value)}
                      <span className={`block text-[9px] font-normal ${mutedCls}`}>
                        {poCommittedWeight(po) > 0 ? `${poCommittedWeight(po).toFixed(3)}g metal` : ''}
                      </span>
                    </td>
                    <td className={`px-4 font-mono text-[10px] ${overdue ? 'text-rose-500 font-bold' : mutedCls}`}>
                      {po.expectedDeliveryDate || '—'}
                      {overdue && <span className="block text-[9px]">overdue</span>}
                    </td>
                    <td className="px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[po.status]}`}>
                        {PO_STATUS_LABEL[po.status]}
                      </span>
                    </td>
                    <td className="px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {canTransitionPo(po.status, 'Closed') && (
                          <button
                            onClick={() => closePo(po)}
                            title={isFullyReceived(po) ? 'Close — fully received' : 'Close short'}
                            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition"
                          >
                            {isFullyReceived(po) ? 'Close' : 'Close Short'}
                          </button>
                        )}
                        {canTransitionPo(po.status, 'Cancelled') && (
                          <button
                            onClick={() => { setCancelling(po); setCancelReason(''); setCancelError(''); }}
                            title="Cancel this order"
                            className="px-2 py-1 text-[10px] font-bold rounded-lg border border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {purchaseOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className={`py-10 text-center ${mutedCls}`}>
                    No purchase orders yet. Raise one to start the procurement chain.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raise PO */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-500" /> Raise Purchase Order
                </h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  Delivering to {activeBranch?.name || 'the active branch'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close purchase order"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Supplier" muted={mutedCls}>
                  <select value={supplierId}
                    onChange={e => { setSupplierId(e.target.value); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Select…</option>
                    {openSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Order Date" muted={mutedCls}>
                  <input type="date" value={orderDate}
                    onChange={e => { setOrderDate(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Expected Delivery" muted={mutedCls}>
                  <input type="date" value={deliveryDate}
                    onChange={e => { setDeliveryDate(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Rate Basis" muted={mutedCls}>
                  <select value={rateBasis}
                    onChange={e => { setRateBasis(e.target.value as PurchaseOrder['rateBasis']); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="FIXED">Rate fixed now</option>
                    <option value="UNFIXED">Rate to be fixed later</option>
                  </select>
                </Field>
              </div>

              {rateBasis === 'UNFIXED' && (
                <p className={`text-[11px] flex items-start gap-1.5 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  This order will carry a metal commitment but no rupee value until the rate is
                  fixed. It is excluded from the committed-value total rather than counted as zero.
                </p>
              )}

              <div className="flex items-center justify-between">
                <p className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Order Lines</p>
                <button onClick={() => setLines(prev => [...prev, blankLine()])}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                    dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  + Add Line
                </button>
              </div>

              {lines.map((line, idx) => (
                <div key={line.id} className={`p-3 rounded-xl border space-y-2 ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                  <div className="flex items-center gap-2">
                    <select value={line.kind}
                      onChange={e => { patchLine(line.id, { kind: e.target.value as PurchaseOrderLine['kind'] }); setError(''); }}
                      className={`text-[11px] px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                      <option value="RAW_METAL">Raw Metal</option>
                      <option value="FINISHED_GOODS">Finished Goods</option>
                    </select>
                    <input value={line.description} placeholder="100g 24K bullion bar"
                      onChange={e => { patchLine(line.id, { description: e.target.value }); setError(''); }}
                      className={`flex-1 text-xs px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                    {lines.length > 1 && (
                      <button onClick={() => setLines(prev => prev.filter(l => l.id !== line.id))}
                        aria-label={`Remove line ${idx + 1}`}
                        className={`p-1.5 rounded-lg ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {line.kind === 'RAW_METAL' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <select value={line.metalType}
                        onChange={e => { patchLine(line.id, { metalType: e.target.value }); setError(''); }}
                        className={`text-[11px] px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                        {METALS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input type="number" step="0.001" placeholder="Purity %" value={line.purityPercent ?? ''}
                        onChange={e => { patchLine(line.id, { purityPercent: Number(e.target.value) }); setError(''); }}
                        className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                      <input type="number" step="0.001" placeholder="Weight (g)" value={line.orderedWeight ?? ''}
                        onChange={e => { patchLine(line.id, { orderedWeight: Number(e.target.value) }); setError(''); }}
                        className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                      <input type="number" placeholder={rateBasis === 'UNFIXED' ? 'n/a' : '₹ / gram'}
                        disabled={rateBasis === 'UNFIXED'} value={line.ratePerGram ?? ''}
                        onChange={e => { patchLine(line.id, { ratePerGram: Number(e.target.value) }); setError(''); }}
                        className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 disabled:opacity-40 ${inputCls}`} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <select value={line.itemDesignId || ''}
                        onChange={e => patchLine(line.id, { itemDesignId: e.target.value || undefined })}
                        className={`text-[11px] px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                        <option value="">Design (optional)…</option>
                        {itemDesigns.map(d => <option key={d.id} value={d.id}>{d.designCode}</option>)}
                      </select>
                      <input type="number" placeholder="Pieces" value={line.orderedQty ?? ''}
                        onChange={e => { patchLine(line.id, { orderedQty: Number(e.target.value) }); setError(''); }}
                        className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                      <input type="number" placeholder={rateBasis === 'UNFIXED' ? 'n/a' : '₹ / piece'}
                        disabled={rateBasis === 'UNFIXED'} value={line.ratePerPiece ?? ''}
                        onChange={e => { patchLine(line.id, { ratePerPiece: Number(e.target.value) }); setError(''); }}
                        className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 disabled:opacity-40 ${inputCls}`} />
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleSave}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                Send Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel PO */}
      {cancelling && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-500" /> Cancel {cancelling.poNumber}
              </h3>
              <button onClick={() => setCancelling(null)} aria-label="Close cancel"
                className={`p-1.5 rounded-lg ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="Reason" muted={mutedCls}>
                <input value={cancelReason} placeholder="Dealer withdrew the quote"
                  onChange={e => { setCancelReason(e.target.value); setCancelError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </Field>
              {cancelError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {cancelError}
                </p>
              )}
            </div>
            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleCancel}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition">
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
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
