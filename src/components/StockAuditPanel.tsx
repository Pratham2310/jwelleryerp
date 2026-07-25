import React, { useMemo, useState } from 'react';
import { ScanLine, AlertTriangle, CheckCircle2, RotateCcw, ClipboardCheck } from 'lucide-react';
import type { Tag } from '../types';
import { isSellable } from '../lib/tagStateMachine';
import { reconcileStockAudit, auditDiscrepancySummary } from '../lib/stockAudit';
import { useTheme } from '../contexts/ThemeContext';

// Physical Stock Audit / Reconciliation UI (Milestone 6). Staff scan or manually type each
// physical piece found in a tray; this reconciles the scanned sequence against the tags the
// system expects to be on-premises (InStock/InShowcase) and flags missing/extra pieces.
// Styling is explicitly theme-aware rather than relying on index.css's global dark-mode
// repaint, which KNOWN_ISSUES.md #12 already flags as not covering every ad hoc class combo.

export default function StockAuditPanel({ tags }: { tags: Tag[] }) {
  const { theme } = useTheme();
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [reportGenerated, setReportGenerated] = useState(false);

  const expectedTags = useMemo(() => tags.filter(t => isSellable(t.status)), [tags]);
  const result = useMemo(() => reconcileStockAudit(expectedTags, scannedCodes, tags), [expectedTags, scannedCodes, tags]);
  const summary = useMemo(() => auditDiscrepancySummary(result), [result]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;
    setScannedCodes(prev => [...prev, code]);
    setScanInput('');
  };

  const handleReset = () => {
    setScannedCodes([]);
    setReportGenerated(false);
  };

  const isClean = summary.missingCount === 0 && summary.extraCount === 0 && scannedCodes.length > 0;
  const dark = theme === 'dark';

  const cardCls = dark ? 'bg-[#141416] border-zinc-800 text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';
  const tileBaseCls = dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-100';

  return (
    <div className="space-y-6">
      <div className={`border p-5 rounded-2xl shadow-sm space-y-4 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold flex items-center gap-2"><ScanLine className="w-4.5 h-4.5 text-amber-500" /> Scan or Enter Tray Contents</h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>Scan a barcode/QR (or type a SKU/Tag ID) for every physical piece found in this tray, then compare against the {expectedTags.length} tags the system expects on-premises (In Stock / In Showcase).</p>
          </div>
          <button
            onClick={handleReset}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition ${dark ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Audit
          </button>
        </div>

        <form onSubmit={handleScan} className="flex gap-2">
          <input
            type="text"
            autoFocus
            placeholder="Scan barcode/QR or type SKU / Tag ID, then press Enter..."
            className={`flex-1 text-sm px-4 py-2.5 rounded-xl border focus:outline-none focus:border-amber-500 font-mono ${inputCls}`}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
          />
          <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-5 py-2.5 rounded-xl transition">
            Add Scan
          </button>
        </form>

        <div className="grid grid-cols-4 gap-3 pt-2">
          <div className={`p-3 rounded-xl border text-center ${tileBaseCls}`}>
            <p className="text-2xl font-black">{expectedTags.length}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${mutedCls}`}>Expected</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${dark ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className={`text-2xl font-black ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>{summary.matchedCount}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${dark ? 'text-emerald-500/80' : 'text-emerald-500'}`}>Matched</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${dark ? 'bg-red-950/30 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-2xl font-black ${dark ? 'text-red-400' : 'text-red-700'}`}>{summary.missingCount}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${dark ? 'text-red-500/80' : 'text-red-500'}`}>Missing</p>
          </div>
          <div className={`p-3 rounded-xl border text-center ${dark ? 'bg-orange-950/30 border-orange-900/50' : 'bg-orange-50 border-orange-100'}`}>
            <p className={`text-2xl font-black ${dark ? 'text-orange-400' : 'text-orange-700'}`}>{summary.extraCount}</p>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${dark ? 'text-orange-500/80' : 'text-orange-500'}`}>Extra / Unexpected</p>
          </div>
        </div>
      </div>

      {scannedCodes.length > 0 && (
        <div className={`border p-5 rounded-2xl shadow-sm space-y-4 ${cardCls}`}>
          {isClean ? (
            <div className={`flex items-center gap-2 font-bold text-sm ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              <CheckCircle2 className="w-5 h-5" /> Perfect reconciliation — every expected tag was scanned, nothing unexpected found.
            </div>
          ) : (
            <div className={`flex items-center gap-2 font-bold text-sm ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
              <AlertTriangle className="w-5 h-5" /> Discrepancies found — review before owner sign-off.
            </div>
          )}

          {result.missingTags.length > 0 && (
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark ? 'text-red-400' : 'text-red-500'}`}>Missing ({result.missingTags.length})</p>
              <div className="space-y-1.5">
                {result.missingTags.map(t => (
                  <div key={t.id} className={`flex justify-between text-xs border rounded-lg px-3 py-2 ${dark ? 'bg-red-950/20 border-red-900/40' : 'bg-red-50/60 border-red-100'}`}>
                    <span className="font-mono font-bold">{t.sku}</span>
                    <span className={mutedCls}>{t.name}</span>
                    <span className="font-mono">{t.netWeight.toFixed(2)}g</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.extraScans.length > 0 && (
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark ? 'text-orange-400' : 'text-orange-500'}`}>Extra / Unexpected ({result.extraScans.length})</p>
              <div className="space-y-1.5">
                {result.extraScans.map((e, idx) => (
                  <div key={idx} className={`flex justify-between text-xs border rounded-lg px-3 py-2 ${dark ? 'bg-orange-950/20 border-orange-900/40' : 'bg-orange-50/60 border-orange-100'}`}>
                    <span className="font-mono font-bold">{e.code}</span>
                    <span className={mutedCls}>{e.tag ? `${e.tag.name} — status: ${e.tag.status}` : 'Unknown code — no matching tag in system'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`pt-3 border-t flex items-center justify-between ${dark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <p className={`text-xs ${mutedCls}`}>
              Weight discrepancy: <span className={`font-mono font-bold ${dark ? 'text-red-400' : 'text-red-500'}`}>-{summary.missingWeight.toFixed(2)}g missing</span>,{' '}
              <span className={`font-mono font-bold ${dark ? 'text-orange-400' : 'text-orange-500'}`}>+{summary.extraWeight.toFixed(2)}g extra</span>
            </p>
            <button
              onClick={() => setReportGenerated(true)}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition ${dark ? 'bg-zinc-100 hover:bg-white text-black' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" /> Generate Discrepancy Report for Owner Sign-off
            </button>
          </div>

          {reportGenerated && (
            <div className={`border rounded-xl p-4 text-xs space-y-1.5 ${dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className="font-bold">Stock Audit Discrepancy Report — {new Date().toLocaleString('en-IN')}</p>
              <p className={mutedCls}>Expected: {expectedTags.length} pieces · Matched: {summary.matchedCount} · Missing: {summary.missingCount} ({summary.missingWeight.toFixed(2)}g) · Extra: {summary.extraCount} ({summary.extraWeight.toFixed(2)}g)</p>
              <p className={`italic ${mutedCls}`}>Prototype only — printing/owner e-signature capture is not wired to a backend.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
