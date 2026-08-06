import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUS_LABEL,
  TERMINAL_ORDER_STATUSES,
  canTransitionOrder,
  nextOrderStatuses,
  isOpenOrder,
  advanceReceived,
  estimatedValue,
  balanceDue,
  applicableRate,
  validateOrder,
  validateAdvance,
  buildOrder,
  addAdvance,
  applyOrderStatus,
  validateConversion,
  applyConversion,
  validateCancellation,
  applyCancellation,
  summariseOrders,
  isOrderOverdue,
  nextOrderNumber,
  type CustomerOrder,
  type OrderDraft,
} from './customerOrder';

const RATE = 665000; // ₹6,650 per gram, in paisa

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  customerName: 'Shrutika D.',
  customerPhone: '9876543210',
  description: 'Antique kundan necklace, 22K, peacock motif',
  metalType: 'Gold (22K)',
  estimatedWeightMg: 40000,           // 40 g
  estimatedMakingPaisa: 4000000,      // ₹40,000
  estimatedStonePaisa: 0,
  rateBasis: 'AT_DELIVERY',
  lockedRatePerGramPaisa: null,
  ...over,
});

const order = (over: Partial<CustomerOrder> = {}): CustomerOrder => ({
  ...buildOrder(draft(), 'ORD-2026-1', '2026-08-01'),
  ...over,
});

describe('lifecycle', () => {
  it('starts as a draft and is open', () => {
    expect(buildOrder(draft(), 'ORD-2026-1').status).toBe('Draft');
    expect(isOpenOrder('Draft')).toBe(true);
  });

  it('walks the normal path', () => {
    expect(canTransitionOrder('Draft', 'Confirmed')).toBe(true);
    expect(canTransitionOrder('Confirmed', 'InProduction')).toBe(true);
    expect(canTransitionOrder('InProduction', 'Ready')).toBe(true);
    expect(canTransitionOrder('Ready', 'Delivered')).toBe(true);
  });

  it('lets a ready-made piece skip production', () => {
    expect(canTransitionOrder('Confirmed', 'Ready')).toBe(true);
  });

  it('can be cancelled from any open state', () => {
    for (const s of ['Draft', 'Confirmed', 'InProduction', 'Ready'] as const) {
      expect(canTransitionOrder(s, 'Cancelled')).toBe(true);
    }
  });

  it('has exactly two terminal states, both closed', () => {
    const terminal = (['Draft','Confirmed','InProduction','Ready','Delivered','Cancelled'] as const)
      .filter(s => nextOrderStatuses(s).length === 0);
    expect(terminal.sort()).toEqual([...TERMINAL_ORDER_STATUSES].sort());
    for (const s of TERMINAL_ORDER_STATUSES) expect(isOpenOrder(s)).toBe(false);
  });

  it('cannot resurrect a delivered order', () => {
    expect(applyOrderStatus(order({ status: 'Delivered' }), 'Ready').status).toBe('Delivered');
  });
});

describe('rate basis — the thing that causes the argument', () => {
  it('requires an explicit basis', () => {
    expect(validateOrder({ ...draft(), rateBasis: undefined as never }))
      .toMatch(/causes the argument at delivery/i);
  });

  it('a fixed-rate order must record the rate it locked', () => {
    expect(validateOrder(draft({ rateBasis: 'FIXED_AT_ORDER', lockedRatePerGramPaisa: null })))
      .toMatch(/must record the rate being locked/i);
  });

  it('stores null, not zero, for an at-delivery order', () => {
    // 0 would read as "locked at nothing" and silently price the piece free.
    expect(buildOrder(draft({ rateBasis: 'AT_DELIVERY' }), 'O').lockedRatePerGramPaisa).toBeNull();
  });

  it('a FIXED order prices at the locked rate even when the market has moved', () => {
    const o = order({ rateBasis: 'FIXED_AT_ORDER', lockedRatePerGramPaisa: RATE });
    const applied = applicableRate(o, 700000);
    expect(applied.ratePaisa).toBe(RATE);
    expect(applied.differenceFromOrderPaisa).toBe(35000);   // the shop absorbs ₹350/g
  });

  it('an AT_DELIVERY order prices at the delivery rate', () => {
    const applied = applicableRate(order(), 700000);
    expect(applied.ratePaisa).toBe(700000);
    expect(applied.basis).toBe('AT_DELIVERY');
  });

  it('values a fixed order at its locked rate regardless of today', () => {
    const o = order({ rateBasis: 'FIXED_AT_ORDER', lockedRatePerGramPaisa: RATE });
    expect(estimatedValue(o, 900000)).toBe(40 * RATE + 4000000);
  });
});

describe('advances are the customer\'s money', () => {
  it('totals what has been received', () => {
    const o = addAdvance(addAdvance(order(), 2000000, 'Cash', 'S'), 1000000, 'UPI', 'S');
    expect(advanceReceived(o)).toBe(3000000);
  });

  it('confirms a draft the moment money changes hands', () => {
    // An order that has taken money is a commitment on both sides, not a draft.
    expect(addAdvance(order(), 2000000, 'Cash', 'S').status).toBe('Confirmed');
  });

  it('does not disturb a later status', () => {
    expect(addAdvance(order({ status: 'InProduction' }), 100000, 'Cash', 'S').status)
      .toBe('InProduction');
  });

  it('REFUSES an advance beyond the order value', () => {
    // Beyond the value it stops being an advance and becomes a deposit the shop must return —
    // a different legal animal, the territory D-11 flags for savings schemes.
    const value = estimatedValue(order(), RATE);
    expect(validateAdvance(order(), value + 1, RATE)).toMatch(/more than the order is worth/i);
  });

  it('allows an advance up to the full value', () => {
    expect(validateAdvance(order(), estimatedValue(order(), RATE), RATE)).toBeNull();
  });

  it('refuses an advance on a closed order', () => {
    expect(validateAdvance(order({ status: 'Cancelled' }), 1000, RATE)).toMatch(/cannot take further advances/i);
  });

  it('computes the balance still due', () => {
    const o = addAdvance(order(), 2000000, 'Cash', 'S');
    expect(balanceDue(o, RATE)).toBe(estimatedValue(o, RATE) - 2000000);
  });
});

describe('conversion happens exactly once', () => {
  const ready = addAdvance(order({ status: 'Ready' }), 2000000, 'Cash', 'S');

  it('accepts a ready order', () => {
    expect(validateConversion(ready)).toBeNull();
  });

  it('REFUSES a second conversion, naming the invoice', () => {
    // Without this guard a double-click at the counter bills the customer twice and
    // applies the advance twice.
    const done = applyConversion(ready, 'MUM-2026-1042');
    expect(validateConversion(done)).toMatch(/already delivered against invoice MUM-2026-1042/i);
  });

  it('refuses to deliver an order that is not Ready', () => {
    expect(validateConversion(order({ status: 'InProduction' }))).toMatch(/only a Ready order/i);
  });

  it('records the invoice number and delivery date', () => {
    const done = applyConversion(ready, 'MUM-2026-1042', '2026-10-01');
    expect(done).toMatchObject({
      status: 'Delivered', convertedInvoiceNumber: 'MUM-2026-1042', deliveredOn: '2026-10-01',
    });
  });
});

describe('cancellation', () => {
  const withMoney = addAdvance(order(), 2000000, 'Cash', 'S');

  it('requires a reason', () => {
    expect(validateCancellation(withMoney, 'no', 0)).toMatch(/audit trail/i);
  });

  it('REFUSES to refund more than was received', () => {
    expect(validateCancellation(withMoney, 'Customer changed their mind', 2000001))
      .toMatch(/cannot refund more than/i);
  });

  it('allows a partial refund, keeping the difference as forfeited', () => {
    expect(validateCancellation(withMoney, 'Customer changed their mind', 1500000)).toBeNull();
  });

  it('KEEPS the advances on the record after cancelling', () => {
    // A refund is a new fact, not the erasure of an old one.
    const cancelled = applyCancellation(withMoney, 'Customer changed their mind', 1500000, '2026-09-01');
    expect(cancelled.advances).toHaveLength(1);
    expect(cancelled.refundedPaisa).toBe(1500000);
    expect(advanceReceived(cancelled)).toBe(2000000);
  });

  it('refuses to cancel a closed order', () => {
    expect(validateCancellation(order({ status: 'Delivered' }), 'reason here', 0))
      .toMatch(/already closed/i);
  });
});

describe('validateOrder', () => {
  it('accepts a well-formed order', () => {
    expect(validateOrder(draft())).toBeNull();
  });

  it('requires customer, phone, description and an estimated weight', () => {
    expect(validateOrder(draft({ customerName: ' ' }))).toMatch(/who the order is for/i);
    expect(validateOrder(draft({ customerPhone: '12' }))).toMatch(/has to be collected/i);
    expect(validateOrder(draft({ description: '' }))).toMatch(/describe what is being made/i);
    expect(validateOrder(draft({ estimatedWeightMg: 0 }))).toMatch(/estimate the weight/i);
  });
});

describe('summariseOrders', () => {
  const orders = [
    addAdvance(order({ id: 'a', status: 'Confirmed' }), 2000000, 'Cash', 'S'),
    order({ id: 'b', status: 'Ready', expectedDeliveryDate: '2026-08-01' }),
    order({ id: 'c', status: 'Delivered' }),
    applyCancellation(addAdvance(order({ id: 'd' }), 1000000, 'Cash', 'S'), 'changed mind', 600000),
  ];

  it('counts open orders and what is ready', () => {
    const s = summariseOrders(orders, '2026-08-10');
    expect(s.open).toBe(2);
    expect(s.ready).toBe(1);
  });

  it('reports advances held as a LIABILITY against open orders only', () => {
    // Money against a delivered or cancelled order is no longer owed as goods.
    expect(summariseOrders(orders, '2026-08-10').advanceLiabilityPaisa).toBe(2000000);
  });

  it('counts overdue open orders', () => {
    expect(summariseOrders(orders, '2026-08-10').overdue).toBe(1);
  });

  it('reports what was forfeited on cancellation', () => {
    expect(summariseOrders(orders, '2026-08-10').forfeitedPaisa).toBe(400000);
  });

  it('handles an empty book', () => {
    expect(summariseOrders([], '2026-08-10')).toMatchObject({ open: 0, advanceLiabilityPaisa: 0 });
  });
});

describe('overdue & numbering', () => {
  it('flags an open order past its date, but never a delivered one', () => {
    expect(isOrderOverdue(order({ status: 'Ready', expectedDeliveryDate: '2026-08-01' }), '2026-08-05')).toBe(true);
    expect(isOrderOverdue(order({ status: 'Delivered', expectedDeliveryDate: '2026-08-01' }), '2026-08-05')).toBe(false);
  });

  it('numbers from the highest, never the count', () => {
    const at = new Date('2026-08-04');
    expect(nextOrderNumber([], at)).toBe('ORD-2026-1');
    expect(nextOrderNumber([{ orderNumber: 'ORD-2026-9' }] as CustomerOrder[], at)).toBe('ORD-2026-10');
  });

  it('labels every status', () => {
    expect(Object.keys(ORDER_STATUS_LABEL)).toHaveLength(6);
  });
});
