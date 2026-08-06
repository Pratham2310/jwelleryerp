import { useState } from 'react';
import { ClipboardList, Plus, X, AlertCircle, Info, IndianRupee, Ban } from 'lucide-react';
import type { Branch, MetalRate } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  ORDER_STATUS_LABEL,
  RATE_BASIS_LABEL,
  nextOrderStatuses,
  isOrderOverdue,
  advanceReceived,
  estimatedValue,
  balanceDue,
  applicableRate,
  validateOrder,
  validateAdvance,
  buildOrder,
  addAdvance,
  applyOrderStatus,
  validateCancellation,
  applyCancellation,
  summariseOrders,
  nextOrderNumber,
  orderGrams,
  type CustomerOrder,
  type OrderDraft,
  type OrderStatus,
  type OrderRateBasis,
} from '../lib/customerOrder';

interface OrderManagerProps {
  orders: CustomerOrder[];
  setOrders: React.Dispatch<React.SetStateAction<CustomerOrder[]>>;
  metalRates: MetalRate[];
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  Draft: 'text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700',
  Confirmed: 'text-amber-700 dark:text-amber-400 border-amber-500/30',
  InProduction: 'text-blue-700 dark:text-blue-400 border-blue-500/30',
  Ready: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  Delivered: 'text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700',
  Cancelled: 'text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const emptyDraft: OrderDraft = {
  customerName: '', customerPhone: '', description: '', metalType: 'Gold (22K)',
  estimatedWeightMg: 0, estimatedMakingPaisa: 0, estimatedStonePaisa: 0,
  rateBasis: 'AT_DELIVERY', lockedRatePerGramPaisa: null,
};

export default function OrderManager({
  orders, setOrders, metalRates, activeBranch, currentUserName, canManage,
}: OrderManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { notify } = useNotifications();

  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [weight, setWeight] = useState('');
  const [making, setMaking] = useState('');
  const [stone, setStone] = useState('');
  const [error, setError] = useState('');

  const [advancing, setAdvancing] = useState<CustomerOrder | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMode, setAdvanceMode] = useState('Cash');
  const [advanceError, setAdvanceError] = useState('');

  const [cancelling, setCancelling] = useState<CustomerOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refund, setRefund] = useState('');
  const [cancelError, setCancelError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (paisa: number) => `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
  const today = new Date().toISOString().slice(0, 10);
  const summary = summariseOrders(orders, today);

  const rateFor = (metalType: string) =>
    Math.round((metalRates.find(r => r.metalType === metalType)?.ratePerGram ?? 0) * 100);

  const reset = () => {
    setOpen(false); setDraft(emptyDraft);
    setWeight(''); setMaking(''); setStone(''); setError('');
  };

  const submit = () => {
    const full: OrderDraft = {
      ...draft,
      estimatedWeightMg: Math.round((parseFloat(weight) || 0) * 1000),
      estimatedMakingPaisa: Math.round((parseFloat(making) || 0) * 100),
      estimatedStonePaisa: Math.round((parseFloat(stone) || 0) * 100),
      lockedRatePerGramPaisa: draft.rateBasis === 'FIXED_AT_ORDER'
        ? rateFor(draft.metalType)
        : null,
    };
    const err = validateOrder(full);
    if (err) { setError(err); return; }

    const created = buildOrder(full, nextOrderNumber(orders), today, activeBranch?.id);
    setOrders(prev => [created, ...prev]);
    notify({
      category: 'SALE', severity: 'INFO',
      title: `Order ${created.orderNumber} taken`,
      body: `${created.description.slice(0, 40)} for ${created.customerName}.`,
      href: '#/orders',
    });
    reset();
  };

  const submitAdvance = () => {
    if (!advancing) return;
    const paisa = Math.round((parseFloat(advanceAmount) || 0) * 100);
    const err = validateAdvance(advancing, paisa, rateFor(advancing.metalType));
    if (err) { setAdvanceError(err); return; }

    const updated = addAdvance(advancing, paisa, advanceMode, currentUserName, today);
    setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    notify({
      category: 'SALE', severity: 'INFO',
      title: `Advance received on ${updated.orderNumber}`,
      body: `${money(paisa)} held as a liability until the piece is delivered.`,
    });
    setAdvancing(null); setAdvanceAmount(''); setAdvanceError('');
  };

  const submitCancellation = () => {
    if (!cancelling) return;
    const paisa = Math.round((parseFloat(refund) || 0) * 100);
    const err = validateCancellation(cancelling, cancelReason, paisa);
    if (err) { setCancelError(err); return; }

    const updated = applyCancellation(cancelling, cancelReason, paisa, today);
    setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    setCancelling(null); setCancelReason(''); setRefund(''); setCancelError('');
  };

  const advance = (order: CustomerOrder, to: OrderStatus) => {
    setOrders(prev => prev.map(o => (o.id === order.id ? applyOrderStatus(o, to) : o)));
  };

  const liveRate = rateFor(draft.metalType);

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-500" /> Customer Orders
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Pieces ordered but not yet made. Advances are held as a liability until delivery.
            </p>
          </div>
          <button onClick={() => setOpen(true)} disabled={!canManage}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> Take Order
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Open Orders', value: String(summary.open), accent: true },
            { label: 'Ready for Delivery', value: String(summary.ready) },
            { label: 'Advances Held', value: money(summary.advanceLiabilityPaisa),
              warn: summary.advanceLiabilityPaisa > 0, note: 'A liability, not income' },
            { label: 'Overdue', value: String(summary.overdue), danger: summary.overdue > 0 },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.danger ? 'border-rose-500/40 bg-rose-500/5'
                : k.warn ? 'border-amber-500/40 bg-amber-500/5'
                : k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.danger ? 'text-rose-500' : k.warn ? 'text-amber-500'
                  : k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
              {k.note && <p className={`text-[9px] mt-0.5 ${mutedCls}`}>{k.note}</p>}
            </div>
          ))}
        </div>

        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
          <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
            Money taken before goods are supplied is the <span className="font-bold">customer's,
            held by the shop</span> — it posts as a liability, never as revenue. Booking it as
            income would recognise a sale that has not happened and create tax on unearned money.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Order Book</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="px-4">Customer</th>
                <th className="px-4">Piece</th>
                <th className="px-4">Rate Basis</th>
                <th className="px-4 text-right">Est. Value</th>
                <th className="px-4 text-right">Advance</th>
                <th className="px-4 text-right">Balance</th>
                <th className="px-4">Status</th>
                <th className="px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {orders.map(o => {
                const rate = rateFor(o.metalType);
                const overdue = isOrderOverdue(o, today);
                const applied = applicableRate(o, rate);
                return (
                  <tr key={o.id} className={`border-b last:border-0 ${rowCls} ${overdue ? 'bg-rose-500/5' : ''}`}>
                    <td className="py-3 px-4 font-mono font-bold text-[11px]">
                      {o.orderNumber}
                      {o.convertedInvoiceNumber && (
                        <span className={`block text-[9px] ${mutedCls}`}>→ {o.convertedInvoiceNumber}</span>
                      )}
                    </td>
                    <td className="px-4 text-[11px]">
                      {o.customerName}
                      <span className={`block text-[9px] font-mono ${mutedCls}`}>{o.customerPhone}</span>
                    </td>
                    <td className="px-4 text-[11px] max-w-[13rem]">
                      {o.description}
                      <span className={`block text-[9px] ${mutedCls}`}>
                        ~{orderGrams(o.estimatedWeightMg).toFixed(3)} g {o.metalType}
                      </span>
                    </td>
                    <td className="px-4 text-[10px]">
                      {RATE_BASIS_LABEL[o.rateBasis]}
                      {o.lockedRatePerGramPaisa !== null && (
                        <span className={`block text-[9px] font-mono ${
                          applied.differenceFromOrderPaisa > 0 ? 'text-amber-600 dark:text-amber-400' : mutedCls
                        }`}>
                          @{money(o.lockedRatePerGramPaisa)}/g
                          {applied.differenceFromOrderPaisa !== 0 &&
                            ` (mkt ${applied.differenceFromOrderPaisa > 0 ? '+' : ''}${money(applied.differenceFromOrderPaisa)})`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-right font-mono">{money(estimatedValue(o, rate))}</td>
                    <td className="px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {money(advanceReceived(o))}
                    </td>
                    <td className="px-4 text-right font-mono font-bold">{money(balanceDue(o, rate))}</td>
                    <td className="px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_BADGE[o.status]}`}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </span>
                      {o.status === 'Cancelled' && o.refundedPaisa !== undefined && (
                        <span className={`block text-[9px] mt-0.5 ${mutedCls}`}>
                          refunded {money(o.refundedPaisa)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      {nextOrderStatuses(o.status).filter(s => s !== 'Cancelled').map(s => (
                        <button key={s} onClick={() => advance(o, s)} disabled={!canManage}
                          className={`ml-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition disabled:opacity-30 ${
                            dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}>
                          {ORDER_STATUS_LABEL[s]}
                        </button>
                      ))}
                      {o.status !== 'Delivered' && o.status !== 'Cancelled' && (
                        <>
                          <button onClick={() => { setAdvancing(o); setAdvanceAmount(''); setAdvanceError(''); }}
                            disabled={!canManage}
                            className="ml-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-30">
                            <IndianRupee className="w-3 h-3 inline -mt-0.5" /> Advance
                          </button>
                          <button onClick={() => { setCancelling(o); setCancelReason(''); setRefund(String(advanceReceived(o) / 100)); setCancelError(''); }}
                            disabled={!canManage}
                            className="ml-1.5 px-2.5 py-1 rounded-lg border border-rose-500/40 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-30">
                            <Ban className="w-3 h-3 inline -mt-0.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={9} className={`py-10 text-center ${mutedCls}`}>
                  No customer orders yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Take order */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-lg my-8 rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">Take Customer Order</h3>
              <button onClick={reset} aria-label="Close order form"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Customer</span>
                  <input value={draft.customerName} aria-label="Order customer name"
                    onChange={e => { setDraft({ ...draft, customerName: e.target.value }); setError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Phone</span>
                  <input value={draft.customerPhone} aria-label="Order customer phone" inputMode="numeric"
                    onChange={e => { setDraft({ ...draft, customerPhone: e.target.value }); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  What is being made
                </span>
                <input value={draft.description} aria-label="Order description"
                  placeholder="Antique kundan necklace, peacock motif, 18 inch"
                  onChange={e => { setDraft({ ...draft, description: e.target.value }); setError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              <div className="grid sm:grid-cols-4 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Metal</span>
                  <select value={draft.metalType} aria-label="Order metal type"
                    onChange={e => setDraft({ ...draft, metalType: e.target.value })}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    {['Gold (24K)', 'Gold (22K)', 'Gold (18K)', 'Silver (999)', 'Platinum (950)'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Est. Wt (g)</span>
                  <input type="number" step="0.001" value={weight} placeholder="0.000"
                    aria-label="Estimated weight"
                    onChange={e => { setWeight(e.target.value); setError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Making (₹)</span>
                  <input type="number" value={making} placeholder="0" aria-label="Estimated making"
                    onChange={e => setMaking(e.target.value)}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Stones (₹)</span>
                  <input type="number" value={stone} placeholder="0" aria-label="Estimated stones"
                    onChange={e => setStone(e.target.value)}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              {/* The decision that prevents the argument at delivery */}
              <div className="space-y-1.5">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Rate Basis
                </span>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(['AT_DELIVERY', 'FIXED_AT_ORDER'] as OrderRateBasis[]).map(basis => (
                    <button key={basis} onClick={() => { setDraft({ ...draft, rateBasis: basis }); setError(''); }}
                      className={`text-left p-3 rounded-xl border transition ${
                        draft.rateBasis === basis
                          ? 'border-amber-500/60 bg-amber-500/10'
                          : dark ? 'border-zinc-800 hover:border-zinc-700' : 'border-slate-150 hover:border-slate-300'
                      }`}>
                      <p className="text-[11px] font-bold">{RATE_BASIS_LABEL[basis]}</p>
                      <p className={`text-[10px] mt-0.5 leading-relaxed ${mutedCls}`}>
                        {basis === 'AT_DELIVERY'
                          ? 'Market rate on the delivery date. The customer carries the price risk.'
                          : `Locked at today's ${money(liveRate)}/g. The shop absorbs any rise.`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Expected delivery (optional)
                </span>
                <input type="date" value={draft.expectedDeliveryDate ?? ''} aria-label="Expected delivery"
                  onChange={e => setDraft({ ...draft, expectedDeliveryDate: e.target.value || undefined })}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              {error && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={reset}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submit}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Take Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advance */}
      {advancing && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold">Advance on {advancing.orderNumber}</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  Held {money(advanceReceived(advancing))} of {money(estimatedValue(advancing, rateFor(advancing.metalType)))}
                </p>
              </div>
              <button onClick={() => setAdvancing(null)} aria-label="Cancel advance"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Amount (₹)</span>
                <input type="number" value={advanceAmount} placeholder="0" aria-label="Advance amount"
                  onChange={e => { setAdvanceAmount(e.target.value); setAdvanceError(''); }}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Mode</span>
                <select value={advanceMode} aria-label="Advance mode"
                  onChange={e => setAdvanceMode(e.target.value)}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                  {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>

              {advanceError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{advanceError}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setAdvancing(null)}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submitAdvance}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Receive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel order */}
      {cancelling && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">Cancel {cancelling.orderNumber}</h3>
              <button onClick={() => setCancelling(null)} aria-label="Close cancellation"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
                {money(advanceReceived(cancelling))} was received against this order. The advances
                stay on the record — a refund is a new fact, not the erasure of an old one.
              </p>
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Reason</span>
                <input value={cancelReason} aria-label="Cancellation reason"
                  onChange={e => { setCancelReason(e.target.value); setCancelError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Refund (₹)</span>
                <input type="number" value={refund} aria-label="Refund amount"
                  onChange={e => { setRefund(e.target.value); setCancelError(''); }}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              {cancelError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{cancelError}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setCancelling(null)}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Keep Order
                </button>
                <button onClick={submitCancellation}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition">
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
