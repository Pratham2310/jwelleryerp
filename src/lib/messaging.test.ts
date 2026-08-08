import { describe, it, expect } from 'vitest';
import {
  TEMPLATES,
  TEMPLATE_REGULATED,
  CHANNEL_LABEL,
  templateFor,
  consentFor,
  hasConsent,
  renderTemplate,
  validateQueue,
  buildMessage,
  markSent,
  markFailed,
  summariseMessaging,
  messagingReadiness,
  type ChannelConsent,
  type QueueRequest,
} from './messaging';

const consent = (over: Partial<ChannelConsent> = {}): ChannelConsent => ({
  customerId: 'c1', channel: 'WHATSAPP', granted: true, promotionalGranted: false,
  recordedOn: '2026-08-01', source: 'Signed at counter',
  ...over,
});

const request = (over: Partial<QueueRequest> = {}): QueueRequest => ({
  channel: 'WHATSAPP',
  templateKey: 'ORDER_READY',
  customerId: 'c1',
  customerName: 'Sharda Sharma',
  recipient: '9876543210',
  values: { name: 'Sharda', orderNo: 'ORD-2026-1', branch: 'Mumbai BST', balance: '₹20,000' },
  ...over,
});

describe('templates', () => {
  it('declares its variables and registration', () => {
    const t = templateFor('ORDER_READY')!;
    expect(t.variables).toContain('orderNo');
    expect(t.registrationId).toMatch(/^DLT-/);
  });

  it('renders variables into the body', () => {
    const t = templateFor('ORDER_READY')!;
    const { body, missing } = renderTemplate(t, request().values);
    expect(body).toContain('ORD-2026-1');
    expect(body).not.toContain('{{');
    expect(missing).toEqual([]);
  });

  it('reports missing variables rather than rendering a half-filled message', () => {
    const t = templateFor('ORDER_READY')!;
    const { missing } = renderTemplate(t, { name: 'Sharda' });
    expect(missing).toEqual(['orderNo', 'branch', 'balance']);
  });

  it('ships the promotional rate alert WITHOUT a registration id', () => {
    // Deliberate: it may not be sent until registered, and pretending otherwise is the
    // compliance failure this milestone exists to prevent.
    expect(templateFor('RATE_ALERT')!.registrationId).toBeUndefined();
    expect(templateFor('RATE_ALERT')!.isPromotional).toBe(true);
  });

  it('labels every channel and marks the two that are template-regulated', () => {
    expect(Object.keys(CHANNEL_LABEL)).toHaveLength(3);
    expect(TEMPLATE_REGULATED).toEqual(['WHATSAPP', 'SMS']);
  });
});

describe('consent is per channel', () => {
  const consents = [consent({ channel: 'WHATSAPP' })];

  it('finds consent for the channel it was given for', () => {
    expect(consentFor(consents, 'c1', 'WHATSAPP')).toBeDefined();
    expect(consentFor(consents, 'c1', 'SMS')).toBeUndefined();
  });

  it('does NOT let WhatsApp consent authorise SMS', () => {
    // Agreeing to a WhatsApp order update is not agreement to marketing SMS.
    expect(hasConsent(consents, 'c1', 'WHATSAPP', false)).toBe(true);
    expect(hasConsent(consents, 'c1', 'SMS', false)).toBe(false);
  });

  it('does NOT let transactional consent authorise promotional', () => {
    expect(hasConsent(consents, 'c1', 'WHATSAPP', true)).toBe(false);
    const promo = [consent({ promotionalGranted: true })];
    expect(hasConsent(promo, 'c1', 'WHATSAPP', true)).toBe(true);
  });

  it('treats a revoked consent as no consent', () => {
    expect(hasConsent([consent({ granted: false })], 'c1', 'WHATSAPP', false)).toBe(false);
  });
});

describe('validateQueue refuses rather than filtering later', () => {
  const consents = [consent()];

  it('accepts a consented transactional message', () => {
    expect(validateQueue(request(), consents)).toBeNull();
  });

  it('REFUSES with no recorded consent', () => {
    // A queue that holds messages it must not send will eventually send them.
    expect(validateQueue(request(), [])).toMatch(/no recorded consent for WhatsApp/i);
  });

  it('refuses a promotional message without promotional opt-in, naming it as such', () => {
    const promoConsent = [consent({ promotionalGranted: false })];
    expect(validateQueue(request({ templateKey: 'RATE_ALERT', values: { name: 'S', branch: 'M', rate22: '₹6,650' } }), promoConsent))
      .toMatch(/has no DLT\/WhatsApp registration|not opted in to promotional/i);
  });

  it('REFUSES a regulated channel when the template is unregistered', () => {
    const promo = [consent({ promotionalGranted: true })];
    expect(validateQueue(
      request({ templateKey: 'RATE_ALERT', values: { name: 'S', branch: 'M', rate22: '₹6,650' } }),
      promo
    )).toMatch(/cannot legally be sent/i);
  });

  it('refuses a template not registered for the requested channel', () => {
    const smsConsent = [consent({ channel: 'EMAIL' })];
    expect(validateQueue(request({ channel: 'EMAIL' }), smsConsent))
      .toMatch(/not registered for Email/i);
  });

  it('refuses when template values are missing', () => {
    expect(validateQueue(request({ values: { name: 'Sharda' } }), consents))
      .toMatch(/values missing: orderNo, branch, balance/i);
  });

  it('refuses with no recipient on file', () => {
    expect(validateQueue(request({ recipient: '  ' }), consents)).toMatch(/no phone number or address/i);
  });

  it('refuses an unknown template', () => {
    expect(validateQueue(request({ templateKey: 'NOPE' as never }), consents)).toMatch(/does not exist/i);
  });
});

describe('queueing and dispatch', () => {
  it('builds a fully rendered message carrying its registration id', () => {
    const m = buildMessage(request(), 'T');
    expect(m.status).toBe('QUEUED');
    expect(m.body).toContain('ORD-2026-1');
    expect(m.registrationId).toMatch(/^DLT-/);
  });

  it('marks sent with a timestamp', () => {
    const m = markSent(buildMessage(request(), 'T'), 'T2');
    expect(m).toMatchObject({ status: 'SENT', sentAt: 'T2' });
  });

  it('records why a send failed', () => {
    expect(markFailed(buildMessage(request(), 'T'), 'gateway down'))
      .toMatchObject({ status: 'FAILED', failureReason: 'gateway down' });
  });
});

describe('summariseMessaging', () => {
  const msgs = [
    buildMessage(request(), 'T'),
    markSent(buildMessage(request({ channel: 'SMS' }), 'T')),
    markFailed(buildMessage(request(), 'T'), 'x'),
  ];

  it('counts by status', () => {
    const s = summariseMessaging(msgs, [consent()]);
    expect(s.queued).toBe(1);
    expect(s.sent).toBe(1);
    expect(s.failed).toBe(1);
  });

  it('groups by channel, omitting unused ones', () => {
    const s = summariseMessaging(msgs, [consent()]);
    expect(s.byChannel.find(c => c.channel === 'WHATSAPP')?.count).toBe(2);
    expect(s.byChannel.find(c => c.channel === 'EMAIL')).toBeUndefined();
  });

  it('counts distinct consenting customers, not consents', () => {
    const many = [consent({ channel: 'WHATSAPP' }), consent({ channel: 'SMS' })];
    expect(summariseMessaging([], many).consentingCustomers).toBe(1);
  });

  it('handles an empty log', () => {
    expect(summariseMessaging([], [])).toMatchObject({ queued: 0, sent: 0, consentingCustomers: 0 });
  });
});

describe('messagingReadiness is honest', () => {
  it('is not ready, and names why', () => {
    const r = messagingReadiness();
    expect(r.ready).toBe(false);
    expect(r.blockers.join(' ')).toMatch(/simulated/i);
    expect(r.blockers.join(' ')).toMatch(/DLT/i);
  });

  it('lists templates that could not legally be sent today', () => {
    expect(messagingReadiness().unregisteredTemplates).toContain('Daily gold rate');
  });

  it('every transactional template IS registered', () => {
    const unregisteredTransactional = TEMPLATES.filter(t => !t.isPromotional && !t.registrationId);
    expect(unregisteredTransactional).toEqual([]);
  });
});
