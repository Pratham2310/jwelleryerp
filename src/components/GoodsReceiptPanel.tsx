import { useState } from 'react';
import { PackageCheck, Plus, X, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type {
  GoodsReceipt, GoodsReceiptLine, PurchaseOrder, Supplier, Tag, ItemDesign, Branch, MetalStandard,
} from '../types';
import {
  nextGrnNumber,
  validateGrnDraft,
  buildReceivedTags,
  applyReceiptToPo,
  assessPurityVariance,
  parsePieceWeights,
  summariseGrns,
} from '../lib/goodsReceipt';
import { receivablePos, lineProgress } from '../lib/purchaseOrder';
import { selectableSuppliers } from '../lib/supplier';

interface GoodsReceiptPanelProps {
  receipts: GoodsReceipt[];
  setReceipts: React.Dispatch<React.SetStateAction<GoodsReceipt[]>>;
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  suppliers: Supplier[];
  allTags: Tag[];
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  itemDesigns: ItemDesign[];
  activeBranch: Branch | null;
}

const METALS: MetalStandard[] = ['Gold (24K)', 'Gold (22K)', 'Gold (18K)', 'Silver (999)', 'Platinum (950)'];

interface DraftLine extends GoodsReceiptLine {
  pieceWeightsRaw?: string;
  pieceHuidsRaw?: string;
}

const blankLine = (): DraftLine => ({
  id: `gl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind: 'RAW_METAL', description: '', metalType: 'Gold (24K)',
  receivedWeight: undefined, orderedPurityPercent: 99.9, testedPurityPercent: undefined,
});

export default function GoodsReceiptPanel({
  receipts, setReceipts, purchaseOrders, setPurchaseOrders,
  suppliers, allTags, setTags, itemDesigns, activeBranch,
}: GoodsReceiptPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [isOpen, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [poId, setPoId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [dcNumber, setDcNumber] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const summary = summariseGrns(receipts);
  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name ?? 'Unknown supplier';
  const openPos = receivablePos(purchaseOrders, supplierId || undefined);
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const reset = () => {
    setSupplierId(''); setPoId(''); setDcNumber('');
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setLines([blankLine()]); setError('');
  };

  const patch = (id: string, p: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...p } : l));

  /** Pre-fills the receipt lines from the outstanding balance of the selected order. */
  const adoptPo = (id: string) => {
    setPoId(id);
    setError('');
    const po = purchaseOrders.find(p => p.id === id);
    if (!po) return;
    setSupplierId(po.supplierId);
    setLines(po.lines.filter(l => !lineProgress(l).isComplete).map(l => ({
      id: `gl-${l.id}`,
      kind: l.kind,
      description: l.description,
      purchaseOrderLineId: l.id,
      metalType: l.metalType,
      // Default to the outstanding balance — the common case is receiving what is left.
      receivedWeight: l.kind === 'RAW_METAL' ? lineProgress(l).outstanding : undefined,
      orderedPurityPercent: l.purityPercent,
      testedPurityPercent: undefined,
      ratePerGram: l.ratePerGram,
      itemDesignId: l.itemDesignId,
      receivedQty: l.kind === 'FINISHED_GOODS' ? lineProgress(l).outstanding : undefined,
      pieceWeightsRaw: '',
      pieceHuidsRaw: '',
    })));
  };

  const materialise = (l: DraftLine): GoodsReceiptLine => ({
    ...l,
    pieceWeights: l.kind === 'FINISHED_GOODS' ? parsePieceWeights(l.pieceWeightsRaw || '') : undefined,
    pieceHuids: l.kind === 'FINISHED_GOODS'
      ? (l.pieceHuidsRaw || '').split(/[,\s]+/).map(v => v.trim().toUpperCase())
      : undefined,
  });

  const handleSave = () => {
    const built = lines.map(materialise);
    const draft = {
      supplierId, receiptDate, purchaseOrderId: poId || undefined,
      supplierDcNumber: dcNumber || undefined, lines: built, branchId: activeBranch?.id,
    };
    const err = validateGrnDraft(draft, allTags);
    if (err) { setError(err); return; }

    const receipt: GoodsReceipt = {
      ...draft,
      id: `grn-${Date.now()}`,
      grnNumber: nextGrnNumber(receipts, receiptDate),
      lines: built,
      createdTagIds: [],
    };

    // Received goods enter the Tag lifecycle — this is where bought stock becomes real.
    const created = buildReceivedTags(receipt, itemDesigns, allTags.length);
    receipt.createdTagIds = created.map(t => t.id);

    setTags(prev => [...created, ...prev]);
    setReceipts(prev => [receipt, ...prev]);
    if (poId) {
      setPurchaseOrders(prev => prev.map(p => p.id === poId ? applyReceiptToPo(p, receipt) : p));
    }
    reset();
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-amber-500" /> Goods Receipts
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Where bought goods become real stock. Assayed purity is compared against what was
              contracted — the gap is a claim against the supplier, in grams and in rupees.
            </p>
          </div>
          <button
            onClick={() => { reset(); setOpen(true); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Receive Goods
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Receipts', value: String(summary.total) },
            { label: 'Metal Received', value: `${summary.metalReceived.toFixed(3)} g` },
            { label: 'Pieces Received', value: String(summary.piecesReceived) },
            { label: 'Purity Shortfall', value: money(summary.shortfallValue), danger: summary.linesWithShortfall > 0 },
          ].map(kpi => (
            <div key={kpi.label} className={`p-4 rounded-xl border text-center ${
              kpi.danger ? 'border-rose-500/40 bg-rose-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${kpi.danger ? 'text-rose-500' : ''}`}>{kpi.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {summary.linesWithShortfall > 0 && (
          <p className={`mt-3 text-[11px] flex items-start gap-1.5 ${dark ? 'text-rose-300' : 'text-rose-700'}`}>
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {summary.linesWithShortfall} line(s) assayed below contracted purity —
            {' '}{summary.shortfallFineGold.toFixed(3)}g of fine gold, about {money(summary.shortfallValue)}.
            Raise it with the supplier before booking their invoice.
          </p>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Goods Receipt Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">GRN No.</th>
                <th className="px-4">Supplier</th>
                <th className="px-4">Against PO</th>
                <th className="px-4">Received</th>
                <th className="px-4">Purity Check</th>
                <th className="px-4 text-center">Tags Created</th>
                <th className="px-4">Date</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {receipts.map(r => {
                const po = purchaseOrders.find(p => p.id === r.purchaseOrderId);
                return (
                  <tr key={r.id} className={`border-b last:border-0 ${rowCls}`}>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-500">{r.grnNumber}</td>
                    <td className="px-4 font-bold">{supplierName(r.supplierId)}</td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{po?.poNumber || 'Direct purchase'}</td>
                    <td className="px-4">
                      {r.lines.map(l => (
                        <p key={l.id} className="text-[11px]">
                          {l.description}
                          <span className={`ml-1 font-mono ${mutedCls}`}>
                            {l.kind === 'RAW_METAL' ? `${(l.receivedWeight || 0).toFixed(3)}g` : `${l.receivedQty} pcs`}
                          </span>
                        </p>
                      ))}
                    </td>
                    <td className="px-4">
                      {r.lines.map(l => {
                        if (l.kind !== 'RAW_METAL' || !l.orderedPurityPercent || !l.testedPurityPercent) {
                          return <p key={l.id} className={`text-[10px] ${mutedCls}`}>—</p>;
                        }
                        const v = assessPurityVariance(
                          l.orderedPurityPercent, l.testedPurityPercent, l.receivedWeight || 0, l.ratePerGram);
                        return (
                          <p key={l.id} className={`text-[10px] font-mono ${
                            v.severity === 'SHORTFALL' ? 'text-rose-500 font-bold'
                              : v.severity === 'OVER_DELIVERED' ? 'text-emerald-600 dark:text-emerald-400' : mutedCls
                          }`}>
                            {l.testedPurityPercent}% vs {l.orderedPurityPercent}%
                            {v.severity === 'SHORTFALL' && ` · −${v.fineGoldShortfall.toFixed(3)}g`}
                          </p>
                        );
                      })}
                    </td>
                    <td className="px-4 text-center font-mono font-bold">{r.createdTagIds.length}</td>
                    <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{r.receiptDate}</td>
                  </tr>
                );
              })}
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={7} className={`py-10 text-center ${mutedCls}`}>
                    No goods received yet. Receiving is what turns a purchase order into real stock.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-amber-500" /> Receive Goods
                </h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>Into {activeBranch?.name || 'the active branch'}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close receipt"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Supplier" muted={mutedCls}>
                  <select value={supplierId}
                    onChange={e => { setSupplierId(e.target.value); setPoId(''); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Select…</option>
                    {selectableSuppliers(suppliers).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Against PO (optional)" muted={mutedCls}>
                  <select value={poId} onChange={e => adoptPo(e.target.value)}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    <option value="">Direct purchase</option>
                    {openPos.map(p => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
                  </select>
                </Field>
                <Field label="Receipt Date" muted={mutedCls}>
                  <input type="date" value={receiptDate}
                    onChange={e => { setReceiptDate(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
                <Field label="Supplier DC No." muted={mutedCls}>
                  <input value={dcNumber} placeholder="DC/2026/887"
                    onChange={e => setDcNumber(e.target.value)}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </Field>
              </div>

              <div className="flex items-center justify-between">
                <p className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Received Lines</p>
                <button onClick={() => setLines(prev => [...prev, blankLine()])}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                    dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  + Add Line
                </button>
              </div>

              {lines.map((line, idx) => {
                const variance = line.kind === 'RAW_METAL' && line.orderedPurityPercent && line.testedPurityPercent
                  ? assessPurityVariance(line.orderedPurityPercent, line.testedPurityPercent, line.receivedWeight || 0, line.ratePerGram)
                  : null;
                return (
                  <div key={line.id} className={`p-3 rounded-xl border space-y-2 ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                    <div className="flex items-center gap-2">
                      <select value={line.kind}
                        onChange={e => { patch(line.id, { kind: e.target.value as DraftLine['kind'] }); setError(''); }}
                        className={`text-[11px] px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                        <option value="RAW_METAL">Raw Metal</option>
                        <option value="FINISHED_GOODS">Finished Goods</option>
                      </select>
                      <input value={line.description} placeholder="100g 24K bullion bar"
                        onChange={e => { patch(line.id, { description: e.target.value }); setError(''); }}
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
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select value={line.metalType}
                            onChange={e => { patch(line.id, { metalType: e.target.value }); setError(''); }}
                            className={`text-[11px] px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                            {METALS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input type="number" step="0.001" placeholder="Weight received (g)" value={line.receivedWeight ?? ''}
                            onChange={e => { patch(line.id, { receivedWeight: Number(e.target.value) }); setError(''); }}
                            className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                          <input type="number" step="0.001" placeholder="Contracted purity %" value={line.orderedPurityPercent ?? ''}
                            onChange={e => { patch(line.id, { orderedPurityPercent: Number(e.target.value) }); setError(''); }}
                            className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                          <input type="number" step="0.001" placeholder="Assayed purity %" value={line.testedPurityPercent ?? ''}
                            onChange={e => { patch(line.id, { testedPurityPercent: Number(e.target.value) }); setError(''); }}
                            className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                        </div>
                        {variance?.message && (
                          <p className={`text-[10px] flex items-start gap-1 ${
                            variance.severity === 'SHORTFALL' ? 'text-rose-500 font-bold' : mutedCls
                          }`}>
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {variance.message}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <select value={line.itemDesignId || ''}
                          onChange={e => { patch(line.id, { itemDesignId: e.target.value }); setError(''); }}
                          className={`text-[11px] px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                          <option value="">Design…</option>
                          {itemDesigns.map(d => <option key={d.id} value={d.id}>{d.designCode}</option>)}
                        </select>
                        <input type="number" placeholder="Pieces" value={line.receivedQty ?? ''}
                          onChange={e => { patch(line.id, { receivedQty: Number(e.target.value) }); setError(''); }}
                          className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                        <input placeholder="Each weight: 41.2, 39.8" value={line.pieceWeightsRaw || ''}
                          onChange={e => { patch(line.id, { pieceWeightsRaw: e.target.value }); setError(''); }}
                          className={`text-[11px] font-mono px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                        <input placeholder="HUIDs if engraved" value={line.pieceHuidsRaw || ''}
                          onChange={e => { patch(line.id, { pieceHuidsRaw: e.target.value.toUpperCase() }); setError(''); }}
                          className={`text-[11px] font-mono uppercase px-2 py-1.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                      </div>
                    )}
                  </div>
                );
              })}

              <p className={`text-[10px] ${mutedCls}`}>
                Each piece is weighed individually (D-6) — averaging a total would create stock
                whose weights are all subtly wrong, and every one of those prices a sale. Pieces
                without a supplier HUID enter as <span className="font-bold">Pending Hallmark</span>,
                not sellable stock.
              </p>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className={`p-5 border-t ${rowCls}`}>
              <button onClick={handleSave}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                Record Receipt & Create Stock
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
