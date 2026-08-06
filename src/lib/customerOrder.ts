/**
 * Customer Orders & Advances (Milestone 55, PRD §7.6).
 *
 * A customer orders a piece that does not exist yet — a custom necklace, a bangle in a size the
 * shop does not stock — and pays something up front. The shop makes it, often through a karigar,
 * and delivers weeks later.
 *
 * ─── The advance is a liability, never income ─────────────────────────────────────────
 * Money taken before goods are supplied is the customer's, held by the shop. Booking it as revenue
 * recognises a sale that has not happened, inflates the P&L, and creates tax on income not yet
 * earned. It posts `Dr Cash / Cr Customer Advance` — exactly the treatment scheme instalments get
 * in M26, and for exactly the same reason.
 *
 * ─── Rate basis is the dispute, and it must be explicit ───────────────────────────────
 * Gold moves daily. An order placed in August and delivered in October is priced at a rate nobody
 * agreed unless the basis was recorded at the time:
 *
 *   - `FIXED_AT_ORDER` — the rate is locked now. The shop carries the price risk: if gold rises
 *     it absorbs the difference. Customers ask for this in a rising market.
 *   - `AT_DELIVERY` — the market rate on the delivery date applies. The customer carries the risk.
 *
 * Neither is more correct; leaving it unrecorded is what causes the argument. So the field is
 * mandatory, the locked rate is stored with the order when it applies, and the delivery screen
 * shows the difference either way rather than quietly applying one.
 */

import { roundMoney, roundWeight } from './money';

export type OrderStatus =
  | 'Draft'
  | 'Confirmed'
  | 'InProduction'
  | 'Ready'
  | 'Delivered'
  | 'Cancelled';

export type OrderRateBasis = 'FIXED_AT_ORDER' | 'AT_DELIVERY';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  Draft: 'Draft',
  Confirmed: 'Confirmed',
  InProduction: 'In Production',
  Ready: 'Ready for Delivery',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

export const RATE_BASIS_LABEL: Record<OrderRateBasis, string> = {
  FIXED_AT_ORDER: 'Rate fixed at order',
  AT_DELIVERY: 'Rate at delivery',
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Draft: ['Confirmed', 'Cancelled'],
  Confirmed: ['InProduction', 'Ready', 'Cancelled'],
  InProduction: ['Ready', 'Cancelled'],
  Ready: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['Delivered', 'Cancelled'];

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextOrderStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** True while the shop owes the customer a piece — i.e. while the advance is still a liability. */
export function isOpenOrder(status: OrderStatus): boolean {
  return !TERMINAL_ORDER_STATUSES.includes(status);
}

export interface OrderAdvance {
  id: string;
  amountPaisa: number;
  receivedOn: string;
  mode: string;
  receivedBy: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  orderedOn: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;

  description: string;
  metalType: string;
  /** What the piece is expected to weigh. Actuals are known only once it is made. */
  estimatedWeightMg: number;
  estimatedMakingPaisa: number;
  estimatedStonePaisa: number;

  rateBasis: OrderRateBasis;
  /** Only meaningful when `rateBasis` is FIXED_AT_ORDER. Null otherwise, never 0. */
  lockedRatePerGramPaisa: number | null;

  /** Append-only. A refund is recorded on cancellation, not by deleting an advance. */
  advances: OrderAdvance[];

  expectedDeliveryDate?: string;
  karigarId?: string;
  status: OrderStatus;

  /** Set once, on conversion. Its presence is what makes a second conversion impossible. */
  convertedInvoiceNumber?: string;
  deliveredOn?: string;

  cancelledOn?: string;
  cancellationReason?: string;
  refundedPaisa?: number;

  branchId?: string;
}

/* ─────────────────────────────── Money on an order ─────────────────────────────── */

export function advanceReceived(order: CustomerOrder): number {
  return roundMoney(order.advances.reduce((s, a) => s + a.amountPaisa, 0));
}

/**
 * Indicative value at the given rate. Deliberately called *estimated*: the real figure is only
 * known when the piece is made and weighed, and presenting it as final is how a shop ends up
 * arguing about a number it printed on a receipt months earlier.
 */
export function estimatedValue(order: CustomerOrder, currentRatePerGramPaisa: number): number {
  const rate = order.rateBasis === 'FIXED_AT_ORDER' && order.lockedRatePerGramPaisa !== null
    ? order.lockedRatePerGramPaisa
    : currentRatePerGramPaisa;
  const metal = (order.estimatedWeightMg / 1000) * rate;
  return roundMoney(metal + order.estimatedMakingPaisa + order.estimatedStonePaisa);
}

export function balanceDue(order: CustomerOrder, currentRatePerGramPaisa: number): number {
  return roundMoney(estimatedValue(order, currentRatePerGramPaisa) - advanceReceived(order));
}

/**
 * The rate the order will actually be priced at. Exposed separately so the delivery screen can
 * show the customer *why* the figure moved, rather than presenting a total they did not expect.
 */
export function applicableRate(order: CustomerOrder, deliveryRatePerGramPaisa: number): {
  ratePaisa: number;
  basis: OrderRateBasis;
  differenceFromOrderPaisa: number;
} {
  const locked = order.lockedRatePerGramPaisa;
  const ratePaisa = order.rateBasis === 'FIXED_AT_ORDER' && locked !== null
    ? locked
    : deliveryRatePerGramPaisa;
  return {
    ratePaisa,
    basis: order.rateBasis,
    differenceFromOrderPaisa: locked === null ? 0 : roundMoney(deliveryRatePerGramPaisa - locked),
  };
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export interface OrderDraft {
  customerName: string;
  customerPhone: string;
  description: string;
  metalType: string;
  estimatedWeightMg: number;
  estimatedMakingPaisa: number;
  estimatedStonePaisa: number;
  rateBasis: OrderRateBasis;
  lockedRatePerGramPaisa: number | null;
  expectedDeliveryDate?: string;
}

export function validateOrder(draft: Partial<OrderDraft>): string | null {
  if (!draft.customerName?.trim()) return 'Record who the order is for.';
  if (!/^\d{10}$/.test((draft.customerPhone ?? '').replace(/\D/g, '').slice(-10))) {
    return 'A contactable phone number is required — this piece has to be collected.';
  }
  if (!draft.description?.trim()) {
    return 'Describe what is being made, in enough detail for the karigar and the customer to agree.';
  }
  if (!Number.isFinite(draft.estimatedWeightMg) || (draft.estimatedWeightMg ?? 0) <= 0) {
    return 'Estimate the weight — it is what the advance and the quote are based on.';
  }
  if (!draft.rateBasis) {
    return 'Choose a rate basis. Leaving it unrecorded is what causes the argument at delivery.';
  }
  if (draft.rateBasis === 'FIXED_AT_ORDER') {
    if (!Number.isFinite(draft.lockedRatePerGramPaisa) || (draft.lockedRatePerGramPaisa ?? 0) <= 0) {
      return 'A fixed-rate order must record the rate being locked.';
    }
  }
  return null;
}

export function validateAdvance(
  order: CustomerOrder,
  amountPaisa: number,
  currentRatePerGramPaisa: number
): string | null {
  if (!isOpenOrder(order.status)) {
    return `This order is ${ORDER_STATUS_LABEL[order.status].toLowerCase()} and cannot take further advances.`;
  }
  if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) return 'Enter the amount received.';

  const alreadyHeld = advanceReceived(order);
  const value = estimatedValue(order, currentRatePerGramPaisa);
  if (roundMoney(alreadyHeld + amountPaisa) > value) {
    // Taking more than the piece is worth turns an advance into a deposit the shop must return,
    // which is a different legal animal — the same territory D-11 flags for savings schemes.
    return 'That would take more than the order is worth. Collect the balance at delivery instead.';
  }
  return null;
}

/* ─────────────────────────────── Building & applying ─────────────────────────────── */

export function buildOrder(
  draft: OrderDraft,
  orderNumber: string,
  orderedOn: string = new Date().toISOString().slice(0, 10),
  branchId?: string,
  customerId?: string
): CustomerOrder {
  return {
    id: `ord-${Date.now()}`,
    orderNumber,
    orderedOn,
    customerId,
    customerName: draft.customerName.trim(),
    customerPhone: draft.customerPhone.trim(),
    description: draft.description.trim(),
    metalType: draft.metalType,
    estimatedWeightMg: Math.round(draft.estimatedWeightMg),
    estimatedMakingPaisa: roundMoney(draft.estimatedMakingPaisa),
    estimatedStonePaisa: roundMoney(draft.estimatedStonePaisa),
    rateBasis: draft.rateBasis,
    // Null rather than 0 for an at-delivery order: 0 would read as "locked at nothing".
    lockedRatePerGramPaisa: draft.rateBasis === 'FIXED_AT_ORDER'
      ? roundMoney(draft.lockedRatePerGramPaisa ?? 0)
      : null,
    advances: [],
    expectedDeliveryDate: draft.expectedDeliveryDate,
    status: 'Draft',
    branchId,
  };
}

export function addAdvance(
  order: CustomerOrder,
  amountPaisa: number,
  mode: string,
  receivedBy: string,
  receivedOn: string = new Date().toISOString().slice(0, 10)
): CustomerOrder {
  const advance: OrderAdvance = {
    id: `adv-${Date.now()}`,
    amountPaisa: roundMoney(amountPaisa),
    receivedOn,
    mode,
    receivedBy,
  };
  // An order that has taken money is no longer a draft — it is a commitment on both sides.
  const status: OrderStatus = order.status === 'Draft' ? 'Confirmed' : order.status;
  return { ...order, advances: [...order.advances, advance], status };
}

export function applyOrderStatus(order: CustomerOrder, to: OrderStatus): CustomerOrder {
  if (!canTransitionOrder(order.status, to)) return order;
  return { ...order, status: to };
}

export function validateConversion(order: CustomerOrder): string | null {
  if (order.convertedInvoiceNumber) {
    // The presence of an invoice number is the guard: without it, a double-click at the counter
    // bills the customer twice and applies the advance twice.
    return `Already delivered against invoice ${order.convertedInvoiceNumber}.`;
  }
  if (order.status !== 'Ready') {
    return `Only a Ready order can be delivered — this one is ${ORDER_STATUS_LABEL[order.status]}.`;
  }
  return null;
}

export function applyConversion(
  order: CustomerOrder,
  invoiceNumber: string,
  deliveredOn: string = new Date().toISOString().slice(0, 10)
): CustomerOrder {
  return { ...order, status: 'Delivered', convertedInvoiceNumber: invoiceNumber, deliveredOn };
}

export function validateCancellation(order: CustomerOrder, reason: string, refundPaisa: number): string | null {
  if (!isOpenOrder(order.status)) return 'This order is already closed.';
  if ((reason ?? '').trim().length < 5) {
    return 'Record why the order was cancelled — it is what the audit trail keeps.';
  }
  const held = advanceReceived(order);
  if (!Number.isFinite(refundPaisa) || refundPaisa < 0) return 'Enter the refund amount.';
  if (roundMoney(refundPaisa) > held) {
    return `Cannot refund more than the ₹${(held / 100).toLocaleString('en-IN')} actually received.`;
  }
  return null;
}

export function applyCancellation(
  order: CustomerOrder,
  reason: string,
  refundPaisa: number,
  cancelledOn: string = new Date().toISOString().slice(0, 10)
): CustomerOrder {
  // The advances stay on the record. A refund is a new fact, not the erasure of an old one.
  return {
    ...order,
    status: 'Cancelled',
    cancelledOn,
    cancellationReason: reason.trim(),
    refundedPaisa: roundMoney(refundPaisa),
  };
}

/* ─────────────────────────────── Reporting ─────────────────────────────── */

export interface OrderSummary {
  open: number;
  ready: number;
  overdue: number;
  /** Money held against undelivered orders — a liability, and labelled as one. */
  advanceLiabilityPaisa: number;
  deliveredCount: number;
  cancelledCount: number;
  forfeitedPaisa: number;
}

export function summariseOrders(
  orders: CustomerOrder[],
  today: string = new Date().toISOString().slice(0, 10)
): OrderSummary {
  const open = orders.filter(o => isOpenOrder(o.status));
  const cancelled = orders.filter(o => o.status === 'Cancelled');

  return {
    open: open.length,
    ready: orders.filter(o => o.status === 'Ready').length,
    overdue: open.filter(o => !!o.expectedDeliveryDate && o.expectedDeliveryDate < today).length,
    advanceLiabilityPaisa: roundMoney(open.reduce((s, o) => s + advanceReceived(o), 0)),
    deliveredCount: orders.filter(o => o.status === 'Delivered').length,
    cancelledCount: cancelled.length,
    // What the shop kept when a cancelled order was not fully refunded.
    forfeitedPaisa: roundMoney(
      cancelled.reduce((s, o) => s + (advanceReceived(o) - (o.refundedPaisa ?? 0)), 0)
    ),
  };
}

export function isOrderOverdue(
  order: CustomerOrder,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  return isOpenOrder(order.status)
    && !!order.expectedDeliveryDate
    && order.expectedDeliveryDate < today;
}

export function nextOrderNumber(existing: CustomerOrder[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const prefix = `ORD-${year}-`;
  const highest = existing
    .filter(o => o.orderNumber.startsWith(prefix))
    .reduce((max, o) => Math.max(max, Number(o.orderNumber.slice(prefix.length)) || 0), 0);
  return `${prefix}${highest + 1}`;
}

export function orderGrams(mg: number): number {
  return roundWeight(mg / 1000);
}
