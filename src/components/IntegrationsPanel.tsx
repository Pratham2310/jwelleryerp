import { useState } from 'react';
import { Plug, AlertTriangle, CheckCircle2, XCircle, Send, MessageSquare, FileCode } from 'lucide-react';
import type { SaleInvoice, Branch, Customer } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  buildIrpPayload, validateIrpPayload, idempotencyKey, gspReadiness,
} from '../lib/eInvoiceGsp';
import {
  TEMPLATES, CHANNEL_LABEL, TEMPLATE_REGULATED,
  validateQueue, buildMessage, markSent, summariseMessaging, messagingReadiness,
  type ChannelConsent, type OutboundMessage, type MessageChannel, type TemplateKey,
} from '../lib/messaging';

interface IntegrationsPanelProps {
  invoices: SaleInvoice[];
  customers: Customer[];
  activeBranch: Branch | null;
  consents: ChannelConsent[];
  setConsents: React.Dispatch<React.SetStateAction<ChannelConsent[]>>;
  messages: OutboundMessage[];
  setMessages: React.Dispatch<React.SetStateAction<OutboundMessage[]>>;
}

export default function IntegrationsPanel({
  invoices, customers, activeBranch, consents, setConsents, messages, setMessages,
}: IntegrationsPanelProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [section, setSection] = useState<'einvoice' | 'messaging'>('einvoice');
  const [queueError, setQueueError] = useState('');
  const [queueCustomer, setQueueCustomer] = useState('');
  const [queueChannel, setQueueChannel] = useState<MessageChannel>('WHATSAPP');
  const [queueTemplate, setQueueTemplate] = useState<TemplateKey>('ORDER_READY');

  const cardCls = dark ? 'bg-[#141416] border-[#262626] text-zinc-100' : 'bg-white border-slate-150 text-slate-900';
  const mutedCls = dark ? 'text-zinc-500' : 'text-slate-400';
  const rowCls = dark ? 'border-[#262626]' : 'border-slate-100';
  const inputCls = dark ? 'bg-zinc-950 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900';

  const gsp = gspReadiness(activeBranch);
  const msgReady = messagingReadiness();
  const msgSummary = summariseMessaging(messages, consents);

  /** Every fiscal invoice, checked against the rules the IRP itself enforces. */
  const irpChecks = activeBranch
    ? invoices
        .filter(i => i.invoiceType !== 'ESTIMATE')
        .slice(0, 25)
        .map(inv => {
          const buyer = customers.find(c => c.id === inv.customerId) ?? null;
          const payload = buildIrpPayload(inv, activeBranch, buyer);
          return {
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            key: idempotencyKey(activeBranch.gstin, inv),
            errors: validateIrpPayload(payload),
          };
        })
    : [];
  const rejectable = irpChecks.filter(c => c.errors.length > 0);

  const queue = () => {
    const customer = customers.find(c => c.id === queueCustomer);
    if (!customer) { setQueueError('Choose a customer.'); return; }

    const request = {
      channel: queueChannel,
      templateKey: queueTemplate,
      customerId: customer.id,
      customerName: customer.name,
      recipient: customer.phone,
      values: {
        name: customer.name.split(' ')[0],
        orderNo: 'ORD-2026-1', branch: activeBranch?.name ?? 'the shop', balance: '₹20,000',
        jobNo: 'REP-2026-1', amount: '₹800',
        number: '3', scheme: 'Swarna Nidhi', dueDate: '2026-09-01',
        memoNo: 'MEMO-2026-1', invoiceNo: 'MUM-2026-1001', rate22: '₹6,650',
      },
    };
    const err = validateQueue(request, consents);
    if (err) { setQueueError(err); return; }

    setMessages(prev => [markSent(buildMessage(request)), ...prev]);
    setQueueError('');
  };

  const toggleConsent = (customerId: string, channel: MessageChannel, promotional: boolean) => {
    setConsents(prev => {
      const existing = prev.find(c => c.customerId === customerId && c.channel === channel);
      if (!existing) {
        return [...prev, {
          customerId, channel, granted: true, promotionalGranted: promotional,
          recordedOn: new Date().toISOString().slice(0, 10), source: 'Recorded at counter',
        }];
      }
      return prev.map(c => c === existing
        ? promotional
          ? { ...c, promotionalGranted: !c.promotionalGranted }
          : { ...c, granted: !c.granted }
        : c);
    });
  };

  return (
    <div className="space-y-6">
      <div className={`flex gap-1 p-1 rounded-xl border w-fit ${
        dark ? 'bg-[#141416] border-[#262626]' : 'bg-white border-slate-150'
      }`}>
        {[
          { key: 'einvoice' as const, label: 'e-Invoice / GSP', icon: FileCode },
          { key: 'messaging' as const, label: 'Customer Messaging', icon: MessageSquare },
        ].map(t => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              section === t.key
                ? 'bg-[#C5A059] text-[#0A0A0B]'
                : dark ? 'text-zinc-400 hover:text-zinc-100' : 'text-slate-500 hover:text-slate-900'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {section === 'einvoice' && (
        <>
          <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Plug className="w-4 h-4 text-amber-500" /> e-Invoice / IRP Readiness
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              The payload, error handling, idempotency and retry policy are production-shaped. The
              connection is not.
            </p>

            <div className="mt-4 space-y-2">
              {gsp.blockers.map(b => (
                <p key={b} className="text-[11px] flex items-start gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{b}
                </p>
              ))}
            </div>

            <p className={`mt-3 text-[11px] leading-relaxed p-3 rounded-xl border ${
              dark ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400' : 'bg-slate-50/60 border-slate-150 text-slate-600'
            }`}>
              {gsp.note}{' '}
              <span className="font-bold">Duplicate IRN (error 2150) is treated as success</span>, not
              failure — a retry after a timeout must not tell a shop it has no e-invoice when it
              demonstrably does.
            </p>
          </div>

          <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
            <div className={`px-5 py-3 border-b ${rowCls}`}>
              <p className="text-xs font-bold flex items-center gap-2">
                Pre-flight Validation
                {rejectable.length === 0
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
              </p>
              <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
                Running the IRP's own checks locally turns a rejected submission into a message at
                the counter, where it can still be fixed.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                  <tr>
                    <th className="py-3 px-4">Invoice</th>
                    <th className="px-4">Idempotency Key</th>
                    <th className="px-4">Would the IRP accept it?</th>
                  </tr>
                </thead>
                <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                  {irpChecks.map(c => (
                    <tr key={c.invoiceNumber} className={`border-b last:border-0 ${rowCls} ${c.errors.length ? 'bg-rose-500/5' : ''}`}>
                      <td className="py-3 px-4 font-mono font-bold text-[11px]">
                        {c.invoiceNumber}
                        <span className={`block text-[9px] font-normal ${mutedCls}`}>{c.date}</span>
                      </td>
                      <td className={`px-4 font-mono text-[9px] ${mutedCls}`}>{c.key}</td>
                      <td className="px-4 text-[11px]">
                        {c.errors.length === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Accepted</span>
                        ) : (
                          c.errors.map(e => (
                            <span key={e} className="block text-rose-600 dark:text-rose-400">{e}</span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                  {irpChecks.length === 0 && (
                    <tr><td colSpan={3} className={`py-10 text-center ${mutedCls}`}>
                      No fiscal invoices to check.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'messaging' && (
        <>
          <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
            <h3 className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-500" /> Customer Messaging
            </h3>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Reaching the customer, not the operator. Dispatch is simulated — messages are logged,
              never sent.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Consenting Customers', value: String(msgSummary.consentingCustomers) },
                { label: 'Queued', value: String(msgSummary.queued) },
                { label: 'Sent (simulated)', value: String(msgSummary.sent), accent: msgSummary.sent > 0 },
                { label: 'Failed', value: String(msgSummary.failed), danger: msgSummary.failed > 0 },
              ].map(k => (
                <div key={k.label} className={`p-4 rounded-xl border text-center ${
                  k.danger ? 'border-rose-500/40 bg-rose-500/5'
                    : k.accent ? 'border-emerald-500/40 bg-emerald-500/5'
                    : dark ? 'border-[#262626] bg-zinc-900/30' : 'border-slate-150 bg-slate-50/60'
                }`}>
                  <p className={`text-lg font-black font-mono ${
                    k.danger ? 'text-rose-500' : k.accent ? 'text-emerald-600 dark:text-emerald-400' : ''
                  }`}>{k.value}</p>
                  <p className={`text-[9px] uppercase font-mono font-bold tracking-wider mt-0.5 ${mutedCls}`}>{k.label}</p>
                </div>
              ))}
            </div>

            <div className={`mt-4 p-3 rounded-xl border ${dark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-slate-50/60 border-slate-150'}`}>
              <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
                <span className="font-bold">Consent is per channel and must be recorded.</span> SMS
                requires DLT-registered templates; WhatsApp requires opt-in and an approved template.
                Sending without either is a regulatory breach, not a bounced message — so a recipient
                with no consent is <span className="font-bold">never queued</span>, refused at build
                time rather than filtered at send time.
              </p>
              {msgReady.unregisteredTemplates.length > 0 && (
                <p className="text-[11px] mt-2 font-semibold text-amber-700 dark:text-amber-300">
                  Not sendable until registered: {msgReady.unregisteredTemplates.join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
              <div className={`px-5 py-3 border-b ${rowCls}`}>
                <p className="text-xs font-bold">Templates</p>
              </div>
              <div className="p-4 space-y-2">
                {TEMPLATES.map(t => (
                  <div key={t.key} className={`p-3 rounded-xl border ${
                    t.registrationId ? (dark ? 'border-zinc-800' : 'border-slate-150')
                      : 'border-amber-500/40 bg-amber-500/5'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold">{t.name}</p>
                      <span className={`text-[9px] font-mono font-bold shrink-0 ${
                        t.registrationId ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {t.registrationId ? 'REGISTERED' : 'UNREGISTERED'}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-1 leading-relaxed ${mutedCls}`}>{t.body}</p>
                    <p className={`text-[9px] mt-1 font-mono ${mutedCls}`}>
                      {t.channels.map(c => CHANNEL_LABEL[c]).join(' · ')}
                      {t.isPromotional && ' · promotional'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
              <div className={`px-5 py-3 border-b ${rowCls}`}>
                <p className="text-xs font-bold">Consent Register</p>
                <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
                  Transactional consent does not imply marketing consent.
                </p>
              </div>
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                {customers.slice(0, 8).map(cust => (
                  <div key={cust.id} className={`p-2.5 rounded-xl border ${dark ? 'border-zinc-800' : 'border-slate-150'}`}>
                    <p className="text-[11px] font-bold">{cust.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(['WHATSAPP', 'SMS'] as MessageChannel[]).map(ch => {
                        const c = consents.find(x => x.customerId === cust.id && x.channel === ch);
                        return (
                          <span key={ch} className="flex gap-1">
                            <button onClick={() => toggleConsent(cust.id, ch, false)}
                              className={`px-2 py-0.5 rounded border text-[9px] font-bold transition ${
                                c?.granted
                                  ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                                  : `border-slate-200 dark:border-zinc-700 ${mutedCls}`
                              }`}>
                              {CHANNEL_LABEL[ch]}
                            </button>
                            <button onClick={() => toggleConsent(cust.id, ch, true)}
                              disabled={!c?.granted}
                              className={`px-2 py-0.5 rounded border text-[9px] font-bold transition disabled:opacity-30 ${
                                c?.promotionalGranted
                                  ? 'border-amber-500/50 text-amber-700 dark:text-amber-400'
                                  : `border-slate-200 dark:border-zinc-700 ${mutedCls}`
                              }`}>
                              promo
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border shadow-sm ${cardCls}`}>
            <p className="text-xs font-bold mb-3">Send a Message (simulated)</p>
            <div className="grid sm:grid-cols-4 gap-3">
              <select value={queueCustomer} aria-label="Message customer"
                onChange={e => { setQueueCustomer(e.target.value); setQueueError(''); }}
                className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                <option value="">Choose customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={queueChannel} aria-label="Message channel"
                onChange={e => { setQueueChannel(e.target.value as MessageChannel); setQueueError(''); }}
                className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                {(['WHATSAPP', 'SMS', 'EMAIL'] as MessageChannel[]).map(c => (
                  <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                ))}
              </select>
              <select value={queueTemplate} aria-label="Message template"
                onChange={e => { setQueueTemplate(e.target.value as TemplateKey); setQueueError(''); }}
                className={`text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-amber-500 ${inputCls}`}>
                {TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
              <button onClick={queue}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] hover:bg-[#B08D4A] text-[#0A0A0B] text-xs font-bold rounded-xl transition">
                <Send className="w-3.5 h-3.5" /> Queue
              </button>
            </div>
            {queueError && (
              <p className="mt-3 text-[11px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />{queueError}
              </p>
            )}
            <p className={`text-[10px] mt-2 ${mutedCls}`}>
              {TEMPLATE_REGULATED.map(c => CHANNEL_LABEL[c]).join(' and ')} both require a registered
              template. Email does not, but no template here is registered for it.
            </p>
          </div>

          <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
            <div className={`px-5 py-3 border-b ${rowCls}`}>
              <p className="text-xs font-bold">Delivery Log</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`uppercase font-mono text-[9px] border-b ${mutedCls} ${rowCls}`}>
                  <tr>
                    <th className="py-3 px-4">Queued</th>
                    <th className="px-4">Channel</th>
                    <th className="px-4">To</th>
                    <th className="px-4">Message</th>
                    <th className="px-4">Status</th>
                  </tr>
                </thead>
                <tbody className={dark ? 'text-zinc-300' : 'text-slate-700'}>
                  {messages.map(m => (
                    <tr key={m.id} className={`border-b last:border-0 ${rowCls}`}>
                      <td className={`py-3 px-4 font-mono text-[10px] ${mutedCls}`}>
                        {m.queuedAt.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="px-4 text-[11px] font-bold">{CHANNEL_LABEL[m.channel]}</td>
                      <td className={`px-4 font-mono text-[10px] ${mutedCls}`}>{m.recipient}</td>
                      <td className="px-4 text-[10px] max-w-md">{m.body}</td>
                      <td className="px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          m.status === 'FAILED' || m.status === 'BLOCKED'
                            ? 'text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : m.status === 'QUEUED'
                              ? 'text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {messages.length === 0 && (
                    <tr><td colSpan={5} className={`py-10 text-center ${mutedCls}`}>
                      Nothing sent yet.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
