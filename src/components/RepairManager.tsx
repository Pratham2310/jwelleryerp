import { useState } from 'react';
import { Wrench, Plus, X, AlertCircle, Info, PackageCheck } from 'lucide-react';
import type { Branch, Karigar } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  REPAIR_STATUS_LABEL,
  nextRepairStatuses,
  isInCustody,
  isOverdue,
  validateIntake,
  buildRepairJob,
  validateDelivery,
  applyDelivery,
  applyStatus,
  summariseCustody,
  nextJobNumber,
  toGrams,
  type RepairJob,
  type RepairIntake,
  type RepairStatus,
} from '../lib/repairJob';

interface RepairManagerProps {
  jobs: RepairJob[];
  setJobs: React.Dispatch<React.SetStateAction<RepairJob[]>>;
  karigars: Karigar[];
  activeBranch: Branch | null;
  currentUserName: string;
  canManage: boolean;
}

const STATUS_BADGE: Record<RepairStatus, string> = {
  Received: 'text-amber-700 dark:text-amber-400 border-amber-500/30',
  Assessed: 'text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  WithKarigar: 'text-blue-700 dark:text-blue-400 border-blue-500/30',
  Ready: 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  Delivered: 'text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700',
  ReturnedUnrepaired: 'text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const emptyIntake: RepairIntake = {
  customerName: '', customerPhone: '', itemDescription: '', metalType: 'Gold (22K)',
  grossWeightInMg: 0, reportedFault: '', quotedChargePaisa: 0,
};

export default function RepairManager({
  jobs, setJobs, karigars, activeBranch, currentUserName, canManage,
}: RepairManagerProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { notify } = useNotifications();

  const [isIntakeOpen, setIntakeOpen] = useState(false);
  const [intake, setIntake] = useState<RepairIntake>(emptyIntake);
  const [weightIn, setWeightIn] = useState('');
  const [quote, setQuote] = useState('');
  const [intakeError, setIntakeError] = useState('');

  const [delivering, setDelivering] = useState<RepairJob | null>(null);
  const [weightOut, setWeightOut] = useState('');
  const [metalCharge, setMetalCharge] = useState('');
  const [finalCharge, setFinalCharge] = useState('');
  const [deliveryError, setDeliveryError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (paisa: number) => `₹${Math.round(paisa / 100).toLocaleString('en-IN')}`;
  const today = new Date().toISOString().slice(0, 10);
  const summary = summariseCustody(jobs, today);

  const resetIntake = () => {
    setIntakeOpen(false); setIntake(emptyIntake);
    setWeightIn(''); setQuote(''); setIntakeError('');
  };

  const submitIntake = () => {
    const draft: RepairIntake = {
      ...intake,
      grossWeightInMg: Math.round((parseFloat(weightIn) || 0) * 1000),
      quotedChargePaisa: Math.round((parseFloat(quote) || 0) * 100),
    };
    const err = validateIntake(draft);
    if (err) { setIntakeError(err); return; }

    const job = buildRepairJob(draft, nextJobNumber(jobs), today, activeBranch?.id);
    setJobs(prev => [job, ...prev]);
    notify({
      category: 'STOCK', severity: 'INFO',
      title: `Repair ${job.jobNumber} received`,
      body: `${toGrams(job.grossWeightInMg).toFixed(3)} g held for ${job.customerName}.`,
      href: '#/repairs',
    });
    resetIntake();
  };

  const submitDelivery = () => {
    if (!delivering) return;
    const input = {
      grossWeightOutMg: Math.round((parseFloat(weightOut) || 0) * 1000),
      metalChargePaisa: Math.round((parseFloat(metalCharge) || 0) * 100),
      finalChargePaisa: Math.round((parseFloat(finalCharge) || 0) * 100),
      deliveredBy: currentUserName,
    };
    const err = validateDelivery(delivering, input);
    if (err) { setDeliveryError(err); return; }

    const done = applyDelivery(delivering, input, today);
    setJobs(prev => prev.map(j => (j.id === done.id ? done : j)));
    notify({
      category: 'STOCK', severity: 'INFO',
      title: `Repair ${done.jobNumber} delivered`,
      body: `Returned to ${done.customerName}. ${money((done.finalChargePaisa ?? 0) + (done.metalChargePaisa ?? 0))} collected.`,
    });
    setDelivering(null); setWeightOut(''); setMetalCharge(''); setFinalCharge(''); setDeliveryError('');
  };

  const advance = (job: RepairJob, to: RepairStatus) => {
    setJobs(prev => prev.map(j => (j.id === job.id ? applyStatus(j, to) : j)));
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" /> Repairs & Service
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Customer pieces taken in for repair. Held in custody — never shop stock.
            </p>
          </div>
          <button onClick={() => setIntakeOpen(true)} disabled={!canManage}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-40 disabled:cursor-not-allowed text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap">
            <Plus className="w-4 h-4" /> Receive Repair
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'In Custody', value: String(summary.inCustody), accent: true,
              note: `${toGrams(summary.custodyWeightMg).toFixed(3)} g of customer metal` },
            { label: 'Ready for Collection', value: String(summary.readyForCollection) },
            { label: 'With Karigar', value: String(summary.withKarigar) },
            { label: 'Overdue', value: String(summary.overdue), danger: summary.overdue > 0 },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border text-center ${
              k.danger ? 'border-rose-500/40 bg-rose-500/5'
                : k.accent ? 'border-amber-500/40 bg-amber-500/5'
                : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.danger ? 'text-rose-500' : k.accent ? 'text-amber-500' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
              {k.note && <p className={`text-[9px] mt-0.5 ${mutedCls}`}>{k.note}</p>}
            </div>
          ))}
        </div>

        <div className={`mt-4 p-3 rounded-xl border flex gap-2.5 ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
          <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
            The weight above is <span className="font-bold">customer property held in custody</span>,
            not stock. It never enters inventory valuation or the balance sheet — booking someone
            else's chain as an asset would overstate what the business owns and let it be sold.
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
        <div className={`px-5 py-3 border-b ${rowCls}`}>
          <p className="text-xs font-bold">Repair Register</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
              <tr>
                <th className="py-3 px-4">Job</th>
                <th className="px-4">Customer</th>
                <th className="px-4">Item</th>
                <th className="px-4 text-right">Weight In</th>
                <th className="px-4 text-right">Quote</th>
                <th className="px-4">Promised</th>
                <th className="px-4">Status</th>
                <th className="px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
              {jobs.map(j => {
                const overdue = isOverdue(j, today);
                return (
                  <tr key={j.id} className={`border-b last:border-0 ${rowCls} ${overdue ? 'bg-rose-500/5' : ''}`}>
                    <td className="py-3 px-4 font-mono font-bold text-[11px]">{j.jobNumber}</td>
                    <td className="px-4 text-[11px]">
                      {j.customerName}
                      <span className={`block text-[9px] font-mono ${mutedCls}`}>{j.customerPhone}</span>
                    </td>
                    <td className={`px-4 text-[11px] max-w-[14rem]`}>
                      {j.itemDescription}
                      <span className={`block text-[9px] ${mutedCls}`}>{j.reportedFault}</span>
                    </td>
                    <td className="px-4 text-right font-mono">{toGrams(j.grossWeightInMg).toFixed(3)} g</td>
                    <td className="px-4 text-right font-mono">{money(j.quotedChargePaisa)}</td>
                    <td className={`px-4 font-mono text-[10px] ${overdue ? 'text-rose-500 font-bold' : mutedCls}`}>
                      {j.promisedDate ?? '—'}
                    </td>
                    <td className="px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_BADGE[j.status]}`}>
                        {REPAIR_STATUS_LABEL[j.status]}
                      </span>
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      {j.status === 'Ready' ? (
                        <button onClick={() => { setDelivering(j); setWeightOut(''); setMetalCharge('');
                          setFinalCharge(String(j.quotedChargePaisa / 100)); setDeliveryError(''); }}
                          disabled={!canManage}
                          className="px-2.5 py-1 rounded-lg bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-[10px] font-bold transition disabled:opacity-30">
                          <PackageCheck className="w-3 h-3 inline -mt-0.5 mr-1" />Deliver
                        </button>
                      ) : (
                        nextRepairStatuses(j.status).filter(s => s !== 'Delivered').map(s => (
                          <button key={s} onClick={() => advance(j, s)} disabled={!canManage}
                            className={`ml-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition disabled:opacity-30 ${
                              dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}>
                            {REPAIR_STATUS_LABEL[s]}
                          </button>
                        ))
                      )}
                      {!isInCustody(j.status) && j.grossWeightOutMg !== undefined && (
                        <span className={`text-[9px] font-mono ${mutedCls}`}>
                          out {toGrams(j.grossWeightOutMg).toFixed(3)} g
                          {!!j.metalAddedMg && ` (+${j.metalAddedMg} mg)`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr><td colSpan={8} className={`py-10 text-center ${mutedCls}`}>
                  No repairs received yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Intake */}
      {isIntakeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-lg my-8 rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <h3 className="text-sm font-bold">Receive Repair</h3>
              <button onClick={resetIntake} aria-label="Close repair intake"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Customer</span>
                  <input value={intake.customerName} aria-label="Customer name"
                    onChange={e => { setIntake({ ...intake, customerName: e.target.value }); setIntakeError(''); }}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Phone</span>
                  <input value={intake.customerPhone} aria-label="Customer phone" inputMode="numeric"
                    onChange={e => { setIntake({ ...intake, customerPhone: e.target.value }); setIntakeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Item as received
                </span>
                <input value={intake.itemDescription} aria-label="Item description"
                  placeholder="22K chain, 18 inch, broken clasp"
                  onChange={e => { setIntake({ ...intake, itemDescription: e.target.value }); setIntakeError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              <div className="grid sm:grid-cols-3 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Metal</span>
                  <select value={intake.metalType} aria-label="Metal type"
                    onChange={e => setIntake({ ...intake, metalType: e.target.value })}
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                    {['Gold (24K)', 'Gold (22K)', 'Gold (18K)', 'Silver (999)', 'Platinum (950)'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Weight In (g)
                  </span>
                  <input type="number" step="0.001" value={weightIn} placeholder="0.000"
                    aria-label="Gross weight in"
                    onChange={e => { setWeightIn(e.target.value); setIntakeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>Quote (₹)</span>
                  <input type="number" value={quote} placeholder="0" aria-label="Quoted charge"
                    onChange={e => { setQuote(e.target.value); setIntakeError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Reported fault
                </span>
                <input value={intake.reportedFault} aria-label="Reported fault"
                  placeholder="What the customer says is wrong"
                  onChange={e => { setIntake({ ...intake, reportedFault: e.target.value }); setIntakeError(''); }}
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Promised date (optional)
                </span>
                <input type="date" value={intake.promisedDate ?? ''} aria-label="Promised date"
                  onChange={e => setIntake({ ...intake, promisedDate: e.target.value || undefined })}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              <p className={`text-[10px] leading-relaxed ${mutedCls}`}>
                Weigh the piece in front of the customer. That reading is what the return weight is
                checked against, and it is the shop's only defence in a dispute.
              </p>

              {intakeError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{intakeError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={resetIntake}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submitIntake}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Receive Piece
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery */}
      {delivering && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
            <div className={`flex items-center justify-between p-5 border-b ${rowCls}`}>
              <div>
                <h3 className="text-sm font-bold">Deliver {delivering.jobNumber}</h3>
                <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {delivering.customerName} · in at {toGrams(delivering.grossWeightInMg).toFixed(3)} g
                </p>
              </div>
              <button onClick={() => setDelivering(null)} aria-label="Cancel delivery"
                className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="space-y-1 block">
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                  Weight Out (g)
                </span>
                <input type="number" step="0.001" value={weightOut} placeholder="0.000"
                  aria-label="Gross weight out"
                  onChange={e => { setWeightOut(e.target.value); setDeliveryError(''); }}
                  className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Metal Supplied (₹)
                  </span>
                  <input type="number" value={metalCharge} placeholder="0" aria-label="Metal charge"
                    onChange={e => { setMetalCharge(e.target.value); setDeliveryError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
                <label className="space-y-1 block">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider ${mutedCls}`}>
                    Labour (₹)
                  </span>
                  <input type="number" value={finalCharge} placeholder="0" aria-label="Final charge"
                    onChange={e => { setFinalCharge(e.target.value); setDeliveryError(''); }}
                    className={`w-full text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
                </label>
              </div>

              <p className={`text-[10px] leading-relaxed ${mutedCls}`}>
                Metal the shop supplied is a sale of goods; the repair itself is a service. They are
                taxed differently, so they stay separate figures.
              </p>

              {deliveryError && (
                <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />{deliveryError}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setDelivering(null)}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                    dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}>
                  Cancel
                </button>
                <button onClick={submitDelivery}
                  className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Hand Over
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
