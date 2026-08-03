import { useState } from 'react';
import { BarChart3, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type {
  SaleInvoice, Tag, Customer, Supplier, Karigar, KarigarLedgerEntry,
  PurchaseInvoice, Branch, MetalRate,
} from '../types';
import {
  dailySalesSummary, salesRegister, salesTotals,
  stockSummary, inventoryAgeing, slowMovingValue, stockWeightTotal,
  tierDistribution, panComplianceExceptions,
  karigarReconciliation, supplierPurchases, branchComparison,
  reconcileReports, AGE_BUCKET_LABEL,
} from '../lib/reports';
import {
  itcRegister, summariseItc, itcRegisterCsv,
  hsnSummary, hsnSummaryCsv, reconcileRegisters,
} from '../lib/gstRegisters';
import {
  buybackHeadline, intakeByPurityBand, claimedVsTested,
  meltingLossTrend, vaultByState, reconcileBuyback, lotsInPeriod,
} from '../lib/buybackDashboard';
import type { StockAdjustment } from '../lib/stockAdjustment';
import type { OldGoldVoucher } from '../types';

type Family = 'sales' | 'inventory' | 'customer' | 'karigar' | 'purchase' | 'branch' | 'gst' | 'buyback';

interface ReportsHubProps {
  invoices: SaleInvoice[];
  tags: Tag[];
  customers: Customer[];
  suppliers: Supplier[];
  karigars: Karigar[];
  karigarLedger: KarigarLedgerEntry[];
  purchaseInvoices: PurchaseInvoice[];
  branches: Branch[];
  metalRates: MetalRate[];
  /** Milestone 52 — write-offs carry an ITC reversal that belongs on the register. */
  stockAdjustments: StockAdjustment[];
  /** Milestone 53 — the buyback dashboard's source. */
  oldGoldVouchers: OldGoldVoucher[];
}

const FAMILIES: { key: Family; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'customer', label: 'Customer' },
  { key: 'karigar', label: 'Karigar' },
  { key: 'branch', label: 'Branch' },
  { key: 'gst', label: 'GST Registers' },
  { key: 'buyback', label: 'Buyback' },
];

export default function ReportsHub({
  invoices, tags, customers, suppliers, karigars, karigarLedger,
  purchaseInvoices, branches, metalRates, stockAdjustments, oldGoldVouchers,
}: ReportsHubProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [family, setFamily] = useState<Family>('sales');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const money = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN')}`;

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const checks = reconcileReports(invoices, tags, metalRates, from, to);
  const allReconcile = checks.every(c => c.reconciles);

  const Table = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
          <tr>{head.map((h, i) => (
            <th key={h} className={`py-2.5 px-3 ${i > 0 ? 'text-right' : ''}`}>{h}</th>
          ))}</tr>
        </thead>
        <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b last:border-0 ${rowCls}`}>
              {r.map((c, j) => (
                <td key={j} className={`py-2.5 px-3 ${j > 0 ? 'text-right font-mono' : 'font-bold'}`}>{c}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className={`py-8 text-center ${mutedCls}`}>Nothing in this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const Panel = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
      <div className={`px-5 py-3 border-b ${rowCls}`}>
        <p className="text-xs font-bold">{title}</p>
        {note && <p className={`text-[10px] mt-0.5 ${mutedCls}`}>{note}</p>}
      </div>
      {children}
    </div>
  );

  const totals = salesTotals(invoices, from, to);
  const stock = stockSummary(tags, metalRates);
  const ageing = inventoryAgeing(tags, metalRates, to);

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <h3 className="text-base font-bold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" /> Reports
        </h3>
        <p className={`text-xs mt-0.5 ${mutedCls}`}>
          Every figure is derived from the underlying records, never stored — so each report can be
          reconciled against what it came from.
        </p>

        <div className="flex flex-wrap items-end gap-3 mt-4">
          <label className="space-y-1 block">
            <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className={`text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
          </label>
          <label className="space-y-1 block">
            <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className={`text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`} />
          </label>
        </div>

        {/* The milestone's acceptance criterion, shown rather than asserted in a comment. */}
        <div className={`mt-4 p-3 rounded-xl border ${
          allReconcile
            ? dark ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50/60 border-emerald-100'
            : dark ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50/60 border-rose-100'
        }`}>
          <p className={`text-[11px] font-bold flex items-center gap-1.5 ${
            allReconcile ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          }`}>
            {allReconcile ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {allReconcile
              ? `All ${checks.length} reconciliation checks pass`
              : `${checks.filter(c => !c.reconciles).length} of ${checks.length} checks do not reconcile`}
          </p>
          {checks.filter(c => !c.reconciles).map(c => (
            <p key={c.label} className={`text-[10px] mt-1 ${dark ? 'text-rose-300' : 'text-rose-800'}`}>
              {c.label}: report {money(c.reportTotal)} vs source {money(c.sourceTotal)} (out by {money(c.difference)})
            </p>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {FAMILIES.map(f => (
            <button key={f.key} onClick={() => setFamily(f.key)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition ${
                family === f.key
                  ? 'bg-[#C5A059] text-[#0A0A0B] border-[#C5A059]'
                  : dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {family === 'sales' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Documents', value: String(totals.documents) },
              { label: 'Taxable Value', value: money(totals.taxableValue) },
              { label: 'Tax', value: money(totals.tax) },
              { label: 'Total (net of returns)', value: money(totals.total), accent: true },
            ].map(k => (
              <div key={k.label} className={`p-4 rounded-xl border text-center ${
                k.accent ? 'border-amber-500/40 bg-amber-500/5'
                  : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
              }`}>
                <p className={`text-lg font-black font-mono ${k.accent ? 'text-amber-500' : ''}`}>{k.value}</p>
                <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
              </div>
            ))}
          </div>
          {totals.estimatesExcluded > 0 && (
            <p className={`text-[11px] ${mutedCls}`}>
              {totals.estimatesExcluded} estimate(s) excluded — a quotation is not a supply and never
              counts as revenue. Credit notes are included, which is what makes this net of returns.
            </p>
          )}
          <Panel title="Daily Sales Summary">
            <Table head={['Date', 'Invoices', 'Credit Notes', 'Taxable', 'Tax', 'Total']}
              rows={dailySalesSummary(invoices, from, to).map(r =>
                [r.date, r.invoices, r.creditNotes, money(r.taxableValue), money(r.tax), money(r.total)])} />
          </Panel>
          <Panel title="Sales Register">
            <Table head={['Document', 'Date', 'Customer', 'Taxable', 'Tax', 'Total']}
              rows={salesRegister(invoices, from, to).map(r =>
                [r.invoiceNumber, r.date, r.customerName, money(r.taxableValue), money(r.tax), money(r.total)])} />
          </Panel>
        </>
      )}

      {family === 'purchase' && (
        <Panel title="Supplier-wise Purchases & Input Tax Credit"
          note="Reverse-charge liability is reported apart from claimable credit — one is owed by the shop, the other to it.">
          <Table head={['Supplier', 'Invoices', 'Taxable', 'Claimable ITC', 'RCM Liability']}
            rows={supplierPurchases(purchaseInvoices, suppliers).map(r =>
              [r.name, r.invoices, money(r.taxableValue), money(r.claimableItc), money(r.reverseChargeLiability)])} />
        </Panel>
      )}

      {family === 'inventory' && (
        <>
          <Panel title="Stock Summary" note={`Sellable stock only, valued at metal + stones. Total ${stockWeightTotal(stock).toFixed(3)}g.`}>
            <Table head={['Metal', 'Pieces', 'Gross Wt', 'Net Wt', 'Est. Value']}
              rows={stock.map(r =>
                [r.metalType, r.pieces, `${r.grossWeight.toFixed(3)}g`, `${r.netWeight.toFixed(3)}g`, money(r.estimatedValue)])} />
          </Panel>
          <Panel title="Inventory Ageing"
            note="Stock with no tagging date is shown as its own bucket, never as new — treating it as new would report zero old stock and hide the capital this report exists to find.">
            <Table head={['Age', 'Pieces', 'Net Wt', 'Est. Value']}
              rows={ageing.map(r =>
                [AGE_BUCKET_LABEL[r.bucket], r.pieces, `${r.netWeight.toFixed(3)}g`, money(r.estimatedValue)])} />
          </Panel>
          <div className={`p-4 rounded-xl border text-center ${
            slowMovingValue(ageing) > 0 ? 'border-amber-500/40 bg-amber-500/5'
              : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
          }`}>
            <p className="text-lg font-black font-mono text-amber-500">{money(slowMovingValue(ageing))}</p>
            <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>
              Capital in stock older than 180 days
            </p>
          </div>
        </>
      )}

      {family === 'customer' && (
        <>
          <Panel title="Loyalty Tier Distribution">
            <Table head={['Tier', 'Customers', 'Lifetime Spend']}
              rows={tierDistribution(customers).map(r => [r.tier, r.customers, money(r.lifetimeSpend)])} />
          </Panel>
          <Panel title="PAN / Form 60 Compliance Exceptions"
            note="Invoices at or above ₹2,00,000 with no declaration recorded (Rule 114B). Milestone 8 blocks these going forward; this finds anything raised before that gate.">
            <Table head={['Invoice', 'Date', 'Customer', 'Total']}
              rows={panComplianceExceptions(invoices).map(r => [r.invoiceNumber, r.date, r.customerName, money(r.total)])} />
          </Panel>
        </>
      )}

      {family === 'karigar' && (
        <Panel title="Karigar Reconciliation"
          note="Weight and money are shown side by side and never netted — decision D-2.">
          <Table head={['Karigar', 'Fine Gold Payable', 'Labour Payable', 'Ledger Entries']}
            rows={karigarReconciliation(karigars, karigarLedger).map(r =>
              [r.name, `${r.fineWeightPayable.toFixed(3)}g`, money(r.moneyPayable), r.entries])} />
        </Panel>
      )}

      {family === 'branch' && (
        <Panel title="Branch Comparison">
          <Table head={['Branch', 'Sellable Pieces', 'Stock Weight', 'Sales in Period']}
            rows={branchComparison(branches, tags, invoices, from, to).map(r =>
              [r.name, r.sellablePieces, `${r.stockWeight.toFixed(3)}g`, money(r.salesValue)])} />
        </Panel>
      )}

      {family === 'gst' && (() => {
        const rows = itcRegister(purchaseInvoices, suppliers, from, to);
        const summary = summariseItc(rows, stockAdjustments, from, to);
        const hsn = hsnSummary(invoices, from, to);
        const registerChecks = reconcileRegisters(purchaseInvoices, suppliers, invoices, from, to);

        return (
          <div className="space-y-6">
            <Panel title="Input Tax Credit Register">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3">
                {[
                  { label: 'Credit Claimed', value: money(summary.claimedTotal), accent: true },
                  { label: 'Blocked u/s 17(5)', value: money(summary.blockedTotal), warn: summary.blockedTotal > 0 },
                  { label: 'Reverse Charge', value: money(summary.reverseChargeTotal) },
                  { label: 'Write-Off Reversal Base', value: money(summary.reversalBase), warn: summary.reversalBase > 0 },
                ].map(k => (
                  <div key={k.label} className={`p-3 rounded-xl border text-center ${
                    k.warn ? 'border-amber-500/40 bg-amber-500/5'
                      : k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                      : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
                  }`}>
                    <p className={`text-base font-black font-mono ${
                      k.warn ? 'text-amber-500' : k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
                    }`}>{k.value}</p>
                    <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
                  </div>
                ))}
              </div>

              <p className={`px-3 pb-2 text-[10px] leading-relaxed ${mutedCls}`}>
                The reversal figure is the <span className="font-bold">stock value</span> written off
                under s.17(5)(h), not the tax on it — the rate originally claimed lives on the
                purchase invoice for those goods, which a write-off does not reference.
              </p>

              <Table
                head={['Date', 'Supplier', 'Invoice', 'Taxable', 'CGST', 'SGST', 'IGST', 'Eligible']}
                rows={rows.map(r => [
                  r.invoiceDate, r.supplierName, r.supplierInvoiceNo, money(r.taxableValue),
                  money(r.cgst), money(r.sgst), money(r.igst),
                  r.eligible ? (r.isReverseCharge ? 'Yes (RCM)' : 'Yes') : 'No',
                ])} />

              <div className="p-3">
                <button onClick={() => downloadCsv(`itc-register-${from}-to-${to}.csv`, itcRegisterCsv(rows))}
                  className="px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Export ITC Register CSV
                </button>
              </div>
            </Panel>

            <Panel title="HSN Summary (GSTR-1 Table 12)">
              <Table
                head={['HSN', 'Description', 'UQC', 'Quantity', 'Taxable', 'CGST', 'SGST', 'IGST']}
                rows={hsn.map(h => [
                  h.hsnCode, h.description, h.uqc, h.totalQuantity.toFixed(3),
                  money(h.taxableValue), money(h.cgst), money(h.sgst), money(h.igst),
                ])} />
              <p className={`px-3 pt-2 text-[10px] leading-relaxed ${mutedCls}`}>
                Credit notes are netted in rather than listed separately — a return reduces the
                period&apos;s outward supply, and gross figures would not reconcile against the
                GSTR-1 actually filed. Estimates are excluded: a quotation is not a supply.
              </p>
              <div className="p-3">
                <button onClick={() => downloadCsv(`hsn-summary-${from}-to-${to}.csv`, hsnSummaryCsv(hsn))}
                  className="px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                  Export HSN Summary CSV
                </button>
              </div>
            </Panel>

            <Panel title="Register Reconciliation">
              <div className="p-3 space-y-2">
                {registerChecks.map(c => (
                  <div key={c.label} className="flex items-start gap-2.5 text-[11px]">
                    {c.passes
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-rose-500" />}
                    <span className="flex-1">
                      {c.label}
                      <span className={`block font-mono text-[10px] ${mutedCls}`}>{c.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );
      })()}

      {family === 'buyback' && (() => {
        const lots = lotsInPeriod(oldGoldVouchers, from, to);
        const head = buybackHeadline(lots);
        const gap = claimedVsTested(lots);
        const buybackChecks = reconcileBuyback(lots);

        return (
          <div className="space-y-6">
            <Panel title="Buyback Intake">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3">
                {[
                  { label: 'Lots Taken In', value: String(head.lots) },
                  { label: 'Gross Weight', value: `${head.grossWeight.toFixed(3)} g` },
                  { label: 'Paid Out', value: money(head.totalPaid), accent: true },
                  { label: 'Avg Rate / g', value: money(head.averageRatePerGram) },
                ].map(k => (
                  <div key={k.label} className={`p-3 rounded-xl border text-center ${
                    k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                      : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
                  }`}>
                    <p className={`text-base font-black font-mono ${k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{k.value}</p>
                    <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
                  </div>
                ))}
              </div>
              <p className={`px-3 pb-2 text-[10px] ${mutedCls}`}>
                Purity testing and melting allowance removed {head.deductedWeight.toFixed(3)} g
                ({head.deductedPercent.toFixed(2)}%) of the gross taken in.
              </p>
            </Panel>

            <Panel title="Claimed vs Tested Purity">
              {gap.comparableLots === 0 ? (
                <p className={`p-6 text-center text-[11px] ${mutedCls}`}>
                  No lot in this period recorded what the customer claimed, so there is nothing to
                  compare. Lots without a claim are never assumed to agree with the test.
                </p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-3">
                  {[
                    { label: 'Avg Claimed', value: `${gap.averageClaimed.toFixed(2)}%` },
                    { label: 'Avg Tested', value: `${gap.averageTested.toFixed(2)}%` },
                    { label: 'Gap', value: `${gap.averageGap > 0 ? '+' : ''}${gap.averageGap.toFixed(2)} pts`,
                      warn: gap.averageGap < 0 },
                    { label: 'Materially Overclaimed', value: String(gap.materiallyOverclaimed),
                      warn: gap.materiallyOverclaimed > 0 },
                  ].map(k => (
                    <div key={k.label} className={`p-3 rounded-xl border text-center ${
                      k.warn ? 'border-rose-500/40 bg-rose-500/5'
                        : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
                    }`}>
                      <p className={`text-base font-black font-mono ${k.warn ? 'text-rose-500' : ''}`}>{k.value}</p>
                      <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {gap.lotsWithoutClaim > 0 && (
                <p className={`px-3 pb-3 text-[10px] ${mutedCls}`}>
                  {gap.lotsWithoutClaim} lot(s) recorded no claim and are excluded from the average
                  rather than counted as agreeing — folding them in at parity would drag the gap
                  toward zero and hide what this measures.
                </p>
              )}
            </Panel>

            <Panel title="Intake by Purity Band">
              <Table head={['Band', 'Lots', 'Gross Weight', 'Value', 'Share']}
                rows={intakeByPurityBand(lots).map(b =>
                  [b.label, b.lots, `${b.grossWeight.toFixed(3)}g`, money(b.value), `${b.sharePercent.toFixed(1)}%`])} />
            </Panel>

            <Panel title="Melting Loss Trend">
              <Table head={['Month', 'Lots Melted', 'Expected Fine', 'Recovered', 'Loss %']}
                rows={meltingLossTrend(lots).map(m =>
                  [m.month, m.lots, `${m.expectedFine.toFixed(3)}g`, `${m.recoveredFine.toFixed(3)}g`, `${m.lossPercent.toFixed(2)}%`])} />
              <p className={`px-3 pt-2 text-[10px] ${mutedCls}`}>
                Only lots actually melted appear. A lot still in the safe has no loss yet, and
                counting it as zero would understate the real refining loss.
              </p>
            </Panel>

            <Panel title="Vault Holdings by State">
              <Table head={['State', 'Lots', 'Gross Weight', 'Value']}
                rows={vaultByState(lots).map(v =>
                  [v.label, v.lots, `${v.grossWeight.toFixed(3)}g`, money(v.value)])} />
            </Panel>

            <Panel title="Buyback Reconciliation">
              <div className="p-3 space-y-2">
                {buybackChecks.map(c => (
                  <div key={c.label} className="flex items-start gap-2.5 text-[11px]">
                    {c.passes
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-rose-500" />}
                    <span className="flex-1">
                      {c.label}
                      <span className={`block font-mono text-[10px] ${mutedCls}`}>{c.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );
      })()}

      <div className={`p-3 rounded-xl border flex gap-2.5 ${
        dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'
      }`}>
        <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
        <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
          <span className="font-bold">Not yet here:</span> a full Audit Log viewer. Milestone 50
          added a real event store, so events are now recorded as they happen rather than
          reconstructed — but it holds only recent activity in this browser, which is a
          notification feed rather than a complete audit trail. GST returns live on the Billing
          screen (GSTR-1/3B); the ITC register and HSN summary are on the GST Registers tab above.
        </p>
      </div>
    </div>
  );
}
