import { useState } from 'react';
import { X, ShieldCheck, AlertTriangle, KeyRound } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { ApprovalRecord } from '../types';
import {
  APPROVAL_KIND_LABEL,
  validateApproval,
  verifySupervisorPin,
  buildApprovalRecord,
  type ApprovalRequest,
  type SupervisorPin,
} from '../lib/statutoryParameters';

interface SupervisorPinModalProps {
  request: ApprovalRequest;
  supervisors: SupervisorPin[];
  onApproved: (record: ApprovalRecord) => void;
  onClose: () => void;
}

/**
 * The second pair of eyes (Milestone 33). Permissions decide whether a role *may* discount;
 * this decides whether this particular discount *was authorised*, and by whom.
 */
export default function SupervisorPinModal({
  request, supervisors, onApproved, onClose,
}: SupervisorPinModalProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [pin, setPin] = useState('');
  const [reason, setReason] = useState(request.reason || '');
  const [error, setError] = useState('');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const submit = () => {
    const filled: ApprovalRequest = { ...request, reason };
    const err = validateApproval(filled, pin, supervisors);
    if (err) { setError(err); return; }

    const supervisor = verifySupervisorPin(pin, supervisors);
    if (!supervisor) { setError('That PIN was not recognised.'); return; }

    onApproved(buildApprovalRecord(filled, supervisor));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${cardCls}`}>
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" /> Supervisor Approval Required
            </h3>
            <p className={`text-[11px] mt-0.5 ${mutedCls}`}>
              {APPROVAL_KIND_LABEL[request.kind]} of ₹{Math.abs(request.amount).toLocaleString('en-IN')} is
              above the configured limit.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cancel approval"
            className={`p-1.5 rounded-lg transition ${dark ? 'hover:bg-zinc-900 text-zinc-500' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <label className="space-y-1 block">
            <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>
              Reason
            </span>
            <textarea
              value={reason}
              rows={2}
              placeholder="Why this is being approved"
              onChange={e => { setReason(e.target.value); setError(''); }}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
            />
          </label>

          <label className="space-y-1 block">
            <span className={`text-[10px] uppercase font-mono font-bold tracking-wider block ${mutedCls}`}>
              Supervisor PIN
            </span>
            <div className="relative">
              <KeyRound className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${mutedCls}`} />
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                aria-label="Supervisor PIN"
                onChange={e => { setPin(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                className={`w-full text-sm font-mono tracking-[0.4em] pl-9 pr-3 py-2.5 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}
              />
            </div>
          </label>

          <p className={`text-[10px] ${mutedCls}`}>
            Requested by {request.requestedBy} — a supervisor cannot approve their own request.
          </p>

          {error && (
            <p className="text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3 h-3 inline mr-1" />{error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl border transition ${
                dark ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}>
              Cancel
            </button>
            <button onClick={submit}
              className="flex-1 px-4 py-2.5 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
