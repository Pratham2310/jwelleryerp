import { describe, it, expect } from 'vitest';
import {
  SCALE_RESOLUTION_GRAMS,
  SCALE_CAPACITY_GRAMS,
  initialDevices,
  canTransitionDevice,
  transitionDevice,
  quantizeToResolution,
  simulateSettling,
  isStable,
  validateCapture,
  buildCapture,
  formatReading,
  DEVICE_LABEL,
  type DeviceState,
  type ScaleReading,
} from './hardware';

const connected = (): DeviceState => ({
  kind: 'SCALE', status: 'CONNECTED', model: 'test', lastEventAt: null, error: null,
});

const reading = (grams: number, stable = true): ScaleReading => ({
  grams, isStable: stable, at: '2026-08-01T10:00:00.000Z',
});

describe('device connection is a state machine, not a boolean', () => {
  it('starts disconnected', () => {
    const d = initialDevices();
    expect(d.SCALE.status).toBe('DISCONNECTED');
    expect(d.PRINTER.status).toBe('DISCONNECTED');
  });

  it('must handshake before it is connected', () => {
    expect(canTransitionDevice('DISCONNECTED', 'CONNECTED')).toBe(false);
    expect(canTransitionDevice('DISCONNECTED', 'CONNECTING')).toBe(true);
    expect(canTransitionDevice('CONNECTING', 'CONNECTED')).toBe(true);
  });

  it('can fail the handshake and retry', () => {
    expect(canTransitionDevice('CONNECTING', 'ERROR')).toBe(true);
    expect(canTransitionDevice('ERROR', 'CONNECTING')).toBe(true);
  });

  it('ignores an illegal transition rather than applying it', () => {
    const d = initialDevices().SCALE;
    expect(transitionDevice(d, 'CONNECTED').status).toBe('DISCONNECTED');
  });

  it('records an error only on the ERROR state, and clears it on recovery', () => {
    const failing = transitionDevice(
      transitionDevice(initialDevices().SCALE, 'CONNECTING'), 'ERROR', 'now', 'No response on COM3'
    );
    expect(failing.error).toBe('No response on COM3');
    expect(transitionDevice(failing, 'CONNECTING').error).toBeNull();
  });

  it('labels both devices', () => {
    expect(DEVICE_LABEL.SCALE).toMatch(/scale/i);
    expect(DEVICE_LABEL.PRINTER).toMatch(/printer/i);
  });
});

describe('resolution', () => {
  it('snaps to the milligram, because finer is false precision', () => {
    expect(quantizeToResolution(8.20049)).toBe(8.2);
    expect(quantizeToResolution(8.2006)).toBe(8.201);
  });

  it('leaves a value already on a division alone', () => {
    expect(quantizeToResolution(12.345)).toBe(12.345);
  });

  it('states its own precision when formatted', () => {
    expect(formatReading(8.2)).toBe('8.200 g');
  });
});

describe('settling', () => {
  it('swings first and settles last — the pan does not land instantly', () => {
    const samples = simulateSettling(20, 7);
    expect(isStable(samples.slice(0, 4))).toBe(false);
    expect(isStable(samples)).toBe(true);
  });

  it('settles onto the target within one division', () => {
    const samples = simulateSettling(15.5, 3);
    expect(Math.abs(samples[samples.length - 1] - 15.5)).toBeLessThanOrEqual(SCALE_RESOLUTION_GRAMS);
  });

  it('is deterministic for a seed, so the tests assert behaviour and not luck', () => {
    expect(simulateSettling(10, 42)).toEqual(simulateSettling(10, 42));
  });

  it('never reads negative while swinging', () => {
    for (const s of simulateSettling(0.5, 9)) expect(s).toBeGreaterThanOrEqual(0);
  });

  it('needs enough samples before it will call anything stable', () => {
    expect(isStable([5, 5])).toBe(false);
    expect(isStable([5, 5, 5, 5])).toBe(true);
  });
});

describe('validateCapture', () => {
  it('accepts a settled reading on a connected scale', () => {
    expect(validateCapture(connected(), reading(8.2))).toBeNull();
  });

  it('REFUSES an unstable reading — a number mid-swing looks authoritative and is wrong', () => {
    expect(validateCapture(connected(), reading(8.2, false))).toMatch(/has not settled/i);
  });

  it('refuses when the scale is not connected', () => {
    const d: DeviceState = { ...connected(), status: 'CONNECTING' };
    expect(validateCapture(d, reading(8.2))).toMatch(/not connected/i);
  });

  it('refuses with no reading at all', () => {
    expect(validateCapture(connected(), null)).toMatch(/place the piece/i);
  });

  it('refuses over capacity', () => {
    expect(validateCapture(connected(), reading(SCALE_CAPACITY_GRAMS + 1))).toMatch(/over capacity/i);
  });

  it('refuses a tare that would make the net zero or negative', () => {
    // Forgetting the tray is the commonest counter error; a negative net must never reach a bill.
    expect(validateCapture(connected(), reading(8.2), 8.2)).toMatch(/zero or less/i);
    expect(validateCapture(connected(), reading(8.2), 10)).toMatch(/zero or less/i);
  });

  it('refuses a negative tare', () => {
    expect(validateCapture(connected(), reading(8.2), -1)).toMatch(/cannot be negative/i);
  });
});

describe('buildCapture', () => {
  it('carries the tare rather than silently folding it away', () => {
    const c = buildCapture(reading(10.5), 2.25);
    expect(c).toMatchObject({ grossGrams: 10.5, tareGrams: 2.25, netGrams: 8.25 });
  });

  it('defaults to no tare', () => {
    expect(buildCapture(reading(8.2)).netGrams).toBe(8.2);
  });

  it('quantises the tare too, so the net lands on a division', () => {
    expect(buildCapture(reading(10), 2.00049).tareGrams).toBe(2);
  });
});
