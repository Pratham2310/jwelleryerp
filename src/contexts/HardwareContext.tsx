import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  initialDevices,
  transitionDevice,
  simulateSettling,
  isStable,
  quantizeToResolution,
  validateCapture,
  buildCapture,
  type DeviceKind,
  type DeviceState,
  type ScaleReading,
  type CaptureResult,
} from '../lib/hardware';

/**
 * Simulated peripherals (Milestone 35). The domain rules live in `src/lib/hardware.ts`; this
 * holds only the wiring — device state, the sampling loop, and the registry that lets the
 * Simulation Desk send a captured weight to whichever weight field the operator is standing in.
 *
 * The field registry is deliberately "last focused wins" rather than "currently focused": the
 * act of clicking the desk's capture button blurs the input, so requiring focus at the moment
 * of capture would mean it could never fire.
 */

type CaptureHandler = (grams: number) => void;

interface WeightFieldRegistration {
  label: string;
  handler: CaptureHandler;
}

interface HardwareContextValue {
  devices: Record<DeviceKind, DeviceState>;
  connect: (kind: DeviceKind) => void;
  disconnect: (kind: DeviceKind) => void;

  /** What is on the pan right now, or null when nothing has been placed. */
  reading: ScaleReading | null;
  /** Simulates placing a piece on the pan; the reading then settles onto it. */
  placeOnPan: (grams: number) => void;
  clearPan: () => void;
  tare: number;
  setTare: (grams: number) => void;

  /** The field a capture would land in, for the desk to name before firing. */
  activeFieldLabel: string | null;
  registerWeightField: (label: string, handler: CaptureHandler) => void;

  /** Validates and sends to the active field. Returns the capture, or null with `captureError` set. */
  capture: () => CaptureResult | null;
  captureError: string | null;
  lastCapture: CaptureResult | null;

  printTest: () => void;
  printerError: string | null;
  lastPrintAt: string | null;
}

const HardwareContext = createContext<HardwareContextValue | null>(null);

const SAMPLE_INTERVAL_MS = 220;

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Record<DeviceKind, DeviceState>>(initialDevices);
  const [target, setTarget] = useState<number | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [tare, setTare] = useState(0);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [lastCapture, setLastCapture] = useState<CaptureResult | null>(null);
  const [printerError, setPrinterError] = useState<string | null>(null);
  const [lastPrintAt, setLastPrintAt] = useState<string | null>(null);

  const field = useRef<WeightFieldRegistration | null>(null);
  const [activeFieldLabel, setActiveFieldLabel] = useState<string | null>(null);
  const seed = useRef(1);
  const step = useRef(0);

  const connect = useCallback((kind: DeviceKind) => {
    setDevices(prev => ({ ...prev, [kind]: transitionDevice(prev[kind], 'CONNECTING') }));
    // A handshake takes a moment; the panel shows CONNECTING while it does, which is the point
    // of modelling this as three states rather than a checkbox.
    window.setTimeout(() => {
      setDevices(prev => ({ ...prev, [kind]: transitionDevice(prev[kind], 'CONNECTED') }));
    }, 700);
  }, []);

  const disconnect = useCallback((kind: DeviceKind) => {
    setDevices(prev => ({ ...prev, [kind]: transitionDevice(prev[kind], 'DISCONNECTED') }));
    if (kind === 'SCALE') { setTarget(null); setSamples([]); }
  }, []);

  const placeOnPan = useCallback((grams: number) => {
    seed.current = Math.floor(Math.random() * 1000) + 1;
    step.current = 0;
    setSamples([]);
    setTarget(quantizeToResolution(grams));
    setCaptureError(null);
  }, []);

  const clearPan = useCallback(() => {
    setTarget(null);
    setSamples([]);
    setCaptureError(null);
  }, []);

  // The pan settling. Runs only while the scale is connected and something is on it.
  useEffect(() => {
    if (devices.SCALE.status !== 'CONNECTED' || target === null) return;

    const sequence = simulateSettling(target, seed.current, 12);
    const id = window.setInterval(() => {
      const next = sequence[Math.min(step.current, sequence.length - 1)];
      step.current += 1;
      setSamples(prev => [...prev.slice(-11), next]);
    }, SAMPLE_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [devices.SCALE.status, target]);

  const reading: ScaleReading | null = samples.length
    ? {
        grams: samples[samples.length - 1],
        isStable: isStable(samples),
        at: new Date().toISOString(),
      }
    : null;

  const registerWeightField = useCallback((label: string, handler: CaptureHandler) => {
    field.current = { label, handler };
    setActiveFieldLabel(label);
  }, []);

  const capture = useCallback((): CaptureResult | null => {
    const error = validateCapture(devices.SCALE, reading, tare);
    if (error) { setCaptureError(error); return null; }
    if (!field.current) {
      setCaptureError('Click into a weight field first — there is nowhere to send the reading.');
      return null;
    }
    const result = buildCapture(reading as ScaleReading, tare);
    field.current.handler(result.netGrams);
    setCaptureError(null);
    setLastCapture(result);
    return result;
  }, [devices.SCALE, reading, tare]);

  const printTest = useCallback(() => {
    if (devices.PRINTER.status !== 'CONNECTED') {
      setPrinterError('The thermal printer is not connected.');
      return;
    }
    setPrinterError(null);
    setLastPrintAt(new Date().toISOString());
  }, [devices.PRINTER.status]);

  return (
    <HardwareContext.Provider
      value={{
        devices, connect, disconnect,
        reading, placeOnPan, clearPan, tare, setTare,
        activeFieldLabel, registerWeightField,
        capture, captureError, lastCapture,
        printTest, printerError, lastPrintAt,
      }}
    >
      {children}
    </HardwareContext.Provider>
  );
}

export function useHardware(): HardwareContextValue {
  const ctx = useContext(HardwareContext);
  if (!ctx) throw new Error('useHardware must be used within a HardwareProvider');
  return ctx;
}
