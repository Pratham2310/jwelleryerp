import { Scale, Printer, Loader2, AlertTriangle } from 'lucide-react';
import { useHardware } from '../contexts/HardwareContext';
import {
  DEVICE_LABEL,
  SCALE_CAPACITY_GRAMS,
  formatReading,
  type DeviceKind,
  type DeviceStatus,
} from '../lib/hardware';

/**
 * Simulated hardware panel for the Simulation Desk (Milestone 35). Always dark — the desk is a
 * fixed dark surface in both themes, so these colours are literal rather than theme-aware.
 */

const STATUS_STYLE: Record<DeviceStatus, { dot: string; text: string; label: string }> = {
  DISCONNECTED: { dot: 'bg-zinc-600', text: 'text-zinc-500', label: 'Disconnected' },
  CONNECTING: { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-400', label: 'Handshaking' },
  CONNECTED: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Connected' },
  ERROR: { dot: 'bg-red-500', text: 'text-red-400', label: 'Error' },
};

const ICON: Record<DeviceKind, typeof Scale> = { SCALE: Scale, PRINTER: Printer };

/** Plausible counter weights, so "place on pan" behaves like a real piece rather than a number. */
const SAMPLE_PIECES = [
  { label: 'Ring', grams: 8.2 },
  { label: 'Chain', grams: 24.65 },
  { label: 'Bangle', grams: 41.3 },
];

export default function HardwarePanel() {
  const {
    devices, connect, disconnect,
    reading, placeOnPan, clearPan, tare, setTare,
    activeFieldLabel, capture, captureError, lastCapture,
    printTest, printerError, lastPrintAt,
  } = useHardware();

  const scaleReady = devices.SCALE.status === 'CONNECTED';

  return (
    <div className="space-y-3">
      {/* Connection status for both devices */}
      {(['SCALE', 'PRINTER'] as DeviceKind[]).map(kind => {
        const d = devices[kind];
        const s = STATUS_STYLE[d.status];
        const Icon = ICON[kind];
        return (
          <div key={kind} className="flex items-center gap-2.5">
            <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-zinc-300 leading-tight">{DEVICE_LABEL[kind]}</p>
              <p className="text-[9px] text-zinc-600 font-mono truncate">{d.model}</p>
            </div>
            <span className={`flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase ${s.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            <button
              onClick={() => (d.status === 'CONNECTED' ? disconnect(kind) : connect(kind))}
              disabled={d.status === 'CONNECTING'}
              className="px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-[9px] font-mono font-bold text-zinc-400 disabled:opacity-40 transition"
            >
              {d.status === 'CONNECTING' ? '···' : d.status === 'CONNECTED' ? 'DROP' : 'LINK'}
            </button>
          </div>
        );
      })}

      {/* Live reading */}
      <div className="pt-2.5 border-t border-[#262626] space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Pan Reading</span>
          {reading && (
            <span className={`text-[9px] font-mono font-bold uppercase ${
              reading.isStable ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {reading.isStable ? 'Stable' : (
                <span className="flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Settling</span>
              )}
            </span>
          )}
        </div>

        <p className={`font-mono text-xl font-black tabular-nums ${
          !reading ? 'text-zinc-700' : reading.isStable ? 'text-[#C5A059]' : 'text-zinc-500'
        }`}>
          {reading ? formatReading(reading.grams) : `0.000 g`}
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {SAMPLE_PIECES.map(p => (
            <button
              key={p.label}
              onClick={() => placeOnPan(p.grams)}
              disabled={!scaleReady}
              className="py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-[9px] font-mono text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[9px] font-mono text-zinc-500 uppercase font-bold shrink-0">Tare</label>
          <input
            type="number"
            step="0.001"
            value={tare || ''}
            placeholder="0.000"
            aria-label="Tare weight"
            onChange={e => setTare(parseFloat(e.target.value) || 0)}
            className="w-20 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-[10px] font-mono text-zinc-200 focus:outline-none focus:border-[#C5A059]"
          />
          <button
            onClick={clearPan}
            disabled={!reading}
            className="ml-auto px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-[9px] font-mono font-bold text-zinc-500 disabled:opacity-30 transition"
          >
            CLEAR PAN
          </button>
        </div>

        {/* Where the capture will land — named before it fires, so nothing lands by surprise. */}
        <p className="text-[9px] text-zinc-600 font-mono truncate">
          {activeFieldLabel ? `→ ${activeFieldLabel}` : 'No weight field selected'}
        </p>

        <button
          onClick={capture}
          disabled={!scaleReady}
          className="w-full py-2 bg-[#C5A059] hover:bg-[#B08D4A] disabled:opacity-30 disabled:cursor-not-allowed text-[#0A0A0B] text-[10px] font-bold rounded-lg transition"
        >
          Fetch Weight → Form
        </button>

        {captureError && (
          <p className="text-[9px] text-amber-400 leading-relaxed flex gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{captureError}
          </p>
        )}
        {lastCapture && !captureError && (
          <p className="text-[9px] text-emerald-400 font-mono">
            Sent {formatReading(lastCapture.netGrams)}
            {lastCapture.tareGrams > 0 && ` (gross ${formatReading(lastCapture.grossGrams)} − tare ${formatReading(lastCapture.tareGrams)})`}
          </p>
        )}
        <p className="text-[9px] text-zinc-700 font-mono">Capacity {SCALE_CAPACITY_GRAMS} g · reads to 1 mg</p>
      </div>

      {/* Printer test */}
      <div className="pt-2.5 border-t border-[#262626] space-y-1.5">
        <button
          onClick={printTest}
          className="w-full py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-[10px] font-mono font-bold text-zinc-400 transition"
        >
          Test Print
        </button>
        {printerError && (
          <p className="text-[9px] text-amber-400 flex gap-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{printerError}
          </p>
        )}
        {lastPrintAt && !printerError && (
          <p className="text-[9px] text-emerald-400 font-mono">Printed {lastPrintAt.slice(11, 19)}</p>
        )}
      </div>
    </div>
  );
}
