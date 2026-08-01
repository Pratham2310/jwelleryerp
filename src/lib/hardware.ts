/**
 * Simulated hardware: digital scale and thermal printer (Milestone 35, PRD §16.2).
 *
 * ─── Why this is more than "put a number in a box" ────────────────────────────────────
 * There is no real serial port here and there never will be in a frontend-only build. What is
 * worth simulating faithfully is the *discipline* of weighing, because the failure modes are real
 * and expensive in a jewellery shop:
 *
 *   - A reading fluctuates until the pan settles. Capturing mid-swing books a weight the piece
 *     never had, and on gold that error is money. `isStable()` is therefore a precondition of
 *     capture, not a decoration — the same reason a shop assistant waits for the beep.
 *   - A scale has a resolution (1 mg for jewellery) and a capacity. A reading finer than the
 *     resolution is false precision; one above capacity is not a reading at all.
 *   - Tare is not subtraction after the fact. Weighing a piece in a tray and forgetting the tray
 *     is the single most common counter error, so a capture carries its tare and refuses to
 *     produce a negative net.
 *
 * The generated readings are deterministic given a seed, so the tests assert on settling
 * behaviour rather than on luck.
 */

import { roundWeight, WEIGHT_DP } from './money';

/** Jewellery scales read to the milligram. Anything finer is false precision. */
export const SCALE_RESOLUTION_GRAMS = 0.001;

/** A counter scale, not a bullion balance. Above this the pan is simply overloaded. */
export const SCALE_CAPACITY_GRAMS = 500;

/** How many consecutive samples must agree before the reading counts as settled. */
export const STABILITY_SAMPLE_COUNT = 4;

export type DeviceStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type DeviceKind = 'SCALE' | 'PRINTER';

export interface DeviceState {
  kind: DeviceKind;
  status: DeviceStatus;
  /** Model string a real driver would report on handshake. Cosmetic, but it makes the panel legible. */
  model: string;
  lastEventAt: string | null;
  error: string | null;
}

export const DEVICE_LABEL: Record<DeviceKind, string> = {
  SCALE: 'Digital Scale',
  PRINTER: 'Thermal Printer',
};

export function initialDevices(): Record<DeviceKind, DeviceState> {
  return {
    SCALE: { kind: 'SCALE', status: 'DISCONNECTED', model: 'Essae DS-852 (1 mg)', lastEventAt: null, error: null },
    PRINTER: { kind: 'PRINTER', status: 'DISCONNECTED', model: 'TVS RP-3160 Gold', lastEventAt: null, error: null },
  };
}

/**
 * Connection is a state machine, not a boolean: a device that is mid-handshake is neither
 * connected nor disconnected, and a capture attempted against it must fail rather than block.
 */
const ALLOWED_TRANSITIONS: Record<DeviceStatus, DeviceStatus[]> = {
  DISCONNECTED: ['CONNECTING'],
  CONNECTING: ['CONNECTED', 'ERROR', 'DISCONNECTED'],
  CONNECTED: ['DISCONNECTED', 'ERROR'],
  ERROR: ['CONNECTING', 'DISCONNECTED'],
};

export function canTransitionDevice(from: DeviceStatus, to: DeviceStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionDevice(
  device: DeviceState,
  to: DeviceStatus,
  at: string = new Date().toISOString(),
  error: string | null = null
): DeviceState {
  if (!canTransitionDevice(device.status, to)) return device;
  return { ...device, status: to, lastEventAt: at, error: to === 'ERROR' ? error : null };
}

/* ─────────────────────────────── Readings ─────────────────────────────── */

export interface ScaleReading {
  /** The instantaneous gross value on the pan, already quantised to the scale's resolution. */
  grams: number;
  /** True once the recent samples agree to within one division. */
  isStable: boolean;
  at: string;
}

/** A value finer than the scale can actually resolve is false precision, so snap it to a division. */
export function quantizeToResolution(grams: number): number {
  const divisions = Math.round(Number(grams || 0) / SCALE_RESOLUTION_GRAMS);
  return roundWeight(divisions * SCALE_RESOLUTION_GRAMS);
}

/**
 * Deterministic pseudo-random in [-1, 1], so a test can assert that a pan settles rather than
 * hoping it does. A real driver's jitter is not reproducible; a simulation's should be.
 */
function jitter(seed: number, step: number): number {
  const x = Math.sin(seed * 127.1 + step * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Samples a pan settling onto `target`: wide swings that decay geometrically. The last samples
 * land inside one division, which is exactly what `isStable()` then detects.
 */
export function simulateSettling(target: number, seed = 1, samples = 12): number[] {
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const decay = Math.pow(0.45, i);
    const swing = jitter(seed, i) * target * 0.08 * decay;
    out.push(quantizeToResolution(Math.max(0, target + swing)));
  }
  return out;
}

/** Settled when the last `STABILITY_SAMPLE_COUNT` samples agree to within one division. */
export function isStable(samples: number[]): boolean {
  if (samples.length < STABILITY_SAMPLE_COUNT) return false;
  const recent = samples.slice(-STABILITY_SAMPLE_COUNT);
  const spread = Math.max(...recent) - Math.min(...recent);
  // Compared with a small epsilon: the samples are already quantised, so an exact-equality
  // test would fail on the last bit of floating point rather than on a genuine wobble.
  return spread <= SCALE_RESOLUTION_GRAMS + 1e-9;
}

export interface CaptureResult {
  /** Net weight to write into the form, gross less tare. */
  netGrams: number;
  grossGrams: number;
  tareGrams: number;
  at: string;
}

/**
 * Validates a capture. Returns the reason it cannot be taken, or null when it can.
 *
 * Refusing an unstable reading is the whole point of the milestone: a scale that will hand you a
 * number mid-swing is worse than no scale, because the number looks authoritative.
 */
export function validateCapture(
  device: DeviceState,
  reading: ScaleReading | null,
  tareGrams = 0
): string | null {
  if (device.status !== 'CONNECTED') {
    return `The ${DEVICE_LABEL[device.kind].toLowerCase()} is not connected.`;
  }
  if (!reading) return 'No reading yet — place the piece on the pan.';
  if (!reading.isStable) {
    return 'The reading has not settled. Wait for the scale to stabilise before capturing.';
  }
  if (reading.grams > SCALE_CAPACITY_GRAMS) {
    return `Over capacity — this scale reads to ${SCALE_CAPACITY_GRAMS} g.`;
  }
  const tare = Number(tareGrams) || 0;
  if (tare < 0) return 'Tare cannot be negative.';
  if (roundWeight(reading.grams - tare) <= 0) {
    return 'Net weight after tare is zero or less. Check the tare value.';
  }
  return null;
}

export function buildCapture(reading: ScaleReading, tareGrams = 0): CaptureResult {
  const tare = quantizeToResolution(Number(tareGrams) || 0);
  return {
    grossGrams: reading.grams,
    tareGrams: tare,
    netGrams: roundWeight(reading.grams - tare),
    at: reading.at,
  };
}

/** What the panel prints under the reading, so the number on screen states its own precision. */
export function formatReading(grams: number): string {
  return `${(Number(grams) || 0).toFixed(WEIGHT_DP)} g`;
}
