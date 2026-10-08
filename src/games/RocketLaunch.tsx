// Launching a Spaceship — Space Busters science game ("Operation Solar Escape").
// Pick fuel and cargo, then hold THRUST to climb and balance the forces so the
// ship stays steady inside the orbit zone. Big live force arrows (thrust,
// weight, air resistance) and an energy panel (chemical → kinetic + height)
// show the physics. Five missions: Earth, Moon, Mars, heavy cargo, windy day.

import { useEffect, useMemo, useRef, useState } from "react";
import { Fuel, Package, Timer, Wind } from "lucide-react";
import { cn } from "../components/ui/utils";
import { STEMBOTS } from "../data/mock";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import type { GameProps } from "./kit/types";

// ── Missions ─────────────────────────────────────────────
interface MissionDef {
  name: string;
  place: string;
  emoji: string;
  /** Gravitational pull, N per kg. */
  g: number;
  /** Max engine thrust (game units; ×100 = newtons). */
  thrust: number;
  /** Fuel burnt per second at full throttle. */
  burn: number;
  /** Air resistance strength. */
  drag: number;
  gusts: boolean;
  zone: [number, number];
  minCargo: number;
  idealT: number;
  air: string;
  tip: string;
  sky: [string, string];
  ground: [string, string];
}

const MISSIONS: MissionDef[] = [
  {
    name: "Escape to Earth Orbit",
    place: "Earth",
    emoji: "🌍",
    g: 10,
    thrust: 70,
    burn: 9,
    drag: 0.012,
    gusts: false,
    zone: [56, 72],
    minCargo: 1,
    idealT: 8,
    air: "Normal air",
    tip: "Earth pulls with 10 N for every kg. Push hard to lift off, then ease off so thrust equals weight!",
    sky: ["#7dd3fc", "#1e1b4b"],
    ground: ["#4ade80", "#15803d"],
  },
  {
    name: "Moon Hop",
    place: "Moon",
    emoji: "🌕",
    g: 1.6,
    thrust: 12,
    burn: 5.2,
    drag: 0,
    gusts: false,
    zone: [44, 60],
    minCargo: 1,
    idealT: 12,
    air: "No air at all",
    tip: "The Moon's gravity is weak, so you slow down very gently. Tap softly or you will float away!",
    sky: ["#1e293b", "#020617"],
    ground: ["#cbd5e1", "#64748b"],
  },
  {
    name: "Mars Dash",
    place: "Mars",
    emoji: "🔴",
    g: 3.8,
    thrust: 27,
    burn: 7.8,
    drag: 0.004,
    gusts: false,
    zone: [52, 68],
    minCargo: 2,
    idealT: 10,
    air: "Thin air",
    tip: "Mars pulls about 4 N per kg. We need 2 supply crates for the crew!",
    sky: ["#fdba74", "#431407"],
    ground: ["#f97316", "#9a3412"],
  },
  {
    name: "Heavy Cargo Run",
    place: "Earth",
    emoji: "📦",
    g: 10,
    thrust: 80,
    burn: 10.4,
    drag: 0.012,
    gusts: false,
    zone: [50, 66],
    minCargo: 3,
    idealT: 8,
    air: "Normal air",
    tip: "Three crates means more mass, so more weight! You'll need more thrust to stay balanced.",
    sky: ["#93c5fd", "#1e1b4b"],
    ground: ["#4ade80", "#15803d"],
  },
  {
    name: "Windy Launch Day",
    place: "Earth",
    emoji: "🌬️",
    g: 10,
    thrust: 75,
    burn: 9,
    drag: 0.03,
    gusts: true,
    zone: [56, 72],
    minCargo: 1,
    idealT: 8,
    air: "Thick air + gusts",
    tip: "Strong air resistance and gusty wind today! Watch the grey arrow and keep correcting.",
    sky: ["#a5b4fc", "#1e1b4b"],
    ground: ["#4ade80", "#15803d"],
  },
];

const QUESTIONS = [
  { q: "When the ship hovers steadily, thrust and weight are…", options: ["Balanced", "Unbalanced", "Both zero"], a: 0 },
  { q: "Which force pulls the rocket back down?", options: ["Gravity", "Thrust", "Magnetic force"], a: 0 },
  { q: "The energy stored in rocket fuel is…", options: ["Chemical potential energy", "Kinetic energy", "Sound energy"], a: 0 },
  { q: "As the rocket climbs higher, it gains more…", options: ["Gravitational potential energy", "Chemical potential energy", "Mass"], a: 0 },
  { q: "Air resistance always acts…", options: ["Opposite to the motion", "In the same direction as the motion", "Upwards"], a: 0 },
  { q: "Why does the rocket weigh less on the Moon?", options: ["The Moon's gravity is weaker", "Its mass is smaller there", "The Moon has no light"], a: 0 },
  { q: "If thrust is bigger than weight, the rocket will…", options: ["Speed up upwards", "Stay still", "Fall down"], a: 0 },
  { q: "Loading more cargo makes the rocket's weight…", options: ["Increase", "Decrease", "Stay the same"], a: 0 },
  { q: "A rocket moving fast has a lot of…", options: ["Kinetic energy", "Chemical energy", "No energy"], a: 0 },
  { q: "Burning fuel changes chemical energy into…", options: ["Kinetic energy, heat and sound", "Only light energy", "More fuel"], a: 0 },
];

const MISSION_MAX = 16;
const QUESTION_POINTS = 10;
const QUIZ_AFTER = new Set([1, 3]);
const DRY_MASS = 2;
const FUEL_MASS = 0.02;
const CRATE_MASS = 0.5;
const THR_UP = 1.2;
const THR_DOWN = 0.8;
const HOLD_NEEDED = 2;
const TIME_LIMIT = 40;
const FUEL_STEPS = [30, 40, 50, 60, 70, 80, 90, 100];
const GROUND = 50; // px of ground at the bottom of the flight view
const ROCKET_H = 112; // px (nose to nozzle)

type Phase = "prep" | "flight" | "result" | "quiz" | "done";
type Outcome = "orbit" | "crash" | "lost" | "timeout";

interface Sim {
  h: number;
  v: number;
  fuel: number;
  thr: number;
  t: number;
  hold: number;
  maxH: number;
  launched: boolean;
  inZone: boolean;
  lowFuelWarned: boolean;
  gust: number;
}

interface Result {
  outcome: Outcome;
  pts: number;
  why: string;
  lines: { label: string; value: string }[];
  time: number;
  fuelLoaded: number;
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

function mixHex(a: string, b: string, t: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return "#" + pa.slice(0, 3).map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Vertical screen position (CSS bottom) for an altitude 0–100, measured to the rocket's centre. */
const SPAN = `(100% - ${GROUND + ROCKET_H / 2 + 26}px)`;
const altY = (h: number) => `calc(${GROUND + ROCKET_H / 2}px + ${clamp(h / 100, -0.2, 1.1)} * ${SPAN})`;

export function RocketLaunch({ seed, reportProgress, finish }: GameProps) {
  const rnd = useMemo(() => seededRandom(seed), [seed]);

  // Seeded variations so every live player gets the same missions.
  const missions = useMemo(
    () =>
      MISSIONS.map((m) => {
        const shift = Math.round((rnd() - 0.5) * 12);
        const gp = [rnd() * 6, rnd() * 6, 0.9 + rnd() * 0.6, 0.4 + rnd() * 0.4];
        return { ...m, zone: [m.zone[0] + shift, m.zone[1] + shift] as [number, number], gp };
      }),
    [rnd],
  );
  const questions = useMemo(
    () =>
      [...QUESTIONS]
        .sort(() => rnd() - 0.5)
        .slice(0, 2)
        .map((q) => {
          const order = [0, 1, 2].sort(() => rnd() - 0.5);
          return { q: q.q, options: order.map((i) => q.options[i]), a: order.indexOf(q.a) };
        }),
    [rnd],
  );

  const [missionIdx, setMissionIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("prep");
  const [fuelPick, setFuelPick] = useState(60);
  const [cargoPick, setCargoPick] = useState(MISSIONS[0].minCargo);
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [qPts, setQPts] = useState(0);
  const [qCorrect, setQCorrect] = useState(0);
  const [quizN, setQuizN] = useState(0);
  const [quiz, setQuiz] = useState<{ idx: number; left: number; picked: number | null } | null>(null);
  const [frame, setFrame] = useState<Sim | null>(null);
  const [holding, setHolding] = useState(false);
  const [pressedOnce, setPressedOnce] = useState(false);

  const mission = missions[Math.min(missionIdx, missions.length - 1)];
  const simRef = useRef<Sim | null>(null);
  const holdRef = useRef(false);
  holdRef.current = holding;

  // Wait for the shell's 3-2-1 countdown before launches are allowed.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2600);
    return () => clearTimeout(t);
  }, []);

  const missionPts = results.reduce((s, r) => s + r.pts, 0);
  const score = Math.min(100, Math.round(missionPts + qPts));
  const orbits = results.filter((r) => r.outcome === "orbit").length;
  const progress = Math.min(1, results.length / missions.length);

  useEffect(() => {
    reportProgress(score, progress);
  }, [score, progress, reportProgress]);

  const finishedRef = useRef(false);
  useEffect(() => {
    if (phase !== "done" || finishedRef.current) return;
    finishedRef.current = true;
    const flightTime = results.reduce((s, r) => s + r.time, 0);
    const t = setTimeout(
      () =>
        finish(score, [
          { label: "Orbits reached", value: `${orbits}/${missions.length}` },
          { label: "Bonus questions", value: `${qCorrect}/${questions.length}` },
          { label: "Avg fuel loaded", value: `${Math.round(results.reduce((s, r) => s + r.fuelLoaded, 0) / Math.max(1, results.length))} units` },
          { label: "Flight time", value: `${Math.round(flightTime)}s` },
        ]),
      700,
    );
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const mass = DRY_MASS + fuelPick * FUEL_MASS + cargoPick * CRATE_MASS;

  // ── Launch ─────────────────────────────────────────────
  const launch = () => {
    if (!ready || phase !== "prep") return;
    const s: Sim = { h: 0, v: 0, fuel: fuelPick, thr: 0, t: 0, hold: 0, maxH: 0, launched: false, inZone: false, lowFuelWarned: false, gust: 0 };
    simRef.current = s;
    setFrame({ ...s });
    setPressedOnce(false);
    setPhase("flight");
    sfx.go();
  };

  const endFlight = (outcome: Outcome, s: Sim) => {
    const m = mission;
    let pts = 0;
    let why = "";
    const lines: { label: string; value: string }[] = [];
    if (outcome === "orbit") {
      const eff = clamp((90 - fuelPick) / 50);
      const speed = clamp(1 - (s.t - m.idealT * 1.3) / 15);
      const extra = Math.min(2, cargoPick - m.minCargo);
      pts = 8 + 3 * eff + 3 * speed + extra;
      why = "Thrust matched weight, so the forces were balanced and the ship stayed steady. Orbit!";
      lines.push({ label: "Orbit reached", value: "+8" });
      lines.push({ label: `Light fuel load (${fuelPick})`, value: `+${(3 * eff).toFixed(1)}` });
      lines.push({ label: `Speed (${s.t.toFixed(1)}s)`, value: `+${(3 * speed).toFixed(1)}` });
      if (extra > 0) lines.push({ label: "Extra supply crates", value: `+${extra}` });
      sfx.correct();
      setTimeout(() => sfx.levelUp(), 350);
    } else {
      pts = 3 * clamp(s.maxH / m.zone[0]);
      if (outcome === "crash") {
        why =
          s.fuel <= 0
            ? "Out of fuel! With no thrust, only weight pulled on the ship, so it fell back down. Try more fuel or gentler flying."
            : "Weight was bigger than thrust for too long, so the ship sped up downwards. Hold THRUST sooner to slow the fall!";
        sfx.explode();
      } else if (outcome === "lost") {
        why = "Thrust stayed bigger than weight, so the unbalanced force kept speeding you up. Let go earlier to let gravity slow you!";
        sfx.wrong();
      } else {
        why = s.fuel <= 0 ? "The fuel tank ran dry before reaching orbit." : "Time's up! Climb to the green zone and hold steady there.";
        sfx.wrong();
      }
      lines.push({ label: `Best height ${Math.round(s.maxH)} km`, value: `+${pts.toFixed(1)}` });
    }
    pts = Math.min(MISSION_MAX, pts);
    setResults((r) => [...r, { outcome, pts, why, lines, time: s.t, fuelLoaded: fuelPick }]);
    setHolding(false);
    setPhase("result");
  };
  const endRef = useRef(endFlight);
  endRef.current = endFlight;

  // ── Physics loop ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "flight") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const m = mission;
    const step = (now: number) => {
      const s = simRef.current;
      if (!s) return;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const massNow = DRY_MASS + s.fuel * FUEL_MASS + cargoPick * CRATE_MASS;
      s.thr = clamp(s.thr + (holdRef.current && s.fuel > 0 ? THR_UP : -THR_DOWN) * dt);
      const T = s.fuel > 0 ? s.thr * m.thrust : 0;
      const W = massNow * m.g;
      const D = m.drag * s.v * Math.abs(s.v);
      const [p1, p2, w1, w2] = m.gp;
      s.gust = m.gusts ? 9 * (0.6 * Math.sin(s.t * w1 + p1) + 0.4 * Math.sin(s.t * w2 * 3 + p2)) : 0;
      const onPad = s.h <= 0 && T + s.gust <= W;
      const a = onPad ? 0 : (T - W - D + s.gust) / massNow;
      s.v += a * dt;
      s.h += s.v * dt;
      s.fuel = Math.max(0, s.fuel - s.thr * m.burn * dt);
      if (s.fuel <= 0) s.thr = 0;
      s.t += dt;
      s.maxH = Math.max(s.maxH, s.h);
      if (!s.launched && s.h > 0.5) {
        s.launched = true;
        sfx.launch();
      }
      if (!s.lowFuelWarned && s.fuel < fuelPick * 0.2) {
        s.lowFuelWarned = true;
        sfx.alarm();
      }
      if (s.h <= 0) {
        if (s.launched && s.v < -8) {
          s.h = 0;
          setFrame({ ...s });
          endRef.current("crash", s);
          return;
        }
        s.h = 0;
        s.v = Math.max(0, s.v);
        if (s.fuel <= 0) {
          setFrame({ ...s });
          endRef.current(s.launched ? "crash" : "timeout", s);
          return;
        }
      }
      if (s.h > 100) {
        setFrame({ ...s });
        endRef.current("lost", s);
        return;
      }
      const inZone = s.h >= m.zone[0] && s.h <= m.zone[1];
      if (inZone && !s.inZone) sfx.whoosh();
      s.inZone = inZone;
      if (inZone) {
        const before = Math.floor(s.hold * 2);
        s.hold += dt;
        if (Math.floor(s.hold * 2) > before) sfx.tick();
        if (s.hold >= HOLD_NEEDED) {
          setFrame({ ...s });
          endRef.current("orbit", s);
          return;
        }
      } else s.hold = Math.max(0, s.hold - dt * 2);
      if (s.t >= TIME_LIMIT) {
        setFrame({ ...s });
        endRef.current("timeout", s);
        return;
      }
      acc += dt;
      if (acc >= 1 / 40) {
        acc = 0;
        setFrame({ ...s });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: Space / ↑ to thrust, Enter to launch / continue.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        if (phaseRef.current === "flight") {
          e.preventDefault();
          if (!holdRef.current) {
            setHolding(true);
            setPressedOnce(true);
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") setHolding(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // ── Between missions ───────────────────────────────────
  const next = () => {
    if (phase === "result" && QUIZ_AFTER.has(missionIdx) && quizN < questions.length) {
      setQuiz({ idx: quizN, left: 10, picked: null });
      setQuizN((n) => n + 1);
      setPhase("quiz");
      sfx.alarm();
      return;
    }
    goNextMission();
  };
  const goNextMission = () => {
    setQuiz(null);
    const ni = missionIdx + 1;
    if (ni >= missions.length) {
      setPhase("done");
      sfx.fanfare();
      return;
    }
    setMissionIdx(ni);
    setCargoPick(missions[ni].minCargo);
    setFrame(null);
    simRef.current = null;
    setPhase("prep");
    sfx.pop();
  };

  // Auto-advance after a result so live races keep moving.
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => nextRef.current(), 6000);
    return () => clearTimeout(t);
  }, [phase, missionIdx]);
  const nextRef = useRef(next);
  nextRef.current = next;

  // Quiz countdown
  useEffect(() => {
    if (phase !== "quiz" || !quiz || quiz.picked !== null) return;
    const id = setInterval(() => {
      setQuiz((q) => {
        if (!q || q.picked !== null) return q;
        const left = q.left - 0.1;
        if (left <= 0) return { ...q, left: 0, picked: -1 };
        return { ...q, left };
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase, quiz?.idx, quiz?.picked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== "quiz" || quiz?.picked !== -1) return;
    sfx.wrong();
    const t = setTimeout(() => goNextRef.current(), 1100);
    return () => clearTimeout(t);
  }, [phase, quiz?.picked]);
  const goNextRef = useRef(goNextMission);
  goNextRef.current = goNextMission;

  const answer = (i: number) => {
    if (!quiz || quiz.picked !== null) return;
    const q = questions[quiz.idx];
    if (i === q.a) {
      sfx.correct();
      setQPts((p) => p + QUESTION_POINTS * Math.max(0.5, quiz.left / 10));
      setQCorrect((c) => c + 1);
    } else sfx.wrong();
    setQuiz({ ...quiz, picked: i });
    setTimeout(() => goNextRef.current(), 1300);
  };

  // ── Derived visuals ────────────────────────────────────
  const s: Sim = frame ?? { h: 0, v: 0, fuel: fuelPick, thr: 0, t: 0, hold: 0, maxH: 0, launched: false, inZone: false, lowFuelWarned: false, gust: 0 };
  const massNow = DRY_MASS + s.fuel * FUEL_MASS + cargoPick * CRATE_MASS;
  const W = massNow * mission.g;
  const T = s.fuel > 0 ? s.thr * mission.thrust : 0;
  const D = mission.drag * s.v * Math.abs(s.v);
  const onPad = s.h <= 0 && T + s.gust <= W;
  const support = onPad ? W - T : 0; // the launch pad pushes up while we sit on it
  const net = T + support - W - D + s.gust;
  const balanced = Math.abs(net) < Math.max(0.6, W * 0.08);
  const lastResult = results[results.length - 1];
  const crashed = phase === "result" && lastResult?.outcome === "crash";
  const lost = phase === "result" && lastResult?.outcome === "lost";
  const won = phase === "result" && lastResult?.outcome === "orbit";

  const forceStatus = onPad
    ? s.thr > 0.02
      ? { text: "Thrust < weight: still on the pad", tone: "bg-amber-400 text-slate-900" }
      : { text: "On the pad: hold THRUST!", tone: "bg-white text-slate-900" }
    : balanced
      ? { text: "Balanced: steady speed!", tone: "bg-emerald-400 text-slate-900" }
      : net > 0
        ? s.v >= 0
          ? { text: "Unbalanced: speeding up ⬆", tone: "bg-sky-400 text-slate-900" }
          : { text: "Unbalanced: slowing the fall", tone: "bg-sky-300 text-slate-900" }
        : s.v > 0
          ? { text: "Unbalanced: slowing down", tone: "bg-orange-300 text-slate-900" }
          : { text: "Unbalanced: falling faster ⬇", tone: "bg-rose-500 text-white" };

  const altFrac = clamp(s.h / 100);
  const skyLow = mixHex(mission.sky[0], mission.sky[1], altFrac * 0.75);
  const skyHigh = mixHex(mission.sky[0], mission.sky[1], 0.55 + altFrac * 0.45);
  const starOpacity = mission.place === "Moon" ? 1 : clamp((s.h - 25) / 50);
  const stars = useMemo(() => {
    const r = seededRandom(seed + 7);
    return Array.from({ length: 46 }, () => ({ x: r() * 100, y: r() * 100, s: 1 + Math.round(r() * 2), d: r() * 3 }));
  }, [seed]);

  const arrowScale = 120 / mission.thrust; // px per force unit
  const eRef = massNow * mission.g * 100 || 1;
  const ke = clamp((0.5 * massNow * s.v * s.v) / eRef);
  const gpe = clamp((massNow * mission.g * s.h) / eRef);
  const chem = clamp(s.fuel / 100);
  const timeLeft = Math.max(0, Math.ceil(TIME_LIMIT - s.t));
  const tilt = (s.gust || 0) * 0.6 + (crashed ? 70 : 0);
  const shake = phase === "flight" && s.thr > 0.6 ? (Math.sin(s.t * 60) * s.thr * 1.2).toFixed(2) : "0";
  const showPhysics = phase === "flight" || won;

  const missionNo = Math.min(missionIdx + 1, missions.length);

  return (
    <div
      className="absolute inset-0 isolate @container flex flex-col overflow-hidden select-none game-fun"
      style={{ background: `linear-gradient(to top, ${skyLow}, ${skyHigh})` }}
      data-h={s.h.toFixed(2)}
      data-v={s.v.toFixed(2)}
      data-thr={s.thr.toFixed(2)}
      data-phase={phase}
      data-zone={mission.zone.join(",")}
      data-hover={(W / mission.thrust).toFixed(3)}
    >
      <style>{ROCKET_CSS}</style>

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: starOpacity, transform: `translateY(${s.h * 0.6}px)` }}>
        {stars.map((st, i) => (
          <span
            key={i}
            className="absolute bg-white rl-twinkle"
            style={{ left: `${st.x}%`, top: `${st.y * 0.9 - 30}%`, width: st.s * 2, height: st.s * 2, animationDelay: `${st.d}s` }}
          />
        ))}
        {mission.place !== "Earth" && (
          <div
            className="absolute right-[18%] top-[16%] w-10 h-10 rounded-full"
            style={{ background: "radial-gradient(circle at 35% 35%, #93c5fd, #2563eb 60%, #1e3a8a)", boxShadow: "0 0 18px #60a5fa88" }}
            title="Earth"
          />
        )}
      </div>

      {/* HUD */}
      <div className="relative z-20 flex items-stretch gap-2 p-2 @xl:p-3">
        <div className="flex-1 min-w-0 bg-white/95 rounded-2xl game-panel px-3 py-1.5 flex items-center gap-2 @xl:gap-3">
          <span className="text-2xl @xl:text-3xl">{mission.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[8px] @xl:text-[9px] text-slate-500">
              MISSION {missionNo}/{missions.length} · {mission.place.toUpperCase()}
            </p>
            <p className="font-bold text-slate-900 leading-tight text-sm @xl:text-base truncate">{mission.name}</p>
            <div className="flex gap-1 mt-1">
              {missions.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded-full border border-black/10",
                    i < results.length ? (results[i].outcome === "orbit" ? "bg-emerald-500" : "bg-rose-400") : i === missionIdx ? "bg-amber-300" : "bg-slate-200",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-2 @xl:px-3 py-1.5 flex flex-col items-center justify-center min-w-[58px] @xl:min-w-[78px]">
          <Timer size={14} className="text-amber-300" />
          <span className={cn("game-pixel text-xs @xl:text-sm", phase === "flight" && timeLeft <= 10 && "text-rose-400")}>
            {phase === "flight" ? timeLeft : "--"}
          </span>
        </div>
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-2 @xl:px-3 py-1.5 flex flex-col items-center justify-center min-w-[58px] @xl:min-w-[78px]">
          <span className="text-[9px] font-bold text-amber-300">SCORE</span>
          <span className="game-pixel text-xs @xl:text-sm text-yellow-300">{score}</span>
        </div>
      </div>

      {/* Flight view */}
      <div className="relative flex-1 min-h-0">
        {/* Clouds at fixed heights (Earth only), you fly past them */}
        {mission.place === "Earth" &&
          [
            { h: 14, x: 12, w: 1 },
            { h: 26, x: 70, w: 1.3 },
            { h: 38, x: 25, w: 0.9 },
            { h: 47, x: 82, w: 1.1 },
          ].map((c, i) => (
            <div key={i} className="absolute pointer-events-none" style={{ left: `${c.x}%`, bottom: altY(c.h), opacity: 0.9 - altFrac * 0.5 }}>
              <BlockCloud scale={c.w} grey={mission.gusts} />
            </div>
          ))}
        {/* Wind streaks */}
        {mission.gusts &&
          Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="absolute h-[3px] rounded-full bg-white/70 rl-wind pointer-events-none"
              style={{ top: `${12 + i * 11}%`, width: 40 + (i % 3) * 30, animationDelay: `${i * 0.37}s`, animationDuration: `${1.1 + (i % 3) * 0.3}s` }}
            />
          ))}
        {/* Speed lines */}
        {phase === "flight" && Math.abs(s.v) > 9 &&
          Array.from({ length: 6 }, (_, i) => (
            <span
              key={`sp${i}`}
              className="absolute w-[3px] bg-white/50 rounded-full pointer-events-none rl-speed"
              style={{ left: `${20 + i * 12}%`, height: 30 + Math.abs(s.v) * 2, animationDelay: `${i * 0.11}s`, animationDirection: s.v > 0 ? "normal" : "reverse" }}
            />
          ))}

        {/* Orbit zone band */}
        <div
          className={cn("absolute inset-x-0 border-y-4 border-dashed pointer-events-none", s.inZone ? "border-emerald-300 bg-emerald-400/30" : "border-emerald-400/80 bg-emerald-400/15")}
          style={{ bottom: altY(mission.zone[0]), height: `calc(${(mission.zone[1] - mission.zone[0]) / 100} * ${SPAN})` }}
        >
          <span className="absolute left-14 top-1/2 -translate-y-1/2 game-pixel text-[8px] @xl:text-[9px] text-emerald-100 drop-shadow bg-emerald-700/70 px-1.5 py-1 rounded">
            ORBIT ZONE
          </span>
        </div>
        {/* Too-high line */}
        <div className="absolute inset-x-0 border-t-4 border-dotted border-rose-400/80 pointer-events-none" style={{ bottom: altY(100) }}>
          <span className="absolute left-14 -top-5 text-[10px] font-bold text-rose-200">⚠ Too high: lost in space!</span>
        </div>

        {/* Ground + launch pad */}
        <div className="absolute inset-x-0 bottom-0" style={{ height: GROUND }}>
          <div className="absolute inset-0" style={{ background: `linear-gradient(${mission.ground[0]} 0 14px, ${mission.ground[1]} 14px)` }} />
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage: "linear-gradient(90deg, rgba(0,0,0,.35) 2px, transparent 2px), linear-gradient(rgba(0,0,0,.25) 2px, transparent 2px)",
              backgroundSize: "28px 28px",
            }}
          />
          {mission.place === "Moon" && (
            <>
              <span className="absolute left-[12%] top-5 w-10 h-3 rounded-[50%] bg-slate-500/70" />
              <span className="absolute right-[20%] top-7 w-14 h-4 rounded-[50%] bg-slate-500/70" />
            </>
          )}
          {/* Pad */}
          <div className="absolute left-1/2 @xl:left-[42%] -translate-x-1/2 -top-3 w-28 h-5 rounded-md bg-slate-500 border-2 border-black/30" style={{ boxShadow: "inset 0 3px 0 #94a3b8, 0 4px 0 #334155" }}>
            <div className="absolute inset-x-2 top-1.5 h-1 bg-[repeating-linear-gradient(90deg,#facc15_0_8px,#1e293b_8px_16px)]" />
          </div>
          {/* Tower */}
          <div className="absolute bottom-full left-1/2 @xl:left-[42%] -ml-[118px] w-4 h-32 bg-[repeating-linear-gradient(0deg,#64748b_0_10px,#facc15_10px_13px)] border-2 border-black/30 rounded-sm" />
        </div>

        {/* Rocket */}
        <div
          className="absolute left-1/2 @xl:left-[42%] z-10"
          style={{
            bottom: `calc(${altY(Math.max(0, s.h))} - ${ROCKET_H / 2}px)`,
            transform: `translateX(-50%) translateX(${shake}px) rotate(${tilt}deg)`,
            transition: crashed ? "transform 500ms ease-out" : undefined,
          }}
        >
          <Rocket thr={phase === "flight" ? s.thr : won ? 0.45 : 0} crashed={crashed} />
          {/* Force arrows */}
          {showPhysics && !crashed && (
            <>
              <Arrow dir="up" len={T * arrowScale} color="#22c55e" label={`Thrust ${Math.round(T * 100)} N`} style={{ left: "50%", bottom: ROCKET_H + 6, marginLeft: -9 }} />
              <Arrow dir="down" len={W * arrowScale} color="#ef4444" label={`Weight ${Math.round(W * 100)} N`} labelLeft style={{ right: "100%", top: ROCKET_H / 2, marginRight: 8 }} />
              {Math.abs(D) > 0.3 && (
                <Arrow
                  key={s.v > 0 ? "air-down" : "air-up"}
                  dir={s.v > 0 ? "down" : "up"}
                  len={Math.abs(D) * arrowScale}
                  color="#94a3b8"
                  label={`Air ${Math.round(Math.abs(D) * 100)} N`}
                  style={s.v > 0 ? { left: "100%", top: ROCKET_H / 2, marginLeft: 8 } : { left: "100%", bottom: ROCKET_H / 2, marginLeft: 8 }}
                />
              )}
              {mission.gusts && Math.abs(s.gust) > 1 && (
                <span className="absolute -right-16 top-2 text-[10px] font-bold text-white bg-slate-700/70 rounded px-1 whitespace-nowrap">
                  <Wind size={10} className="inline" /> gust {s.gust > 0 ? "⬆" : "⬇"}
                </span>
              )}
            </>
          )}
          {/* Smoke */}
          {phase === "flight" && s.h < 14 && s.thr > 0.25 &&
            Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white/80 rl-smoke"
                style={{ bottom: -26 - s.h * 3, left: "50%", width: 26, height: 26, ["--sx" as string]: `${(i % 2 ? 1 : -1) * (30 + i * 10)}px`, animationDelay: `${i * 0.09}s` }}
              />
            ))}
          {crashed && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 game-bounce-in">
              <span className="text-6xl block">💥</span>
              <span className="game-pixel text-xs text-yellow-300 drop-shadow-[0_2px_0_#000] absolute -right-10 -top-2 rotate-12">BONK!</span>
            </div>
          )}
        </div>

        {/* Altimeter */}
        <div className="absolute left-2 top-2 bottom-3 w-9 @xl:w-11 z-10 pointer-events-none">
          <div className="absolute inset-x-2 @xl:inset-x-3 rounded-full bg-slate-900/60 border-2 border-black/30" style={{ top: 0, bottom: 0 }} />
          <div className="relative h-full">
            <div className="absolute left-0 right-0" style={{ top: 18, bottom: GROUND - 6 }}>
              <div className="relative h-full">
                <div
                  className="absolute inset-x-2 @xl:inset-x-3 bg-emerald-400/90 rounded"
                  style={{ bottom: `${mission.zone[0]}%`, height: `${mission.zone[1] - mission.zone[0]}%` }}
                />
                <div className="absolute left-0 right-0 flex items-center transition-[bottom] duration-75" style={{ bottom: `calc(${clamp(s.h / 100) * 100}% - 8px)` }}>
                  <span className="text-[13px] leading-none mx-auto drop-shadow">🚀</span>
                </div>
              </div>
            </div>
            <span className="absolute top-0 inset-x-0 text-center text-[8px] font-bold text-white">km</span>
            <span className="absolute -bottom-0 inset-x-0 text-center game-pixel text-[7px] text-yellow-300">{Math.round(s.h)}</span>
          </div>
        </div>

        {/* Physics panel (wide screens) */}
        {phase === "flight" && (
          <div className="hidden @xl:block absolute right-3 top-2 w-[200px] z-10 bg-slate-900/95 text-white rounded-2xl game-panel p-2.5 space-y-2">
            <div className={cn("rounded-lg px-2 py-1 text-[11px] font-bold text-center", forceStatus.tone)}>{forceStatus.text}</div>
            <ForceRow color="#22c55e" label="Thrust ⬆" value={T} max={mission.thrust} />
            <ForceRow color="#ef4444" label="Weight ⬇" value={W} max={mission.thrust} />
            <ForceRow color="#94a3b8" label={`Air resistance ${s.v > 0 ? "⬇" : s.v < 0 ? "⬆" : ""}`} value={Math.abs(D)} max={mission.thrust} />
            <div className="pt-1 border-t border-white/15">
              <p className="text-[10px] font-bold text-amber-200 mb-1">ENERGY CHANGES</p>
              <div className="flex items-end gap-2 h-[70px]">
                <EnergyBar label="Fuel" sub="chemical" v={chem} color="#f59e0b" />
                <span className="self-center text-white/60 text-xs">→</span>
                <EnergyBar label="Motion" sub="kinetic" v={ke} color="#38bdf8" />
                <span className="self-center text-white/60 text-xs">+</span>
                <EnergyBar label="Height" sub="grav. PE" v={gpe} color="#a78bfa" />
              </div>
            </div>
          </div>
        )}
        {/* Compact physics (phones) */}
        {phase === "flight" && (
          <div className="@xl:hidden absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
            <div className={cn("rounded-lg px-2 py-1 text-[10px] font-bold game-panel max-w-[150px] text-center", forceStatus.tone)}>{forceStatus.text}</div>
            <div className="bg-slate-900/80 rounded-lg px-2 py-1 text-[10px] text-white font-bold flex gap-2">
              <span className="text-amber-300">⛽{Math.round(s.fuel)}</span>
              <span className="text-sky-300">KE {Math.round(ke * 100)}</span>
              <span className="text-violet-300">PE {Math.round(gpe * 100)}</span>
            </div>
          </div>
        )}

        {/* Hold-in-zone ring */}
        {phase === "flight" && s.hold > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 z-20 bg-emerald-500 text-white rounded-2xl game-panel px-3 py-1.5 game-bounce-in" style={{ bottom: GROUND + 10 }}>
            <p className="game-pixel text-[9px]">HOLD STEADY… {Math.min(HOLD_NEEDED, s.hold).toFixed(1)}s</p>
            <div className="h-2 mt-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-300" style={{ width: `${(s.hold / HOLD_NEEDED) * 100}%` }} />
            </div>
          </div>
        )}
        {phase === "flight" && !pressedOnce && s.t > 0.8 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-16 z-20 game-pixel text-[10px] text-white bg-slate-900/70 rounded-lg px-3 py-2 animate-bounce">
            HOLD THRUST TO LIFT OFF!
          </div>
        )}

        {/* Prep card */}
        {phase === "prep" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-2 @xl:p-3 bg-slate-950/30">
            <div className="w-full max-w-[460px] bg-white rounded-3xl game-panel p-3 @xl:p-4 game-bounce-in text-slate-900">
              <div className="flex items-start gap-2">
                <img src={STEMBOTS.emily.avatar} alt="Emily" className="w-12 h-12 @xl:w-14 @xl:h-14 object-contain game-float shrink-0" />
                <div className="flex-1 min-w-0 bg-amber-50 border-2 border-amber-200 rounded-2xl rounded-tl-none px-3 py-1.5">
                  <p className="text-[10px] font-bold text-amber-700">EMILY · MISSION {missionNo}</p>
                  <p className="text-xs @xl:text-[13px] leading-snug">{mission.tip}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2.5 text-center">
                <Chip k="Gravity" v={`${mission.g} N/kg`} />
                <Chip k="Air" v={mission.air} />
                <Chip k="Max thrust" v={`${mission.thrust * 100} N`} />
              </div>

              <div className="mt-2.5">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Fuel size={14} className="text-amber-500" /> Fuel (chemical energy)
                  </span>
                  <span className="game-pixel text-[9px] text-amber-600">{fuelPick} units</span>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {FUEL_STEPS.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFuelPick(f);
                        sfx.tick();
                      }}
                      className={cn(
                        "h-9 rounded-lg border-2 border-black/20 text-[10px] font-bold transition-transform",
                        f <= fuelPick ? "bg-gradient-to-t from-orange-500 to-amber-300 text-white" : "bg-slate-100 text-slate-400",
                        f === fuelPick && "scale-110 ring-2 ring-amber-500",
                      )}
                      style={{ boxShadow: "0 3px 0 rgba(0,0,0,.2)" }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2.5">
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Package size={14} className="text-amber-700" /> Supply crates (need {mission.minCargo}+)
                  </span>
                  <span className="game-pixel text-[9px] text-amber-700">{cargoPick}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: mission.minCargo + 2 }, (_, i) => {
                    const n = i + 1;
                    const on = n <= cargoPick;
                    return (
                      <button
                        key={n}
                        onClick={() => {
                          setCargoPick(Math.max(mission.minCargo, n === cargoPick && n > mission.minCargo ? n - 1 : n));
                          sfx.place();
                        }}
                        className={cn("w-9 h-9 @xl:w-10 @xl:h-10 rounded-md border-2 border-black/30 text-lg transition-all", on ? "game-bounce-in" : "opacity-30 grayscale")}
                        style={{ background: "linear-gradient(135deg,#d97706,#92400e)", boxShadow: "inset 0 0 0 3px #fbbf24aa, 0 3px 0 rgba(0,0,0,.3)" }}
                        title={n <= mission.minCargo ? "Needed" : "Extra crate: bonus points but more weight"}
                      >
                        📦
                      </button>
                    );
                  })}
                  <span className="text-[10px] text-slate-500 leading-tight ml-1">Extra crates = bonus, but heavier!</span>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-center">
                <div className="rounded-xl bg-slate-100 py-1">
                  <p className="text-[9px] font-bold text-slate-500">MASS</p>
                  <p className="font-bold text-sm">{Math.round(mass * 100)} kg</p>
                </div>
                <div className="rounded-xl bg-rose-50 py-1">
                  <p className="text-[9px] font-bold text-rose-500">WEIGHT (mass × gravity)</p>
                  <p className="font-bold text-sm text-rose-600">{Math.round(mass * 100 * mission.g)} N</p>
                </div>
              </div>

              <button
                onClick={launch}
                disabled={!ready}
                className={cn("game-btn w-full mt-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-lg", ready && "game-pulse")}
              >
                {ready ? "🚀 LAUNCH!" : "Get ready…"}
              </button>
            </div>
          </div>
        )}

        {/* Result card */}
        {phase === "result" && lastResult && (
          <div className={cn("absolute inset-x-2 z-30 flex justify-center", won ? "bottom-3" : "top-3")}>
            <div className={cn("w-full max-w-[420px] rounded-3xl game-panel p-3 @xl:p-4 game-bounce-in text-white", won ? "bg-emerald-600" : "bg-indigo-700")}>
              <div className="flex items-center gap-2">
                <span className="text-4xl">{won ? "🛰️" : crashed ? "💥" : lost ? "🌌" : "⏰"}</span>
                <div className="flex-1">
                  <p className="game-pixel text-[11px] @xl:text-xs text-yellow-300">
                    {won ? "ORBIT REACHED!" : crashed ? "CRASH! BONK!" : lost ? "LOST IN SPACE!" : "TIME'S UP!"}
                  </p>
                  <p className="text-xs @xl:text-[13px] leading-snug mt-1">{lastResult.why}</p>
                </div>
                <img src={STEMBOTS.emily.avatar} alt="" className={cn("w-12 h-12 object-contain shrink-0", won ? "game-float" : "game-shake")} />
              </div>
              <div className="mt-2 bg-black/20 rounded-xl px-3 py-1.5 space-y-0.5">
                {lastResult.lines.map((l) => (
                  <div key={l.label} className="flex justify-between text-xs">
                    <span>{l.label}</span>
                    <span className="font-bold text-yellow-300">{l.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={next} className="game-btn w-full mt-2.5 bg-yellow-300 text-slate-900">
                {missionIdx + 1 >= missions.length && !(QUIZ_AFTER.has(missionIdx) && quizN < questions.length) ? "See results ▶" : "Next mission ▶"}
              </button>
            </div>
          </div>
        )}

        {/* Bonus question */}
        {phase === "quiz" && quiz && (
          <div className="absolute inset-x-2 top-3 z-30 flex justify-center">
            <div className="bg-indigo-600 text-white rounded-2xl game-panel p-3 w-full max-w-lg game-bounce-in">
              <div className="flex items-center justify-between mb-1">
                <span className="game-pixel text-[9px] text-indigo-200">⚡ BONUS QUESTION</span>
                <span className="game-pixel text-[9px] text-yellow-300">{Math.ceil(quiz.left)}s</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-yellow-300" style={{ width: `${(quiz.left / 10) * 100}%` }} />
              </div>
              <p className="font-bold text-sm mb-2">{questions[quiz.idx].q}</p>
              <div className="grid grid-cols-1 @xl:grid-cols-3 gap-2">
                {questions[quiz.idx].options.map((o, i) => {
                  const q = questions[quiz.idx];
                  const show = quiz.picked !== null;
                  return (
                    <button
                      key={o}
                      onClick={() => answer(i)}
                      className={cn(
                        "game-btn text-xs py-2 px-2",
                        !show && "bg-white text-indigo-700",
                        show && i === q.a && "bg-emerald-400 text-white",
                        show && i === quiz.picked && i !== q.a && "bg-rose-500 text-white game-shake",
                        show && i !== q.a && i !== quiz.picked && "bg-white/40 text-indigo-900",
                      )}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <div className="bg-white rounded-3xl game-panel px-6 py-4 text-center game-bounce-in">
              <p className="text-4xl">🏁</p>
              <p className="game-pixel text-xs text-indigo-700 mt-1">ALL MISSIONS DONE!</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-20 bg-slate-900/90 text-white px-2 @xl:px-3 py-2 flex items-center gap-2 @xl:gap-3 border-t-4 border-black/30">
        <button
          onPointerDown={(e) => {
            if (phase !== "flight") return;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setHolding(true);
            setPressedOnce(true);
          }}
          onPointerUp={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onContextMenu={(e) => e.preventDefault()}
          disabled={phase !== "flight"}
          className={cn(
            "game-btn touch-none shrink-0 w-[130px] @xl:w-[190px] h-14 text-base @xl:text-xl text-white",
            holding ? "bg-gradient-to-t from-red-600 to-orange-400 translate-y-1" : "bg-gradient-to-t from-orange-600 to-amber-400",
          )}
        >
          🔥 THRUST
        </button>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div>
            <div className="flex justify-between text-[10px] font-bold text-white/80">
              <span>Engine power</span>
              <span className="text-yellow-300">{Math.round(s.thr * 100)}%</span>
            </div>
            <div className="relative h-3.5 rounded-full bg-white/10 border-2 border-black/30 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500" style={{ width: `${s.thr * 100}%` }} />
              {/* Balance marker: power where thrust = weight */}
              <div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${clamp(W / mission.thrust) * 100}%` }} title="Thrust = weight here" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-bold text-white/80">
              <span>⛽ Fuel left</span>
              <span className={cn(s.fuel < fuelPick * 0.2 ? "text-rose-400" : "text-amber-300")}>{Math.round(s.fuel)}</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 border-2 border-black/30 overflow-hidden">
              <div
                className={cn("h-full rounded-full", s.fuel < fuelPick * 0.2 ? "bg-rose-500" : "bg-amber-400")}
                style={{ width: `${clamp(s.fuel / 100) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <p className="hidden @2xl:block text-[10px] text-white/60 w-[110px] leading-tight">
          Hold <b className="text-white">SPACE</b> or the button. White line = thrust equals weight.
        </p>
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────

function Rocket({ thr, crashed }: { thr: number; crashed: boolean }) {
  const flameH = 14 + thr * 64;
  return (
    <div className="relative" style={{ width: 62, height: ROCKET_H }}>
      {/* Flame */}
      {thr > 0.02 && !crashed && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: ROCKET_H - 8 }}>
          <div
            className="rl-flame mx-auto"
            style={{
              width: 22 + thr * 8,
              height: flameH,
              background: "radial-gradient(ellipse at 50% 15%, #fff 0 18%, #fde047 30%, #fb923c 58%, #ef4444 80%, transparent 82%)",
              borderRadius: "45% 45% 50% 50% / 25% 25% 75% 75%",
              filter: "drop-shadow(0 0 10px #fb923c)",
            }}
          />
          {Array.from({ length: Math.round(thr * 7) }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-sm rl-spark"
              style={{
                left: `${(i * 37) % 22}px`,
                top: flameH * 0.5,
                width: 6,
                height: 6,
                background: i % 2 ? "#fde047" : "#fb923c",
                animationDelay: `${i * 0.07}s`,
                ["--sx" as string]: `${(i % 2 ? 1 : -1) * (6 + i * 3)}px`,
              }}
            />
          ))}
        </div>
      )}
      {/* Fins (behind body) */}
      <div className="absolute left-0 bottom-0 w-4 h-10 rounded-bl-lg" style={{ background: "linear-gradient(90deg,#991b1b,#dc2626)", clipPath: "polygon(100% 0, 100% 100%, 0 100%, 0 45%)", boxShadow: "inset 0 -3px 0 rgba(0,0,0,.3)" }} />
      <div className="absolute right-0 bottom-0 w-4 h-10 rounded-br-lg" style={{ background: "linear-gradient(90deg,#dc2626,#7f1d1d)", clipPath: "polygon(0 0, 100% 45%, 100% 100%, 0 100%)" }} />
      {/* Nozzle */}
      <div className="absolute left-1/2 -translate-x-1/2 w-6 h-3 rounded-b-md" style={{ top: ROCKET_H - 10, background: "linear-gradient(90deg,#334155,#94a3b8 45%,#1e293b)" }} />
      {/* Body (shaded like a cylinder) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-b-xl border-2 border-black/25"
        style={{
          top: 32,
          width: 40,
          height: ROCKET_H - 40,
          background: "linear-gradient(90deg,#94a3b8 0%,#f8fafc 30%,#ffffff 42%,#e2e8f0 65%,#64748b 100%)",
          boxShadow: "inset 0 -10px 0 rgba(220,38,38,.9)",
        }}
      >
        {/* Stripe */}
        <div className="absolute inset-x-0 top-[46px] h-2" style={{ background: "linear-gradient(90deg,#991b1b,#ef4444 40%,#7f1d1d)" }} />
        {/* Window with Emily */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-2 w-7 h-7 rounded-full overflow-hidden border-[3px] border-slate-500"
          style={{ background: "radial-gradient(circle at 35% 30%, #e0f2fe, #38bdf8 60%, #0369a1)", boxShadow: "inset 0 0 0 2px #cbd5e1" }}
        >
          <img src={STEMBOTS.emily.avatar} alt="" className="w-full h-full object-cover object-top scale-125 translate-y-0.5" draggable={false} />
          <span className="absolute left-1 top-0.5 w-2 h-1.5 rounded-full bg-white/70" />
        </div>
      </div>
      {/* Nose cone */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-10 h-9"
        style={{
          background: "linear-gradient(90deg,#7f1d1d,#ef4444 35%,#fca5a5 45%,#dc2626 65%,#7f1d1d)",
          clipPath: "polygon(50% 0, 82% 45%, 100% 100%, 0 100%, 18% 45%)",
        }}
      />
      {/* Middle fin (front) */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-2 h-9 rounded-t-sm" style={{ background: "linear-gradient(90deg,#b91c1c,#f87171,#b91c1c)" }} />
    </div>
  );
}

function Arrow({ dir, len, color, label, style, labelLeft }: { dir: "up" | "down"; len: number; color: string; label: string; style: React.CSSProperties; labelLeft?: boolean }) {
  const L = Math.max(0, Math.min(150, len));
  if (L < 3) return null;
  return (
    <div className="absolute pointer-events-none" style={{ ...style, width: 18, height: L + 12, ...(dir === "down" ? {} : {}) }}>
      <div className={cn("relative w-full h-full flex items-center", dir === "up" ? "flex-col-reverse" : "flex-col")}>
        <div style={{ width: 8, height: L, background: color, borderRadius: 3, boxShadow: "0 0 0 2px rgba(0,0,0,.35)" }} />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            [dir === "up" ? "borderBottom" : "borderTop"]: `13px solid ${color}`,
            filter: "drop-shadow(0 0 1px rgba(0,0,0,.6))",
          }}
        />
        <span
          className="absolute whitespace-nowrap text-[10px] font-bold text-white px-1 rounded"
          style={{ background: color, [dir === "up" ? "top" : "bottom"]: -2, [labelLeft ? "right" : "left"]: 22, textShadow: "0 1px 0 rgba(0,0,0,.4)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function ForceRow({ color, label, value, max }: { color: string; label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold">
        <span style={{ color }}>{label}</span>
        <span>{Math.round(value * 100)} N</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden border border-black/30">
        <div className="h-full rounded-full" style={{ width: `${clamp(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function EnergyBar({ label, sub, v, color }: { label: string; sub: string; v: number; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center h-full">
      <div className="relative flex-1 w-full rounded-md bg-white/10 border border-black/30 overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 rounded-sm" style={{ height: `${v * 100}%`, background: color }} />
      </div>
      <span className="text-[9px] font-bold mt-0.5" style={{ color }}>
        {label}
      </span>
      <span className="text-[8px] text-white/60 -mt-0.5">{sub}</span>
    </div>
  );
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-indigo-50 border-2 border-indigo-100 px-1 py-1">
      <p className="text-[9px] font-bold text-indigo-400 uppercase">{k}</p>
      <p className="text-[11px] @xl:text-xs font-bold text-indigo-900 leading-tight">{v}</p>
    </div>
  );
}

function BlockCloud({ scale, grey }: { scale: number; grey: boolean }) {
  const c = grey ? "#cbd5e1" : "#ffffff";
  const u = 18 * scale;
  return (
    <div className="flex items-end rl-drift" style={{ filter: "drop-shadow(0 4px 0 rgba(0,0,0,.08))" }}>
      {[0.6, 1, 1.3, 0.8].map((k, i) => (
        <span key={i} className="block" style={{ width: u * 1.4, height: u * k, background: c, boxShadow: "inset 0 -4px 0 rgba(0,0,0,.08)" }} />
      ))}
    </div>
  );
}

const ROCKET_CSS = `
@keyframes rl-flicker { 0%,100% { transform: scaleY(1) scaleX(1); } 50% { transform: scaleY(1.12) scaleX(0.92); } }
.rl-flame { transform-origin: 50% 0; animation: rl-flicker 90ms linear infinite; }
@keyframes rl-spark { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--sx,0), 46px) scale(.3); opacity: 0; } }
.rl-spark { animation: rl-spark 420ms ease-out infinite; }
@keyframes rl-smoke { 0% { transform: translate(-50%,0) scale(.4); opacity: .9; } 100% { transform: translate(calc(-50% + var(--sx,0)), -10px) scale(1.8); opacity: 0; } }
.rl-smoke { animation: rl-smoke 900ms ease-out infinite; }
@keyframes rl-twinkle { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.rl-twinkle { animation: rl-twinkle 2.2s ease-in-out infinite; }
@keyframes rl-wind { from { transform: translateX(-120px); opacity: 0; } 20% { opacity: 1; } to { transform: translateX(1100px); opacity: 0; } }
.rl-wind { left: 0; animation: rl-wind 1.4s linear infinite; }
@keyframes rl-speed { from { transform: translateY(-120%); top: 0; } to { transform: translateY(0); top: 100%; } }
.rl-speed { animation: rl-speed 380ms linear infinite; }
@keyframes rl-drift { 0%,100% { transform: translateX(0); } 50% { transform: translateX(14px); } }
.rl-drift { animation: rl-drift 6s ease-in-out infinite; }
`;
