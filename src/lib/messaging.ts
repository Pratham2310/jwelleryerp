/**
 * Outbound Notification Channels (Milestone 61, PRD §14.10).
 *
 * Milestone 50 built the event store — things that happened, shown to the *operator*. This reaches
 * the *customer*: the order is ready, the scheme instalment is due, the memo is overdue.
 *
 * Still **simulated**: dispatch is logged, not sent, until a server holds the provider
 * credentials. What is real is the shape and the rules, because both of the rules below are
 * compliance failures rather than delivery failures, and retro-fitting them is expensive.
 *
 * ─── Consent is per channel, and it must be recorded ──────────────────────────────────
 * India's TRAI framework requires SMS to go on **DLT-registered templates** to consenting
 * recipients; WhatsApp requires explicit opt-in and a template approved by Meta. Sending without
 * either is not a bounced message — it is a regulatory breach and, for WhatsApp, the fastest way
 * to lose the business number.
 *
 * So consent is stored per channel, not per customer: agreeing to a WhatsApp order update is not
 * agreement to marketing SMS. A recipient with no recorded consent is **never queued** — the
 * message is refused at build time rather than filtered at send time, because a queue that
 * contains messages it must not send will eventually send them.
 *
 * ─── A template is not a string ───────────────────────────────────────────────────────
 * Both channels require the *template* to be registered in advance and the message to be an
 * exact render of it with variables substituted. Free text cannot be sent at all, so templates
 * are declared here with their variables and their registration id.
 */

export type MessageChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';

export const CHANNEL_LABEL: Record<MessageChannel, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  EMAIL: 'Email',
};

/** Channels that legally require a pre-registered template in India. */
export const TEMPLATE_REGULATED: MessageChannel[] = ['WHATSAPP', 'SMS'];

export type TemplateKey =
  | 'ORDER_READY'
  | 'SCHEME_INSTALMENT_DUE'
  | 'MEMO_OVERDUE'
  | 'REPAIR_READY'
  | 'RATE_ALERT'
  | 'PAYMENT_RECEIPT';

export interface MessageTemplate {
  key: TemplateKey;
  name: string;
  channels: MessageChannel[];
  /** DLT id for SMS / Meta template name for WhatsApp. Absent means it cannot legally be sent. */
  registrationId?: string;
  body: string;
  variables: string[];
  /** Transactional messages may go to any consenting recipient; promotional need opt-in and hours. */
  isPromotional: boolean;
}

export const TEMPLATES: MessageTemplate[] = [
  {
    key: 'ORDER_READY', name: 'Order ready for collection',
    channels: ['WHATSAPP', 'SMS'], registrationId: 'DLT-1207161234567890123',
    body: 'Namaste {{name}}, your order {{orderNo}} is ready for collection at {{branch}}. Balance due {{balance}}.',
    variables: ['name', 'orderNo', 'branch', 'balance'], isPromotional: false,
  },
  {
    key: 'REPAIR_READY', name: 'Repair ready for collection',
    channels: ['WHATSAPP', 'SMS'], registrationId: 'DLT-1207161234567890124',
    body: 'Namaste {{name}}, your repair {{jobNo}} is ready at {{branch}}. Charge {{amount}}.',
    variables: ['name', 'jobNo', 'branch', 'amount'], isPromotional: false,
  },
  {
    key: 'SCHEME_INSTALMENT_DUE', name: 'Savings scheme instalment due',
    channels: ['WHATSAPP', 'SMS'], registrationId: 'DLT-1207161234567890125',
    body: 'Namaste {{name}}, instalment {{number}} of your {{scheme}} is due on {{dueDate}}.',
    variables: ['name', 'number', 'scheme', 'dueDate'], isPromotional: false,
  },
  {
    key: 'MEMO_OVERDUE', name: 'Approval items overdue',
    channels: ['WHATSAPP', 'SMS'], registrationId: 'DLT-1207161234567890126',
    body: 'Namaste {{name}}, the pieces on memo {{memoNo}} were due back on {{dueDate}}. Kindly return or confirm purchase.',
    variables: ['name', 'memoNo', 'dueDate'], isPromotional: false,
  },
  {
    key: 'PAYMENT_RECEIPT', name: 'Payment received',
    channels: ['WHATSAPP', 'SMS'], registrationId: 'DLT-1207161234567890127',
    body: 'Namaste {{name}}, we have received {{amount}} against {{invoiceNo}}. Thank you.',
    variables: ['name', 'amount', 'invoiceNo'], isPromotional: false,
  },
  {
    key: 'RATE_ALERT', name: 'Daily gold rate',
    // Deliberately has no registrationId: a promotional broadcast may not be sent until the
    // template is registered, and pretending otherwise would be the compliance failure.
    channels: ['WHATSAPP'],
    body: 'Namaste {{name}}, today at {{branch}}: 22K gold {{rate22}}/g. Visit us for the latest designs.',
    variables: ['name', 'branch', 'rate22'], isPromotional: true,
  },
];

export function templateFor(key: TemplateKey): MessageTemplate | undefined {
  return TEMPLATES.find(t => t.key === key);
}

/* ─────────────────────────────── Consent ─────────────────────────────── */

export interface ChannelConsent {
  customerId: string;
  channel: MessageChannel;
  granted: boolean;
  /** Promotional consent is separate: transactional consent does not imply marketing consent. */
  promotionalGranted: boolean;
  recordedOn: string;
  /** How it was obtained — a bare boolean is not evidence. */
  source: string;
}

export function consentFor(
  consents: ChannelConsent[],
  customerId: string,
  channel: MessageChannel
): ChannelConsent | undefined {
  return consents.find(c => c.customerId === customerId && c.channel === channel);
}

export function hasConsent(
  consents: ChannelConsent[],
  customerId: string,
  channel: MessageChannel,
  promotional: boolean
): boolean {
  const c = consentFor(consents, customerId, channel);
  if (!c || !c.granted) return false;
  return promotional ? c.promotionalGranted : true;
}

/* ─────────────────────────────── Rendering ─────────────────────────────── */

export function renderTemplate(
  template: MessageTemplate,
  values: Record<string, string>
): { body: string; missing: string[] } {
  const missing = template.variables.filter(v => !values[v]?.trim());
  const body = template.body.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
  return { body, missing };
}

/* ─────────────────────────────── Queueing ─────────────────────────────── */

export type DeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BLOCKED';

export interface OutboundMessage {
  id: string;
  channel: MessageChannel;
  templateKey: TemplateKey;
  customerId: string;
  recipient: string;
  body: string;
  status: DeliveryStatus;
  queuedAt: string;
  sentAt?: string;
  failureReason?: string;
  registrationId?: string;
}

export interface QueueRequest {
  channel: MessageChannel;
  templateKey: TemplateKey;
  customerId: string;
  customerName: string;
  recipient: string;
  values: Record<string, string>;
}

/**
 * Refuses to queue rather than filtering at send time. A queue holding messages it must not send
 * will eventually send them — after a retry, a replay, or a well-meaning "flush the queue" button.
 */
export function validateQueue(
  request: QueueRequest,
  consents: ChannelConsent[]
): string | null {
  const template = templateFor(request.templateKey);
  if (!template) return 'That template does not exist.';

  if (!template.channels.includes(request.channel)) {
    return `${template.name} is not registered for ${CHANNEL_LABEL[request.channel]}.`;
  }

  if (TEMPLATE_REGULATED.includes(request.channel) && !template.registrationId) {
    return `${template.name} has no DLT/WhatsApp registration. It cannot legally be sent on `
      + `${CHANNEL_LABEL[request.channel]} until it is registered.`;
  }

  if (!hasConsent(consents, request.customerId, request.channel, template.isPromotional)) {
    return template.isPromotional
      ? `${request.customerName} has not opted in to promotional messages on ${CHANNEL_LABEL[request.channel]}.`
      : `${request.customerName} has no recorded consent for ${CHANNEL_LABEL[request.channel]}.`;
  }

  if (!request.recipient?.trim()) return 'No phone number or address on file to send to.';

  const { missing } = renderTemplate(template, request.values);
  if (missing.length > 0) {
    // A half-rendered template reaching a customer reads as broken software.
    return `Template values missing: ${missing.join(', ')}.`;
  }
  return null;
}

export function buildMessage(
  request: QueueRequest,
  at: string = new Date().toISOString()
): OutboundMessage {
  const template = templateFor(request.templateKey)!;
  const { body } = renderTemplate(template, request.values);
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channel: request.channel,
    templateKey: request.templateKey,
    customerId: request.customerId,
    recipient: request.recipient.trim(),
    body,
    status: 'QUEUED',
    queuedAt: at,
    registrationId: template.registrationId,
  };
}

/**
 * Simulated dispatch. Marks the message sent and records when — it never leaves the browser, and
 * the panel says so rather than implying delivery.
 */
export function markSent(
  message: OutboundMessage,
  at: string = new Date().toISOString()
): OutboundMessage {
  return { ...message, status: 'SENT', sentAt: at };
}

export function markFailed(message: OutboundMessage, reason: string): OutboundMessage {
  return { ...message, status: 'FAILED', failureReason: reason };
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface MessagingSummary {
  queued: number;
  sent: number;
  failed: number;
  blocked: number;
  byChannel: { channel: MessageChannel; count: number }[];
  consentingCustomers: number;
}

export function summariseMessaging(
  messages: OutboundMessage[],
  consents: ChannelConsent[]
): MessagingSummary {
  const channels: MessageChannel[] = ['WHATSAPP', 'SMS', 'EMAIL'];
  return {
    queued: messages.filter(m => m.status === 'QUEUED').length,
    sent: messages.filter(m => m.status === 'SENT' || m.status === 'DELIVERED').length,
    failed: messages.filter(m => m.status === 'FAILED').length,
    blocked: messages.filter(m => m.status === 'BLOCKED').length,
    byChannel: channels
      .map(channel => ({ channel, count: messages.filter(m => m.channel === channel).length }))
      .filter(c => c.count > 0),
    consentingCustomers: new Set(
      consents.filter(c => c.granted).map(c => c.customerId)
    ).size,
  };
}

export interface MessagingReadiness {
  ready: boolean;
  blockers: string[];
  unregisteredTemplates: string[];
}

export function messagingReadiness(): MessagingReadiness {
  const unregistered = TEMPLATES
    .filter(t => t.channels.some(c => TEMPLATE_REGULATED.includes(c)) && !t.registrationId)
    .map(t => t.name);

  return {
    ready: false,
    blockers: [
      'No WhatsApp Business Solution Provider account is configured.',
      'No SMS gateway or DLT principal-entity registration is configured.',
      'Dispatch is simulated — messages are logged locally and never sent.',
    ],
    unregisteredTemplates: unregistered,
  };
}
