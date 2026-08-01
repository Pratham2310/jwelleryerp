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

type Family = 'sales' | 'inventory' | 'customer' | 'karigar' | 'purchase' | 'branch';

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
}

const FAMILIES: { key: Family; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'customer', label: 'Customer' },
  { key: 'karigar', label: 'Karigar' },
  { key: 'branch', label: 'Branch' },
];

export default function ReportsHub({
  invoices, tags, customers, suppliers, karigars, karigarLedger,
  purchaseInvoices, branches, metalRates,
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

      <div className={`p-3 rounded-xl border flex gap-2.5 ${
        dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'
      }`}>
        <Info className={`w-4 h-4 shrink-0 mt-0.5 ${mutedCls}`} />
        <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
          <span className="font-bold">Not yet here:</span> the Audit Log viewer, which needs the
          event store from Milestone 50 — the app reconstructs activity from current records rather
          than logging events as they happen, so an audit trail built on it would silently omit
          anything since deleted. GST returns live on the Billing screen (GSTR-1/3B) and the ITC
          register lands in Milestone 52.
        </p>
      </div>
    </div>
  );
}
