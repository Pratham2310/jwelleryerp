import { Boxes, CheckCircle2, XCircle, Clock, Landmark } from 'lucide-react';
import type { Tag, MetalRate } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  inventoryHeadline,
  stockByPurity,
  stockByCategory,
  stockByOwnership,
  lifecycleDistribution,
  inventoryAgeingOnHand,
  slowMovingCapital,
  reconcileInventory,
  type StockSlice,
} from '../lib/inventoryDashboard';
import type { AuditResult } from '../lib/stockAudit';
import { auditDiscrepancySummary } from '../lib/stockAudit';

interface InventoryDashboardPanelProps {
  tags: Tag[];
  metalRates: MetalRate[];
  /** The most recent physical audit (Milestone 6), if one has been run this session. */
  lastAudit: AuditResult | null;
}

export default function InventoryDashboardPanel({
  tags, metalRates, lastAudit,
}: InventoryDashboardPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const tileCls = dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60';

  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const head = inventoryHeadline(tags, metalRates);
  const ageing = inventoryAgeingOnHand(tags, metalRates);
  const slow = slowMovingCapital(ageing, 180);
  const checks = reconcileInventory(tags, metalRates);
  const lifecycle = lifecycleDistribution(tags);

  const SliceTable = ({ title, rows }: { title: string; rows: StockSlice[] }) => (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
      <div className={`px-5 py-3 border-b ${rowCls}`}>
        <p className="text-xs font-bold">{title}</p>
      </div>
      <div className="p-4 space-y-2.5">
        {rows.map(r => (
          <div key={r.key} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="font-bold">{r.label}</span>
              <span className="font-mono">
                {money(r.value)} <span className={mutedCls}>· {r.pieces} pc · {r.netWeight.toFixed(3)} g</span>
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
              <div className="h-full bg-[#C5A059] rounded-full" style={{ width: `${r.sharePercent}%` }} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className={`py-6 text-center text-[11px] ${mutedCls}`}>Nothing on hand.</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Headline — deliberately three figures, not one */}
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <Boxes className="w-4 h-4 text-amber-500" /> Inventory Position
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          "Stock" is not one number — a piece on memo is the shop's asset but cannot be sold today,
          and financed stock sits on the shelf without belonging to the business.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Sellable Now', value: money(head.sellableValue), accent: true,
              note: `${head.sellablePieces} pc · ${head.sellableWeight.toFixed(3)} g` },
            { label: 'Held, Not Sellable', value: money(head.heldNotSellableValue),
              note: `${head.heldNotSellablePieces} pc · ${head.heldNotSellableWeight.toFixed(3)} g` },
            { label: 'Financed (GML / Consignment)', value: money(head.financedValue),
              warn: head.financedValue > 0, note: 'On the shelf, not owned' },
            { label: 'Owned Outright', value: money(head.ownedValue),
              note: 'On-hand less financed' },
          ].map(k => (
            <div key={k.label} className={`p-4 rounded-xl border ${
              k.warn ? 'border-amber-500/40 bg-amber-500/5'
                : k.accent ? 'border-emerald-500/40 bg-emerald-500/5' : tileCls
            }`}>
              <p className={`text-lg font-black font-mono ${
                k.warn ? 'text-amber-500' : k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
              }`}>{k.value}</p>
              <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
              {k.note && <p className={`text-[9px] mt-0.5 ${mutedCls}`}>{k.note}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SliceTable title="Stock by Purity" rows={stockByPurity(tags, metalRates)} />
        <SliceTable title="Stock by Category" rows={stockByCategory(tags, metalRates)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SliceTable title="Ownership Exposure" rows={stockByOwnership(tags, metalRates)} />

        {/* Ageing */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Stock Ageing
            </p>
            <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
              Across everything on hand, including metal with a karigar — that is exactly the
              capital worth surfacing.
            </p>
          </div>
          <div className="p-4 space-y-2">
            {ageing.map(a => (
              <div key={a.bucket} className={`flex items-center justify-between p-2.5 rounded-xl border text-[11px] ${
                a.bucket === '365+' ? 'border-rose-500/40 bg-rose-500/5'
                  : a.bucket === 'unknown' ? 'border-amber-500/30 bg-amber-500/5'
                  : dark ? 'border-zinc-800' : 'border-slate-150'
              }`}>
                <span className="font-bold">{a.label}</span>
                <span className="font-mono">
                  {money(a.value)} <span className={mutedCls}>· {a.pieces} pc</span>
                </span>
              </div>
            ))}
            {ageing.length === 0 && <p className={`py-6 text-center text-[11px] ${mutedCls}`}>Nothing on hand.</p>}

            {slow.value > 0 && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mt-2">
                {money(slow.value)} tied up in {slow.pieces} piece(s) held over 180 days.
              </p>
            )}
            {slow.undatedPieces > 0 && (
              <p className={`text-[10px] ${mutedCls}`}>
                {slow.undatedPieces} undated piece(s) are excluded from that figure rather than
                counted as new — treating them as fresh would hide the problem this measures.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lifecycle */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold">Lifecycle Distribution</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {lifecycle.map(l => (
              <div key={l.status} className={`flex justify-between p-2.5 rounded-lg border text-[11px] ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                <span className={mutedCls}>{l.label}</span>
                <span className="font-mono font-bold">{l.pieces}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reconciliation + last audit */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className="text-xs font-bold flex items-center gap-2">
              <Landmark className="w-3.5 h-3.5 text-amber-500" /> Reconciliation
            </p>
            <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
              Every tile above is derived from the tags on each render, and these checks prove it
              rather than asserting it.
            </p>
          </div>
          <div className="p-4 space-y-2">
            {checks.map(c => (
              <div key={c.label} className="flex items-start gap-2.5 text-[11px]">
                {c.passes
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-500" />
                  : <XCircle className="w-3.5 h-3.5 shrink-0 mt-px text-rose-500" />}
                <span className="flex-1">
                  {c.label}
                  <span className={`block font-mono text-[10px] ${mutedCls}`}>{c.detail}</span>
                </span>
              </div>
            ))}

            <div className={`pt-3 mt-1 border-t ${rowCls}`}>
              <p className={`text-[10px] uppercase font-mono font-bold tracking-wider mb-1.5 ${mutedCls}`}>
                Last Physical Audit
              </p>
              {lastAudit ? (
                <p className="text-[11px]">
                  {(() => {
                    const s = auditDiscrepancySummary(lastAudit);
                    return `${s.matchedCount} matched · ${s.missingCount} missing `
                      + `(${s.missingWeight.toFixed(3)} g) · ${s.extraCount} unexpected`;
                  })()}
                </p>
              ) : (
                <p className={`text-[11px] ${mutedCls}`}>
                  No audit run in this session. Run one from Catalog → Stock Audit.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
