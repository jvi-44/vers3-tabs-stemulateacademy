import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Rocket } from "lucide-react";
import { sfx } from "../../games/kit/audio";
import type { GameResult } from "../types";
import { HelperTip, Hud, Meter, MiniGameFrame, Pill, type MiniGameProps } from "./kit";
import {
  LAUNCHES,
  MAX_POINTS,
  TRIES,
  doneLine,
  escaped,
  launchLine,
  launchPoints,
  launchTip,
  launchesFor,
  outcomeFor,
  retryLine,
  type Outcome,
} from "./launchLogic";

// Solar Escape (Space Busters story): three launches away from the Sun. Set
// the engine power so the up arrow (thrust) beats the arrows pulling down
// (the Sun's weight, and for P5–6 drag from a dust cloud), then fire. One
// step at a time, no timing skill needed; the numbers follow the band.

const FLIGHT_MS = 1500;

export function ThrustEscape({ onDone, helper, band }: MiniGameProps) {
  const launches = useMemo(() => launchesFor(band), [band]);
  const [playing, setPlaying] = useState(false);
  const [li, setLi] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [thrust, setThrust] = useState(1);
  const [points, setPoints] = useState(0);
  const [flight, setFlight] = useState<Outcome | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  // What happened, read out by screen readers (the thrust display reads out the power).
  const [said, setSaid] = useState("");
  const [result, setResult] = useState<GameResult | null>(null);
  const pointsRef = useRef(0);

  const launch = launches[li];
  const down = launch.weight + launch.drag;
  const busy = !playing || flight !== null || result !== null;
  const numbers = band !== "p12";

  useEffect(() => {
    if (playing && li === 0 && attempt === 0) {
      const first = band === "p12" ? "Make the up arrow longer than the down arrow, then fire!" : "Thrust must beat the pull. Set the power, then fire!";
      setTip(first);
      setSaid(`Launch 1 of ${LAUNCHES}. ${first}`);
    }
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (by: number) => {
    if (busy) return;
    const next = Math.max(1, Math.min(launch.maxThrust, thrust + by));
    if (next !== thrust) sfx.click();
    setThrust(next);
  };

  const fire = () => {
    if (busy) return;
    const outcome = outcomeFor(thrust, launch);
    sfx.whoosh();
    setFlight(outcome);
    const line = launchTip(outcome, thrust, launch, band);
    setTip(line);
    setSaid(line);
    setTimeout(() => {
      setFlight(null);
      if (escaped(outcome) || attempt + 1 >= TRIES) {
        let boost = "";
        if (escaped(outcome)) sfx.correct();
        else {
          // Out of tries: Emily boosts the engines so the story can go on.
          boost = band === "p12" ? `Emily added blocks: ${down + 1} beats the pull of ${down}.` : `Emily set thrust to ${down + 1}, just more than ${down}.`;
          setTip(boost);
        }
        const total = pointsRef.current + launchPoints(outcome, attempt);
        pointsRef.current = total;
        setPoints(total);
        if (li + 1 >= LAUNCHES) {
          const won = total >= MAX_POINTS / 2;
          setSaid(`${boost} ${doneLine(won)}`.trim());
          setResult({ won, score: Math.round((total / MAX_POINTS) * 100) });
        } else {
          setSaid(`${boost} ${launchLine(li + 1, band)}`.trim());
          setLi(li + 1);
          setAttempt(0);
          setThrust(1);
        }
      } else {
        sfx.wrong();
        setSaid(retryLine(attempt + 1));
        setAttempt(attempt + 1);
      }
    }, FLIGHT_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave keys alone on the how-to card and the result banner.
      if (busy) return;
      if (e.key === "ArrowUp" || e.key === "+" || e.key === "=") {
        e.preventDefault();
        change(1);
      } else if (e.key === "ArrowDown" || e.key === "-") {
        e.preventDefault();
        change(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stars = useMemo(
    () => Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random() * 0.7, s: 1 + Math.random() * 2 })),
    [],
  );
  // Block size so the tallest stack fits the stage.
  const tallest = Math.max(launch.maxThrust, down);
  const block = Math.max(7, Math.min(16, Math.floor(150 / tallest)));
  const shipShift = flight === "perfect" || flight === "climb" ? "-120%" : flight === "sink" ? "18%" : "0%";

  return (
    <MiniGameFrame
      title="Solar Escape"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        band === "p12" ? (
          <>
            <p>The Sun is pulling the SKELD down! Our engines push it up.</p>
            <p>
              Tap <b>+</b> to add engine blocks until the <b>orange up arrow</b> is longer than the <b>red down arrow</b>, then press{" "}
              <b>Fire!</b> Just one block longer saves fuel.
            </p>
          </>
        ) : (
          <>
            <p>The Sun's gravity is pulling the SKELD down! Thrust from our engines pushes it up.</p>
            <p>
              Set the thrust with <b>+</b> and <b>−</b> (or ↑ ↓), then press <b>Fire!</b> (Enter). Thrust must beat{" "}
              {band === "p56" ? "weight + drag" : "the weight"}. Just 1 more saves fuel. 3 launches, 2 tries each.
            </p>
          </>
        )
      }
    >
      <div className="absolute inset-0 overflow-hidden select-none bg-[linear-gradient(#0b1026_0%,#1e1b4b_55%,#7c2d12_88%,#f97316_100%)]">
        {stars.map((st, k) => (
          <span key={k} className="absolute rounded-full bg-white/80" style={{ left: `${st.x * 100}%`, top: `${st.y * 100}%`, width: st.s, height: st.s }} />
        ))}
        {launch.drag > 0 && (
          <div className="absolute inset-x-0 top-[22%] h-[30%] bg-[radial-gradient(ellipse_at_center,rgba(203,213,225,0.28),transparent_70%)]" aria-hidden />
        )}
        <span className="absolute right-2 bottom-24 sm:bottom-28 text-[11px] font-black uppercase tracking-wider text-[#fef08a] drop-shadow">The Sun</span>

        <Hud>
          <Pill>
            Launch {li + 1} / {LAUNCHES}
          </Pill>
          <div className="flex-1 min-w-0">
            <Meter value={points} max={MAX_POINTS} color="linear-gradient(90deg,#38bdf8,#4ade80)" label="Escape" />
          </div>
          <Pill>{attempt === 0 ? "1st try" : "Last try"}</Pill>
        </Hud>

        {/* The ship and its forces */}
        <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 sm:gap-6">
          <ForceStack label={numbers ? `Thrust ${thrust}` : "Engines push"} n={thrust} block={block} color="#fb923c" dir="up" />
          <div
            className="transition-transform ease-in-out motion-reduce:transition-none"
            style={{ transform: `translateY(${shipShift})`, transitionDuration: `${FLIGHT_MS - 200}ms` }}
          >
            <svg viewBox="0 0 40 64" className={`w-14 sm:w-16 ${flight === "hover" ? "animate-pulse" : ""}`} aria-hidden>
              {flight && flight !== "sink" && <path d="M14 56 L20 66 L26 56 Z" fill="#fb923c" stroke="#1f1a17" strokeWidth="2" />}
              <path d="M20 2 Q34 14 32 40 H8 Q6 14 20 2 Z" fill="#e2e8f0" stroke="#1f1a17" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="20" cy="22" r="5" fill="#7dd3fc" stroke="#1f1a17" strokeWidth="2.5" />
              <path d="M8 34 L2 52 H10 L12 40 Z M32 34 L38 52 H30 L28 40 Z" fill="#ef4444" stroke="#1f1a17" strokeWidth="2.5" strokeLinejoin="round" />
              <rect x="12" y="40" width="16" height="16" rx="3" fill="#94a3b8" stroke="#1f1a17" strokeWidth="2.5" />
            </svg>
          </div>
          <div className="flex items-start gap-2">
            <ForceStack label={numbers ? `Weight ${launch.weight}` : "Sun pulls"} n={launch.weight} block={block} color="#f43f5e" dir="down" />
            {launch.drag > 0 && <ForceStack label={`Drag ${launch.drag}`} n={launch.drag} block={block} color="#94a3b8" dir="down" />}
          </div>
        </div>

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex items-center justify-center gap-2 sm:gap-3">
          <button onClick={() => change(-1)} disabled={busy || thrust <= 1} aria-label="Less engine power" className="ep-btn !px-4 !py-3 min-w-12 disabled:opacity-40">
            <Minus size={22} strokeWidth={3} aria-hidden />
          </button>
          <span className="min-w-28 text-center rounded-xl border-2 border-[#1f1a17] bg-white px-3 py-2 font-black text-[#1f1a17]" aria-live="polite">
            {numbers ? `Thrust ${thrust}` : `${thrust} ${thrust === 1 ? "block" : "blocks"}`}
          </span>
          <button onClick={() => change(1)} disabled={busy || thrust >= launch.maxThrust} aria-label="More engine power" className="ep-btn !px-4 !py-3 min-w-12 disabled:opacity-40">
            <Plus size={22} strokeWidth={3} aria-hidden />
          </button>
          <button onClick={fire} disabled={busy} className="ep-btn ep-btn-go !px-5 !py-3 flex items-center gap-2 disabled:opacity-40">
            <Rocket size={20} aria-hidden /> Fire!
          </button>
        </div>

        <HelperTip bot={helper} text={tip} className="right-2 top-12 flex-row-reverse" />
        <p className="sr-only" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </MiniGameFrame>
  );
}

/** A force drawn as a stack of blocks, so it can be counted and compared. */
function ForceStack({ label, n, block, color, dir }: { label: string; n: number; block: number; color: string; dir: "up" | "down" }) {
  const blocks = Array.from({ length: n }, (_, k) => (
    <span key={k} className="block rounded-[3px] border-2 border-[#1f1a17]" style={{ width: block * 1.6, height: block, background: color }} />
  ));
  const head = (
    <span
      className="w-0 h-0 border-x-[10px] border-x-transparent"
      style={dir === "up" ? { borderBottom: `12px solid ${color}` } : { borderTop: `12px solid ${color}` }}
    />
  );
  return (
    <div className={`flex items-center gap-1 ${dir === "up" ? "flex-col" : "flex-col-reverse"}`} aria-label={label}>
      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-1.5 rounded bg-black/55 whitespace-nowrap" style={{ color }}>
        {label}
      </span>
      {head}
      <div className={`flex gap-0.5 ${dir === "up" ? "flex-col" : "flex-col-reverse"}`}>{blocks}</div>
    </div>
  );
}
