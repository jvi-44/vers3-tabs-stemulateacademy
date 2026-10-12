import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "../../games/kit/audio";
import type { GameResult } from "../types";
import { HelperTip, Hud, Meter, MiniGameFrame, Pill, useFrame, type MiniGameProps } from "./kit";

// Forces: hold to fire the engines (thrust) against the Sun's pull (weight) and
// keep the ship inside the green safe lane while drag slows you down.

const SHIP_X = 0.28;
const SPAN = 7; // seconds of lane visible across the screen
const HALF = 0.14; // half the lane height
const DURATION = 26;
const HEAT_LINE = 0.84;
const GRAVITY = 0.62;
const THRUST = 1.45;
const DRAG = 1.2;

const lane = (t: number) => 0.44 + 0.17 * Math.sin(t * 0.55) + 0.07 * Math.sin(t * 1.6 + 1);

export function ThrustEscape({ onDone, helper }: MiniGameProps) {
  const [view, setView] = useState({ t: 0, y: 0.4, vy: 0, inside: 0, held: false, hot: false });
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const s = useRef({ t: 0, y: 0.4, vy: 0, inside: 0, held: false, hotTime: 0, warned: false });

  useFrame((dt) => {
    const g = s.current;
    g.t += dt;
    const a = GRAVITY - (g.held ? THRUST : 0) - g.vy * DRAG;
    g.vy += a * dt;
    g.y = Math.max(0.06, Math.min(0.94, g.y + g.vy * dt));
    if (g.y <= 0.06 || g.y >= 0.94) g.vy = 0;
    const ok = Math.abs(g.y - lane(g.t)) <= HALF;
    if (ok) g.inside += dt;
    const hot = g.y > HEAT_LINE;
    if (hot) {
      g.hotTime += dt;
      if (!g.warned) {
        g.warned = true;
        sfx.alarm();
        setTip("Too close to the Sun! Hold to thrust. Thrust must beat weight!");
      }
    } else if (g.y < 0.12 && !g.warned) {
      g.warned = true;
      setTip("Easy! Let go a little. Gravity will bring you back down.");
    }
    setView({ t: g.t, y: g.y, vy: g.vy, inside: g.inside, held: g.held, hot });
    if (g.t >= DURATION) {
      const ratio = g.inside / DURATION;
      setResult({ won: ratio >= 0.55, score: Math.round(ratio * 100) });
    }
  }, playing && !result);

  useEffect(() => {
    if (!tip) return;
    const id = setTimeout(() => {
      setTip(null);
      s.current.warned = false;
    }, 3500);
    return () => clearTimeout(id);
  }, [tip]);

  useEffect(() => {
    const set = (v: boolean) => (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (v && !s.current.held) sfx.whoosh();
        s.current.held = v;
      }
    };
    const down = set(true);
    const up = set(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const hold = (v: boolean) => {
    if (v && !s.current.held && playing) sfx.whoosh();
    s.current.held = v;
  };

  // The lane as an SVG polygon in a 100 x 100 box.
  const lanePath = useMemo(() => {
    const top: string[] = [];
    const bot: string[] = [];
    for (let k = 0; k <= 40; k++) {
      const x = k / 40;
      const c = lane(view.t + (x - SHIP_X) * SPAN);
      top.push(`${x * 100},${(c - HALF) * 100}`);
      bot.unshift(`${x * 100},${(c + HALF) * 100}`);
    }
    return [...top, ...bot].join(" ");
  }, [view.t]);

  const progress = Math.min(100, (view.t / DURATION) * 100);
  const inside = Math.abs(view.y - lane(view.t)) <= HALF;
  const stars = useMemo(
    () => Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 0.8, s: 1 + Math.random() * 2 })),
    [],
  );

  return (
    <MiniGameFrame
      title="Solar Escape"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        <>
          <p>The Sun's gravity is pulling the SKELD down!</p>
          <p>
            <b>Hold</b> anywhere (or the space bar) to fire the engines. Thrust pushes you up, weight pulls you down, drag slows you. Stay
            in the <b>green lane</b> to escape!
          </p>
        </>
      }
    >
      <div
        className="absolute inset-0 overflow-hidden touch-none select-none bg-[linear-gradient(#0b1026_0%,#1e1b4b_55%,#7c2d12_88%,#f97316_100%)]"
        onPointerDown={() => hold(true)}
        onPointerUp={() => hold(false)}
        onPointerCancel={() => hold(false)}
        onPointerLeave={() => hold(false)}
      >
        {stars.map((st, k) => (
          <span
            key={k}
            className="absolute rounded-full bg-white/80"
            style={{ left: `${((((st.x - view.t * 0.03 * st.s) % 1) + 1) % 1) * 100}%`, top: `${st.y * 100}%`, width: st.s, height: st.s }}
          />
        ))}

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <polygon points={lanePath} fill="rgba(74,222,128,0.28)" stroke="#4ade80" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          {/* The Sun's heat zone */}
          <rect
            x="0"
            y={HEAT_LINE * 100}
            width="100"
            height={(1 - HEAT_LINE) * 100}
            fill={view.hot ? "rgba(239,68,68,0.55)" : "rgba(251,146,60,0.35)"}
          />
          <line
            x1="0"
            x2="100"
            y1={HEAT_LINE * 100}
            y2={HEAT_LINE * 100}
            stroke="#fde047"
            strokeDasharray="2 1.5"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute right-2 bottom-1 text-[11px] font-black uppercase tracking-wider text-[#fef08a] drop-shadow">
          Sun heat zone
        </span>

        {/* The ship with its force arrows */}
        <div
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${view.hot ? "animate-[ep-shake_0.25s_infinite]" : ""}`}
          style={{ left: `${SHIP_X * 100}%`, top: `${view.y * 100}%` }}
        >
          <div className="relative">
            <svg
              viewBox="0 0 64 40"
              className="w-20 sm:w-24"
              style={{ transform: `rotate(${Math.max(-18, Math.min(18, view.vy * 30))}deg)` }}
              aria-hidden
            >
              {view.held && (
                <path d="M4 20 L-6 14 L-2 20 L-6 26 Z" transform="translate(6 0)" fill="#fb923c" stroke="#1f1a17" strokeWidth="2" />
              )}
              <path d="M8 10 H44 Q60 12 62 20 Q60 28 44 30 H8 Z" fill="#e2e8f0" stroke="#1f1a17" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="46" cy="20" r="5" fill="#7dd3fc" stroke="#1f1a17" strokeWidth="2.5" />
              <path
                d="M12 10 L6 2 H20 L26 10 Z M12 30 L6 38 H20 L26 30 Z"
                fill="#ef4444"
                stroke="#1f1a17"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* Thrust (up) */}
            {view.held && <Arrow dir="up" color="#fb923c" label="Thrust" />}
            {/* Weight (down) */}
            <Arrow dir="down" color="#f43f5e" label="Weight" />
            {/* Drag (backwards) */}
            <Arrow dir="left" color="#94a3b8" label="Drag" />
          </div>
        </div>

        <Hud>
          <Pill className={inside ? "bg-[#bbf7d0]" : "bg-[#fecaca]"}>{inside ? "In the lane" : "Get back in!"}</Pill>
          <div className="flex-1 min-w-0">
            <Meter value={progress} max={100} color="linear-gradient(90deg,#38bdf8,#4ade80)" label="Escape" />
          </div>
          <Pill>{Math.round((view.inside / Math.max(1, view.t)) * 100)}%</Pill>
        </Hud>

        <HelperTip bot={helper} text={tip} className="right-2 top-12 flex-row-reverse" />
      </div>
    </MiniGameFrame>
  );
}

function Arrow({ dir, color, label }: { dir: "up" | "down" | "left"; color: string; label: string }) {
  const pos =
    dir === "up"
      ? "left-1/2 -translate-x-1/2 bottom-full mb-0.5 flex-col"
      : dir === "down"
        ? "left-1/2 -translate-x-1/2 top-full mt-0.5 flex-col-reverse"
        : "right-full mr-0.5 top-1/2 -translate-y-1/2 flex-row";
  const shaft = dir === "left" ? "w-7 h-1.5" : "w-1.5 h-6";
  const head =
    dir === "up"
      ? "border-x-[7px] border-x-transparent border-b-[9px]"
      : dir === "down"
        ? "border-x-[7px] border-x-transparent border-t-[9px]"
        : "border-y-[7px] border-y-transparent border-r-[9px]";
  return (
    <div className={`absolute flex items-center pointer-events-none ${pos}`}>
      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1 rounded bg-black/50" style={{ color }}>
        {label}
      </span>
      <div className={`flex items-center ${dir === "left" ? "flex-row" : dir === "up" ? "flex-col" : "flex-col-reverse"}`}>
        <span
          className={`w-0 h-0 ${head}`}
          style={{
            borderBottomColor: dir === "up" ? color : undefined,
            borderTopColor: dir === "down" ? color : undefined,
            borderRightColor: dir === "left" ? color : undefined,
          }}
        />
        <span className={shaft} style={{ background: color }} />
      </div>
    </div>
  );
}
