import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

// Portable LED Pace Line — interactive model
// - Visualizes a lane-length light line with a moving “dot” at target pace
// - Adjustable: pool length, pace (sec/50m), mode (loop/ping-pong), turn dwell, LEDs/m, tail length
// - Markers at 15/25/35/50 m, optional weight pucks every ~8 m
// - Timebase uses requestAnimationFrame; Start/Stop + Reset controls
//
// Styling: TailwindCSS, minimal UI, production-ready structure
// NOTE: This is a visual/simulation model; timings in real build will map LED index to meters.

export default function PaceLineModel() {
  // --- Controls ---
  const [poolLen, setPoolLen] = useState(50); // 25 or 50
  const [secPer50, setSecPer50] = useState(35); // pace in seconds per 50 m
  const [mode, setMode] = useState<"loop" | "pingpong">("loop");
  const [turnDwell, setTurnDwell] = useState(0); // seconds to pause at each wall
  const [ledsPerM, setLedsPerM] = useState(60); // density (for index math only)
  const [tailLen, setTailLen] = useState(3); // LEDs worth of tail in the visual
  const [running, setRunning] = useState(false);
  const [showWeights, setShowWeights] = useState(true);

  // Time state
  const t0Ref = useRef<number | null>(null);
  const elapsedRef = useRef(0); // accumulated when paused/resumed
  const rafRef = useRef<number | null>(null);
  const [tVisual, setTVisual] = useState(0); // for UI display

  // Derived
  const secPerM = useMemo(() => secPer50 / 50, [secPer50]);
  const ledsTotal = useMemo(() => Math.max(1, Math.round(poolLen * ledsPerM)), [poolLen, ledsPerM]);

  // Markers
  const markerMs = useMemo(() => {
    const ms = [15, 25, 35, 50].filter((m) => m <= poolLen);
    return ms;
  }, [poolLen]);

  // Optional weight puck positions (every ~8m, excluding 0 & end)
  const weightPositions = useMemo(() => {
    if (!showWeights) return [] as number[];
    const step = 8;
    const arr: number[] = [];
    for (let m = step; m < poolLen; m += step) arr.push(m);
    return arr;
  }, [poolLen, showWeights]);

  // Start/Stop/Reset
  const start = () => {
    if (!running) {
      setRunning(true);
      t0Ref.current = performance.now();
      loop();
    }
  };
  const stop = () => {
    if (running) {
      setRunning(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // accumulate elapsed
      if (t0Ref.current != null) {
        elapsedRef.current += (performance.now() - t0Ref.current) / 1000;
        t0Ref.current = null;
      }
    }
  };
  const reset = () => {
    stop();
    elapsedRef.current = 0;
    setTVisual(0);
  };

  // Animation loop
  const loop = () => {
    rafRef.current = requestAnimationFrame(() => {
      if (t0Ref.current == null) return; // safety
      const t = elapsedRef.current + (performance.now() - t0Ref.current) / 1000;
      setTVisual(t);
      loop();
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Convert time -> position meters along the lane
  function timeToMeters(t: number) {
    const travelT = secPerM * poolLen; // time to traverse the lane ignoring dwell
    const cycleT = travelT + 2 * turnDwell; // with dwell at both ends
    if (cycleT === 0) return 0;

    const n = Math.floor(t / cycleT);
    const tc = t - n * cycleT; // time within cycle

    let x: number;
    if (tc < turnDwell) x = 0; // dwell at start
    else if (tc > travelT + turnDwell) x = poolLen; // dwell at end
    else x = (tc - turnDwell) / secPerM; // moving

    if (mode === "pingpong" && n % 2 === 1) {
      // reverse on odd laps
      x = poolLen - x;
    }
    if (mode === "loop") {
      // in loop mode, snap to 0 at each lap start (no reverse)
      // x already 0..poolLen
    }
    return Math.max(0, Math.min(poolLen, x));
  }

  const xMeters = timeToMeters(tVisual);
  const headIndex = Math.round(xMeters * ledsPerM);

  // UI scaling: line width responsive; 50 m == 100% width of container track
  // We map meters -> percentage along track
  const toPct = (m: number) => (m / poolLen) * 100;

  // Marker color palette
  const markerColor = (m: number) => {
    if (m <= 15) return "bg-blue-500";
    if (m <= 25) return "bg-green-500";
    if (m <= 35) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Tail positions in meters
  const tailMeters = useMemo(() => {
    const arr: number[] = [];
    for (let k = 0; k < tailLen; k++) {
      const idx = headIndex - k;
      const m = idx / ledsPerM;
      if (m >= 0 && m <= poolLen) arr.push(m);
    }
    return arr;
  }, [headIndex, tailLen, ledsPerM, poolLen]);

  return (
    <div className="w-full min-h-screen bg-gray-50 flex flex-col items-center p-6 gap-6">
      <div className="max-w-5xl w-full">
        <h1 className="text-2xl font-bold tracking-tight">Portable LED Pace Line — Interactive Model</h1>
        <p className="text-gray-600 mt-1">A visual simulation of the lane light with a moving pacing dot, distance markers (15/25/35/50 m), and optional weight pucks.</p>
      </div>

      {/* Controls */}
      <div className="max-w-5xl w-full grid md:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold mb-2">Pace & Pool</h3>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm w-28">Pool length</label>
            <select
              className="px-2 py-1 rounded border"
              value={poolLen}
              onChange={(e) => setPoolLen(parseInt(e.target.value))}
            >
              <option value={25}>25 m</option>
              <option value={50}>50 m</option>
            </select>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm w-28">sec / 50 m</label>
            <input
              type="number"
              className="px-2 py-1 rounded border w-28"
              value={secPer50}
              step={0.5}
              min={5}
              onChange={(e) => setSecPer50(parseFloat(e.target.value || "0"))}
            />
            <div className="flex gap-1">
              <SmallBtn onClick={() => setSecPer50((s) => Math.max(1, s - 1))}>-1</SmallBtn>
              <SmallBtn onClick={() => setSecPer50((s) => s + 1)}>+1</SmallBtn>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm w-28">Mode</label>
            <select
              className="px-2 py-1 rounded border"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
            >
              <option value="loop">Loop (reset at wall)</option>
              <option value="pingpong">Ping-pong (reverse)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm w-28">Turn dwell (s)</label>
            <input
              type="number"
              className="px-2 py-1 rounded border w-28"
              value={turnDwell}
              step={0.1}
              min={0}
              onChange={(e) => setTurnDwell(parseFloat(e.target.value || "0"))}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">LED Mapping</h3>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm w-32">LEDs per meter</label>
            <input
              type="number"
              className="px-2 py-1 rounded border w-28"
              value={ledsPerM}
              min={1}
              step={1}
              onChange={(e) => setLedsPerM(parseInt(e.target.value || "1"))}
            />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm w-32">Tail length (LEDs)</label>
            <input
              type="number"
              className="px-2 py-1 rounded border w-28"
              value={tailLen}
              min={0}
              step={1}
              onChange={(e) => setTailLen(parseInt(e.target.value || "0"))}
            />
          </div>
          <div className="text-sm text-gray-600">Total LEDs: <span className="font-medium">{ledsTotal.toLocaleString()}</span></div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Run</h3>
          <div className="flex gap-2">
            <Button onClick={start} disabled={running}>Start</Button>
            <Button onClick={stop} variant="secondary" disabled={!running}>Stop</Button>
            <Button onClick={reset} variant="ghost">Reset</Button>
          </div>
          <div className="mt-3 text-sm text-gray-700">Elapsed: <span className="tabular-nums">{tVisual.toFixed(2)} s</span></div>
          <div className="text-sm text-gray-700">Dot position: <span className="tabular-nums">{xMeters.toFixed(2)} m</span> ({((xMeters / poolLen) * 100).toFixed(1)}%)</div>
          <div className="text-sm text-gray-700">Head LED index: <span className="tabular-nums">{headIndex}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Sprint 27.0", v: 27 },
              { label: "Race 30.0", v: 30 },
              { label: "Threshold 33.0", v: 33 },
              { label: "Cruise 35.0", v: 35 },
              { label: "Aerobic 40.0", v: 40 },
            ].map((p) => (
              <SmallBtn key={p.label} onClick={() => setSecPer50(p.v)}>{p.label}</SmallBtn>
            ))}
          </div>
          <div className="mt-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showWeights} onChange={(e) => setShowWeights(e.target.checked)} />
              Show weight pucks
            </label>
          </div>
        </Card>
      </div>

      {/* Visualization */}
      <div className="max-w-5xl w-full">
        <div className="mb-2 flex items-end justify-between text-xs text-gray-600">
          <span>0 m</span>
          <span>{poolLen} m</span>
        </div>
        <div className="relative w-full h-16 md:h-20 bg-white rounded-2xl shadow-inner border overflow-hidden">
          {/* Track base */}
          <div className="absolute inset-0">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 rounded-full" />
          </div>

          {/* Zone underglow by meter ranges */}
          {markerMs.map((m, i) => {
            const prev = i === 0 ? 0 : markerMs[i - 1];
            const start = toPct(prev);
            const end = toPct(m);
            return (
              <div
                key={m}
                className={`absolute top-0 h-full opacity-20 ${markerColor(m)}`}
                style={{ left: `${start}%`, width: `${end - start}%` }}
              />
            );
          })}
          {/* Tail end segment (last marker to pool end) */}
          {poolLen > 50 && (
            <div className="absolute top-0 h-full opacity-20 bg-red-500" style={{ left: `${toPct(50)}%`, width: `${toPct(poolLen) - toPct(50)}%` }} />
          )}

          {/* Distance markers lines + labels */}
          {markerMs.map((m) => (
            <div key={`mark-${m}`} className="absolute top-0 h-full" style={{ left: `${toPct(m)}%` }}>
              <div className="absolute top-0 bottom-0 w-0.5 bg-gray-300" />
              <div className="absolute -top-5 text-[10px] text-gray-600 -translate-x-1/2">{m} m</div>
            </div>
          ))}

          {/* Optional weight pucks */}
          {weightPositions.map((m, idx) => (
            <div key={`w-${idx}`} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${toPct(m)}%` }}>
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-gray-500 shadow border border-gray-600" />
            </div>
          ))}

          {/* Head dot + tail */}
          {tailMeters.map((m, k) => (
            <motion.div
              key={`tail-${k}`}
              className="absolute top-1/2 -translate-y-1/2"
              animate={{ left: `${toPct(m)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20, mass: 0.2 }}
            >
              <div className="w-3 h-3 md:w-4 md:h-4 rounded-full" style={{
                background: `radial-gradient(circle, rgba(59,130,246,1), rgba(59,130,246,0.1))`,
                opacity: `${1 - k / Math.max(1, tailLen)}`,
                boxShadow: "0 0 12px rgba(59,130,246,0.8)",
              }} />
            </motion.div>
          ))}

          {/* Head overlay ring */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2"
            animate={{ left: `${toPct(xMeters)}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25, mass: 0.2 }}
          >
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-cyan-500 shadow-[0_0_12px_rgba(34,211,238,0.9)] bg-cyan-400/40" />
          </motion.div>
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
          <Legend color="bg-blue-500" label="0–15 m" />
          <Legend color="bg-green-500" label="15–25 m" />
          <Legend color="bg-yellow-500" label="25–35 m" />
          <Legend color="bg-red-500" label="35–50 m" />
        </div>
      </div>

      {/* Build notes */}
      <div className="max-w-5xl w-full">
        <Details title="Build Notes (mapping to real hardware)">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>In hardware, compute <code>headIndex = round(xMeters * LEDs_per_meter)</code>; light a 3–5 LED comet tail for visibility.</li>
            <li>Power inject every 7–10 m; keep controller + battery on deck (12 V DC only to water side).</li>
            <li>Place line flush against lane-rope wall; use rubber-coated weights every ~8 m.</li>
            <li>Optional: add a <em>turn dwell</em> (0.4–0.8 s) to emulate push-offs for realism.</li>
            <li>Ping-pong mode reverses direction each length (nice for 25 m pools).</li>
          </ul>
        </Details>
      </div>
    </div>
  );
}

// --- UI primitives ---
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 border">{children}</div>
  );
}
function Button({ children, onClick, variant = "primary", disabled = false }: { children: React.ReactNode, onClick?: () => void, variant?: "primary" | "secondary" | "ghost", disabled?: boolean }) {
  const base = "px-3 py-2 rounded-xl text-sm font-medium transition active:scale-[.98]";
  const styles = {
    primary: "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-200",
    ghost: "bg-transparent border border-gray-300 text-gray-800 hover:bg-gray-100"
  } as const;
  return (
    <button className={`${base} ${styles[variant]}`} onClick={onClick} disabled={disabled}>{children}</button>
  );
}
function SmallBtn({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) {
  return (
    <button className="px-2 py-1 rounded-lg text-xs bg-gray-100 hover:bg-gray-200 border" onClick={onClick}>{children}</button>
  );
}
function Legend({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}
function Details({ title, children }: { title: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl shadow p-4 border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={() => setOpen((o) => !o)} className="text-sm text-gray-600 underline">{open ? "Hide" : "Show"}</button>
      </div>
      {open && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}
