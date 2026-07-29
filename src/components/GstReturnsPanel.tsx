import { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { SaleInvoice, Customer, Branch, TaxRate } from '../types';
import {
  availablePeriods,
  periodLabel,
  filterByPeriod,
  buildB2B,
  buildB2CS,
  buildCreditNotes,
  buildHsnSummary,
  buildGstr3b,
  reconcile,
  gstr1Csv,
  gstr3bCsv,
  downloadCsv,
} from '../lib/gstReturns';

interface GstReturnsPanelProps {
  invoices: SaleInvoice[];
  customers: Customer[];
  activeBranch: Branch | null;
  taxRates: TaxRate[];
}

export default function GstReturnsPanel({
  invoices,
  customers,
  activeBranch,
  taxRates,
}: GstReturnsPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const periods = useMemo(() => availablePeriods(invoices), [invoices]);
  const [period, setPeriod] = useState(() => periods[0] ?? new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<'GSTR1' | 'GSTR3B'>('GSTR1');

  const cardCls = dark ? 'bg-[#141416] border-[#262626]' : 'bg-white border-slate-150';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const bodyCls = dark ? 'text-zinc-300' : 'text-slate-700';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const homeState = activeBranch?.stateCode ?? '27';
  const gstin = activeBranch?.gstin ?? '';

  // A buyer is B2B only if they carry a GSTIN — not by transaction size.
  const gstinOf = (inv: SaleInvoice): string | undefined =>
    inv.customerId ? customers.find(c => c.id === inv.customerId)?.gstin : undefined;

  const periodInvoices = useMemo(() => filterByPeriod(invoices, period), [invoices, period]);
  const b2b = useMemo(() => buildB2B(periodInvoices, gstinOf), [periodInvoices, customers]);
  const b2cs = useMemo(() => buildB2CS(periodInvoices, gstinOf, homeState), [periodInvoices, customers, homeState]);
  const creditNotes = useMemo(() => buildCreditNotes(periodInvoices, gstinOf), [periodInvoices, customers]);
  const hsn = useMemo(() => buildHsnSummary(periodInvoices, taxRates), [periodInvoices, taxRates]);
  const summary = useMemo(() => buildGstr3b(periodInvoices), [periodInvoices]);
  const check = useMemo(() => reconcile(periodInvoices, summary), [periodInvoices, summary]);

  const money = (n: number) => `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN')}`;

  const handleExport = () => {
    if (view === 'GSTR1') {
      downloadCsv(`GSTR1_${gstin || 'shop'}_${period}.csv`, gstr1Csv({ b2b, b2cs, creditNotes, hsn }, period, gstin));
    } else {
      downloadCsv(`GSTR3B_${gstin || 'shop'}_${period}.csv`, gstr3bCsv(summary, period, gstin));
    }
  };

  const Th = ({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) => (
    <th className={`py-2.5 px-3 text-${align}`}>{children}</th>
  );

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              GST Returns — GSTR-1 & GSTR-3B
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Read-only previews derived from the invoice register (PRD §9.6). Estimates are excluded —
              a quotation is not a supply. No filing API; export the CSV for the offline utility.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className={`text-xs font-mono px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
            >
              {periods.length === 0 && <option value={period}>{periodLabel(period)}</option>}
              {periods.map(p => (
                <option key={p} value={p}>{periodLabel(p)}</option>
              ))}
            </select>
            <div className={`inline-flex rounded-lg border overflow-hidden ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
              {(['GSTR1', 'GSTR3B'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-2 text-xs font-bold transition ${
                    view === v
                      ? 'bg-[#C5A059] text-[#0A0A0B]'
                      : dark ? 'text-zinc-400 hover:bg-zinc-900' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {v === 'GSTR1' ? 'GSTR-1' : 'GSTR-3B'}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation against the register — the acceptance criterion for this milestone. */}
      <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
        check.balanced
          ? dark ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50/60 border-emerald-100'
          : dark ? 'bg-rose-950/20 border-rose-900/40' : 'bg-rose-50/60 border-rose-100'
      }`}>
        {check.balanced
          ? <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`} />
          : <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${dark ? 'text-rose-400' : 'text-rose-600'}`} />}
        <p className={`text-[11px] leading-relaxed ${
          check.balanced
            ? dark ? 'text-emerald-200/90' : 'text-emerald-900'
            : dark ? 'text-rose-200/90' : 'text-rose-900'
        }`}>
          {check.balanced ? (
            <>
              <span className="font-bold">Reconciled.</span> Return tax {money(check.returnTax)} equals the
              register for {periodLabel(period)}, on a taxable value of {money(check.returnTaxable)} across{' '}
              {summary.invoiceCount} invoice(s) and {summary.creditNoteCount} credit note(s).
            </>
          ) : (
            <>
              <span className="font-bold">Does not reconcile.</span> The register totals {money(check.registerTax)} tax
              but the return computes {money(check.returnTax)} — a difference of {money(check.taxDifference)}. A
              document's CGST/SGST/IGST components disagree with its own tax total; filing this would misstate the
              return.
            </>
          )}
        </p>
      </div>

      {periodInvoices.length === 0 && (
        <div className={`p-10 rounded-2xl border text-center ${cardCls}`}>
          <Info className={`w-5 h-5 mx-auto mb-2 ${mutedCls}`} />
          <p className={`text-xs ${mutedCls}`}>
            No tax invoices or credit notes in {periodLabel(period)}. Nothing to file for this period.
          </p>
        </div>
      )}

      {periodInvoices.length > 0 && view === 'GSTR3B' && (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
          <div className={`px-5 py-3 border-b ${rowCls}`}>
            <p className={`text-xs font-bold ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
              3.1 — Details of Outward Supplies
            </p>
            <p className={`text-[10px] ${mutedCls}`}>Net of credit notes, as 3.1(a) reports.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                <tr>
                  <Th>Nature of Supply</Th>
                  <Th align="right">Taxable Value</Th>
                  <Th align="right">IGST</Th>
                  <Th align="right">CGST</Th>
                  <Th align="right">SGST</Th>
                </tr>
              </thead>
              <tbody className={bodyCls}>
                <tr className={`border-b ${rowCls}`}>
                  <td className="py-3 px-3">(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                  <td className="py-3 px-3 text-right font-mono font-bold">{money(summary.taxableValue)}</td>
                  <td className="py-3 px-3 text-right font-mono">{money(summary.igst)}</td>
                  <td className="py-3 px-3 text-right font-mono">{money(summary.cgst)}</td>
                  <td className="py-3 px-3 text-right font-mono">{money(summary.sgst)}</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-bold">Total tax payable</td>
                  <td colSpan={4} className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-[#C5A059]">
                    {money(summary.totalTax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {periodInvoices.length > 0 && view === 'GSTR1' && (
        <div className="space-y-6">
          <ReturnTable
            title="4A — B2B Invoices"
            note="Registered buyers, reported invoice by invoice so they can claim input credit."
            empty="No B2B supplies this period."
            rows={b2b.length}
            {...{ cardCls, rowCls, mutedCls, bodyCls, dark }}
            head={<tr><Th>GSTIN</Th><Th>Receiver</Th><Th>Invoice</Th><Th>Date</Th><Th align="right">Invoice Value</Th><Th align="center">PoS</Th><Th align="right">Taxable</Th><Th align="right">CGST</Th><Th align="right">SGST</Th><Th align="right">IGST</Th></tr>}
          >
            {b2b.map(r => (
              <tr key={r.invoiceNumber} className={`border-b last:border-0 ${rowCls}`}>
                <td className="py-3 px-3 font-mono text-[10px]">{r.gstin}</td>
                <td className="py-3 px-3 font-bold">{r.customerName}</td>
                <td className="py-3 px-3 font-mono text-amber-600 dark:text-[#C5A059]">{r.invoiceNumber}</td>
                <td className={`py-3 px-3 font-mono text-[10px] ${mutedCls}`}>{r.date}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.invoiceValue)}</td>
                <td className="py-3 px-3 text-center font-mono">{r.placeOfSupply}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.taxableValue)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.cgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.sgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.igst)}</td>
              </tr>
            ))}
          </ReturnTable>

          <ReturnTable
            title="7 — B2C (Small), consolidated"
            note="Unregistered buyers, grouped by place of supply and rate rather than listed individually."
            empty="No B2C supplies this period."
            rows={b2cs.length}
            {...{ cardCls, rowCls, mutedCls, bodyCls, dark }}
            head={<tr><Th align="center">Place of Supply</Th><Th align="center">Rate</Th><Th align="right">Taxable</Th><Th align="right">CGST</Th><Th align="right">SGST</Th><Th align="right">IGST</Th><Th align="center">Invoices</Th></tr>}
          >
            {b2cs.map(r => (
              <tr key={`${r.placeOfSupply}-${r.ratePercent}`} className={`border-b last:border-0 ${rowCls}`}>
                <td className="py-3 px-3 text-center font-mono">{r.placeOfSupply}</td>
                <td className="py-3 px-3 text-center font-mono">{r.ratePercent}%</td>
                <td className="py-3 px-3 text-right font-mono font-bold">{money(r.taxableValue)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.cgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.sgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.igst)}</td>
                <td className={`py-3 px-3 text-center font-mono ${mutedCls}`}>{r.invoiceCount}</td>
              </tr>
            ))}
          </ReturnTable>

          <ReturnTable
            title="9B — Credit Notes"
            note="Shown as positive magnitudes; the portal applies the sign. Filing these negative would double-subtract them."
            empty="No credit notes this period."
            rows={creditNotes.length}
            {...{ cardCls, rowCls, mutedCls, bodyCls, dark }}
            head={<tr><Th>Note No.</Th><Th>Date</Th><Th>Against Invoice</Th><Th>Receiver</Th><Th align="right">Note Value</Th><Th align="right">Taxable</Th><Th align="right">CGST</Th><Th align="right">SGST</Th><Th align="right">IGST</Th></tr>}
          >
            {creditNotes.map(r => (
              <tr key={r.noteNumber} className={`border-b last:border-0 ${rowCls}`}>
                <td className="py-3 px-3 font-mono text-rose-600 dark:text-rose-400">{r.noteNumber}</td>
                <td className={`py-3 px-3 font-mono text-[10px] ${mutedCls}`}>{r.date}</td>
                <td className="py-3 px-3 font-mono text-[10px]">{r.againstInvoice}</td>
                <td className="py-3 px-3 font-bold">{r.customerName}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.noteValue)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.taxableValue)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.cgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.sgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.igst)}</td>
              </tr>
            ))}
          </ReturnTable>

          <ReturnTable
            title="12 — HSN Summary"
            note="Bill-level discounts are apportioned across lines, so this ties back to the return total."
            empty="No lines to summarise this period."
            rows={hsn.length}
            {...{ cardCls, rowCls, mutedCls, bodyCls, dark }}
            head={<tr><Th>HSN</Th><Th>Description</Th><Th align="center">Rate</Th><Th align="right">Taxable</Th><Th align="right">CGST</Th><Th align="right">SGST</Th><Th align="right">IGST</Th></tr>}
          >
            {hsn.map(r => (
              <tr key={r.hsnCode} className={`border-b last:border-0 ${rowCls}`}>
                <td className="py-3 px-3 font-mono font-bold text-amber-600 dark:text-[#C5A059]">{r.hsnCode}</td>
                <td className="py-3 px-3">{r.description}</td>
                <td className="py-3 px-3 text-center font-mono">{r.ratePercent}%</td>
                <td className="py-3 px-3 text-right font-mono font-bold">{money(r.taxableValue)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.cgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.sgst)}</td>
                <td className="py-3 px-3 text-right font-mono">{money(r.igst)}</td>
              </tr>
            ))}
          </ReturnTable>
        </div>
      )}
    </div>
  );
}

function ReturnTable({
  title, note, empty, rows, head, children, cardCls, rowCls, mutedCls, bodyCls,
}: {
  title: string; note: string; empty: string; rows: number;
  head: React.ReactNode; children: React.ReactNode;
  cardCls: string; rowCls: string; mutedCls: string; bodyCls: string; dark: boolean;
}) {
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
      <div className={`px-5 py-3 border-b ${rowCls}`}>
        <p className="text-xs font-bold">{title}</p>
        <p className={`text-[10px] ${mutedCls}`}>{note}</p>
      </div>
      {rows === 0 ? (
        <p className={`py-8 text-center text-xs ${mutedCls}`}>{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>{head}</thead>
            <tbody className={bodyCls}>{children}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
