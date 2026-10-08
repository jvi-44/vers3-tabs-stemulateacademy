// Minecraft Room Designer — Minecraft Masterminds maths game.
// STEMbot "villagers" place build orders (a floor area, a volume, or both).
// The player sets length, width and height; the room rebuilds live in 3D
// (cut-away walls like The Sims). BUILD checks the order: correct builds fill
// the room block-by-block to show the volume, wrong ones give a hint.
// Special order: 3 rooms with the SAME floor area but different heights —
// are their volumes the same?

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Flame, Hammer, Minus, Plus, Timer } from "lucide-react";
import { cn } from "../components/ui/utils";
import { STEMBOTS } from "../data/mock";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import { BLOCKS, Voxel, VoxelWorld, type BlockColors } from "./kit/Voxel";
import type { BotId, GameProps } from "./kit/types";

// ── Rules & limits ─────────────────────────────────────
const MAX_LW = 8;
const MAX_H = 5;
const ROUND_SECONDS = 180;
const START_DELAY = 2600;
const GRID = MAX_LW + 2; // wall row/col + floor + 1 spare ring of grass

type Order =
  | { k: "area"; A: number }
  | { k: "areaH"; A: number; H: number }
  | { k: "volH"; V: number; H: number }
  | { k: "sameShape"; A: number }
  | { k: "same3"; A: number }
  | { k: "range"; minA: number; maxV: number }
  | { k: "lenVol"; L: number; V: number }
  | { k: "volArea"; V: number; A: number };

interface Ticket {
  order: Order;
  who: BotId;
  room: string;
  emoji: string;
}

interface Built {
  l: number;
  w: number;
  h: number;
}

const ROOMS = [
  { room: "bedroom", emoji: "🛏️" },
  { room: "library", emoji: "📚" },
  { room: "kitchen", emoji: "🍳" },
  { room: "pet room", emoji: "🐺" },
  { room: "music room", emoji: "🎵" },
  { room: "potion lab", emoji: "🧪" },
  { room: "storage room", emoji: "📦" },
  { room: "greenhouse", emoji: "🌱" },
];

const BOT_COLORS: Record<BotId, string> = {
  sophia: "bg-emerald-500",
  timothy: "bg-sky-500",
  emily: "bg-amber-400",
  matthew: "bg-rose-500",
};

const pick = <T,>(rnd: () => number, arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
const plural = (r: string) => (r.endsWith("y") ? r.slice(0, -1) + "ies" : r + "s");
const shapeKey = (l: number, w: number) => `${Math.min(l, w)}x${Math.max(l, w)}`;

function makeTickets(seed: number): Ticket[] {
  const rnd = seededRandom(seed);
  const rooms = [...ROOMS].sort(() => rnd() - 0.5);
  const A1 = pick(rnd, [12, 15, 18, 20, 24, 28, 30, 35]);
  const A2 = pick(rnd, [10, 14, 16, 21, 25, 32, 36, 40]);
  const H2 = 2 + Math.floor(rnd() * 3);
  // An area with two different shapes inside the 8×8 plot, for "same area, new shape".
  const A3 = pick(rnd, [6, 8, 12, 16, 24]);
  const H3 = 2 + Math.floor(rnd() * 4);
  const A5 = pick(rnd, [6, 8, 9, 10, 12, 15, 16, 18, 20]);
  const minA = 16 + Math.floor(rnd() * 12);
  const H6 = 2 + Math.floor(rnd() * 2);
  const maxV = minA * H6 + 2 + Math.floor(rnd() * Math.max(1, minA - 4));
  const L7 = 3 + Math.floor(rnd() * 4);
  const V7 = L7 * (2 + Math.floor(rnd() * 5)) * (2 + Math.floor(rnd() * 3));
  const A8 = pick(rnd, [12, 15, 18, 20, 24, 30]);
  const V8 = A8 * (3 + Math.floor(rnd() * 3));
  const orders: Order[] = [
    { k: "area", A: A1 },
    { k: "areaH", A: A2, H: H2 },
    { k: "volH", V: A3 * H3, H: H3 },
    { k: "sameShape", A: A3 },
    { k: "same3", A: A5 },
    { k: "range", minA, maxV },
    { k: "lenVol", L: L7, V: V7 },
    { k: "volArea", V: V8, A: A8 },
  ];
  const who: BotId[] = ["sophia", "timothy", "emily", "sophia", "matthew", "timothy", "emily", "matthew"];
  return orders.map((order, i) => ({ order, who: who[i], ...rooms[i] }));
}

/** What the villager says. */
function orderText(t: Ticket): { say: string; chips: string[] } {
  const o = t.order;
  switch (o.k) {
    case "area":
      return { say: `I need a ${t.room} with a floor area of exactly ${o.A} blocks². Any height is fine!`, chips: [`Area = ${o.A}`] };
    case "areaH":
      return { say: `Build me a ${t.room}: floor area ${o.A} blocks² and ${o.H} blocks tall.`, chips: [`Area = ${o.A}`, `Height = ${o.H}`] };
    case "volH":
      return { say: `My ${t.room} needs a volume of ${o.V} blocks³, with a height of ${o.H}.`, chips: [`Volume = ${o.V}`, `Height = ${o.H}`] };
    case "sameShape":
      return { say: `I want a ${t.room} with the SAME floor area as the last room, but a DIFFERENT shape!`, chips: [`Area = last room`, `New shape`] };
    case "same3":
      return {
        say: `Special challenge! Build 3 ${plural(t.room)}, each with a floor area of ${o.A} blocks², but give each one a DIFFERENT height.`,
        chips: [`Area = ${o.A}`, `3 different heights`],
      };
    case "range":
      return {
        say: `My ${t.room} needs a floor area of AT LEAST ${o.minA} blocks², but a volume LESS THAN ${o.maxV} blocks³.`,
        chips: [`Area ≥ ${o.minA}`, `Volume < ${o.maxV}`],
      };
    case "lenVol":
      return { say: `The ${t.room} must be ${o.L} blocks long, with a volume of exactly ${o.V} blocks³.`, chips: [`Length = ${o.L}`, `Volume = ${o.V}`] };
    case "volArea":
      return {
        say: `Tricky one! A ${t.room} with volume ${o.V} blocks³ and floor area ${o.A} blocks². How tall must it be?`,
        chips: [`Volume = ${o.V}`, `Area = ${o.A}`],
      };
  }
}

/** null when the build matches the order, otherwise a hint. */
function checkBuild(o: Order, b: Built, wrongs: number, last: Built | null, sub: Built[]): string | null {
  const { l, w, h } = b;
  const a = l * w;
  const v = a * h;
  const areaMsg = (A: number) =>
    `Floor area is ${l} × ${w} = ${a}, but it needs ${A}. ${a < A ? "Too small!" : "Too big!"}` +
    (wrongs >= 1 ? ` Find two numbers that multiply to ${A}.` : "");
  const volMsg = (V: number) =>
    `Volume is ${l} × ${w} × ${h} = ${v}, but it needs ${V}. ${v < V ? "Too small!" : "Too big!"}`;
  switch (o.k) {
    case "area":
      return a === o.A ? null : areaMsg(o.A);
    case "areaH":
      if (a !== o.A) return areaMsg(o.A);
      return h === o.H ? null : `Area is perfect! But the height is ${h}. It needs to be ${o.H}.`;
    case "volH":
      if (h !== o.H) return `The height must be ${o.H} blocks (yours is ${h}).`;
      if (v === o.V) return null;
      return volMsg(o.V) + (wrongs >= 1 ? ` Hint: floor area = ${o.V} ÷ ${o.H} = ${o.V / o.H}.` : "");
    case "sameShape": {
      if (a !== o.A) return `The last room's floor area was ${o.A} blocks². Yours is ${l} × ${w} = ${a}.`;
      if (last && shapeKey(l, w) === shapeKey(last.l, last.w))
        return `That's the same shape as before (${last.l} × ${last.w}) — turning it around doesn't count! Try other numbers that make ${o.A}.`;
      return null;
    }
    case "same3": {
      if (a !== o.A) return areaMsg(o.A);
      if (sub.some((s) => s.h === h)) return `You already built one ${h} blocks tall. Pick a different height!`;
      return null;
    }
    case "range":
      if (a < o.minA) return `Floor area is ${l} × ${w} = ${a}. It must be at least ${o.minA}.`;
      if (v >= o.maxV)
        return `Volume is ${l} × ${w} × ${h} = ${v}. It must be LESS than ${o.maxV}.` + (wrongs >= 1 ? " Try a lower height!" : "");
      return null;
    case "lenVol":
      if (l !== o.L) return `The length must be ${o.L} blocks (yours is ${l}).`;
      if (v === o.V) return null;
      return volMsg(o.V) + (wrongs >= 1 ? ` Hint: width × height = ${o.V} ÷ ${o.L} = ${o.V / o.L}.` : "");
    case "volArea":
      if (a !== o.A) return areaMsg(o.A);
      if (v === o.V) return null;
      return volMsg(o.V) + (wrongs >= 1 ? ` Hint: height = ${o.V} ÷ ${o.A} = ${o.V / o.A}.` : "");
  }
}

// ── Block colours ─────────────────────────────────────
const FLOOR: BlockColors = { top: "#d9a066", side: "#b8834e", side2: "#996a3b" };
const FLOOR_ALT: BlockColors = { top: "#c98f55", side: "#b8834e", side2: "#996a3b" };
const WALL: BlockColors = { top: "#cbd5e1", side: "#b7bfca", side2: "#9aa3ae" };
const WALL_DARK: BlockColors = { top: "#a8b0bb", side: "#9aa3ae", side2: "#818a95" };
const BED: BlockColors = { top: "#ef4444", side: "#f8fafc", side2: "#e2e8f0" };
const PILLOW: BlockColors = { top: "#ffffff", side: "#f1f5f9", side2: "#e2e8f0" };
const TABLE: BlockColors = { top: "#a16207", side: "#c08552", side2: "#a26c3c" };
const FILL: BlockColors = { top: "#fde04799", side: "#facc1580", side2: "#eab30880" };
const FLOWER_SPOTS: [number, number, string][] = [
  [9, 9, "#f43f5e"],
  [9, 4, "#facc15"],
  [4, 9, "#a855f7"],
  [7, 9, "#fb923c"],
  [9, 6, "#f472b6"],
];

export function RoomDesigner({ seed, reportProgress, finish }: GameProps) {
  const tickets = useMemo(() => makeTickets(seed), [seed]);

  const [l, setL] = useState(3);
  const [w, setW] = useState(3);
  const [h, setH] = useState(2);

  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [idx, setIdx] = useState(0);
  const [orderStart, setOrderStart] = useState(0);
  const [wrongs, setWrongs] = useState(0);
  const [pts, setPts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const [lastBuilt, setLastBuilt] = useState<Built | null>(null);
  const [sub, setSub] = useState<Built[]>([]);
  const [phase, setPhase] = useState<"build" | "celebrate" | "quiz" | "reveal">("build");
  const [quizPick, setQuizPick] = useState<number | null>(null);
  const [fillZ, setFillZ] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const [shakeId, setShakeId] = useState(0);

  const ticket = tickets[idx];
  const area = l * w;
  const volume = area * h;
  const done = idx >= tickets.length || elapsed >= ROUND_SECONDS;
  const score = Math.min(100, Math.round(pts));

  // Start the clock after the shell's countdown
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), START_DELAY);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [started, done]);

  const progress = Math.min(1, (idx + (ticket?.order.k === "same3" ? sub.length / 4 : 0)) / tickets.length);
  useEffect(() => {
    reportProgress(score, progress);
  }, [score, progress, reportProgress]);

  const finishedRef = useRef(false);
  useEffect(() => {
    if (!done || finishedRef.current) return;
    finishedRef.current = true;
    if (elapsed >= ROUND_SECONDS) sfx.alarm();
    const t = setTimeout(
      () =>
        finish(score, [
          { label: "Rooms built", value: `${Math.min(idx, tickets.length)}/${tickets.length}` },
          { label: "Perfect builds", value: `${perfect}` },
          { label: "Best combo", value: `x${bestStreak}` },
          { label: "Time", value: `${Math.round(elapsed)}s` },
        ]),
      700,
    );
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFlash = (text: string, good: boolean) => {
    const id = Date.now();
    setFlash({ text, good, id });
    setTimeout(() => setFlash((f) => (f?.id === id ? null : f)), 1500);
  };

  // Fill the room layer by layer so kids can see volume = area × layers
  const runFill = (height: number, then: () => void) => {
    setFillZ(0);
    let z = 0;
    const step = () => {
      z += 1;
      setFillZ(z);
      sfx.place();
      if (z < height) setTimeout(step, 260);
      else setTimeout(() => {
        setFillZ(null);
        then();
      }, 700);
    };
    setTimeout(step, 200);
  };

  const nextOrder = () => {
    setIdx((i) => i + 1);
    setWrongs(0);
    setHint(null);
    setSub([]);
    setQuizPick(null);
    setOrderStart(elapsedRef.current);
    setPhase("build");
    sfx.whoosh();
  };
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  const build = () => {
    if (!ticket || phase !== "build" || done || !started) return;
    const b = { l, w, h };
    const miss = checkBuild(ticket.order, b, wrongs, lastBuilt, sub);
    if (miss) {
      sfx.wrong();
      setWrongs((x) => x + 1);
      setStreak(0);
      setHint(miss);
      setShakeId((s) => s + 1);
      showFlash("Not quite!", false);
      return;
    }
    setHint(null);
    const first = wrongs === 0;
    const newStreak = first ? streak + 1 : 0;
    if (first) {
      setPerfect((p) => p + 1);
      setStreak(newStreak);
      setBestStreak((s) => Math.max(s, newStreak));
    }
    sfx.correct();
    setTimeout(() => sfx.coin(), 180);
    if (newStreak >= 3) setTimeout(() => sfx.levelUp(), 350);

    if (ticket.order.k === "same3") {
      const gained = 4 * Math.max(0.4, 1 - 0.3 * wrongs);
      setPts((p) => p + gained);
      const nextSub = [...sub, b];
      setSub(nextSub);
      setWrongs(0);
      setLastBuilt(b);
      showFlash(`Room ${nextSub.length} of 3 built! +${Math.round(gained)}`, true);
      setPhase("celebrate");
      runFill(h, () => {
        if (nextSub.length >= 3) {
          setPhase("quiz");
          sfx.alarm();
        } else setPhase("build");
      });
      return;
    }

    const t = elapsed - orderStart;
    const base = 10 * Math.max(0.4, 1 - 0.25 * wrongs);
    const speed = 1.5 * Math.max(0, Math.min(1, (30 - t) / 20));
    const combo = first && streak >= 1 ? 0.5 : 0;
    const gained = base + speed + combo;
    setPts((p) => p + gained);
    setLastBuilt(b);
    showFlash(newStreak >= 2 ? `COMBO x${newStreak}! +${Math.round(gained)}` : first ? `Perfect build! +${Math.round(gained)}` : `Built! +${Math.round(gained)}`, true);
    setPhase("celebrate");
    runFill(h, nextOrder);
  };

  const answerQuiz = (i: number) => {
    if (phase !== "quiz") return;
    setQuizPick(i);
    if (i === 1) {
      sfx.correct();
      setPts((p) => p + 4);
      showFlash("Correct! +4", true);
    } else sfx.wrong();
    setPhase("reveal");
  };

  const change = (setter: (n: number) => void, v: number, max: number) => {
    const nv = Math.max(1, Math.min(max, v));
    setter(nv);
    sfx.tick();
  };

  // Keyboard: arrows for length/width, W/S for height, Enter to build
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (phase !== "build") return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" && (e.key.startsWith("Arrow"))) return;
    if (e.key === "ArrowRight") change(setL, l + 1, MAX_LW);
    else if (e.key === "ArrowLeft") change(setL, l - 1, MAX_LW);
    else if (e.key === "ArrowUp") change(setW, w + 1, MAX_LW);
    else if (e.key === "ArrowDown") change(setW, w - 1, MAX_LW);
    else if (e.key === "w" || e.key === "W") change(setH, h + 1, MAX_H);
    else if (e.key === "s" || e.key === "S") change(setH, h - 1, MAX_H);
    else if (e.key === "Enter") build();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // ── Layout sizing ─────────────────────────────
  const worldRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 700, h: 380 });
  useEffect(() => {
    const el = worldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const S = Math.max(13, Math.min(36, Math.floor(Math.min(box.w / 15.5, box.h / 11.6))));

  const timeLeft = Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));
  const text = ticket ? orderText(ticket) : null;
  const bot = ticket ? STEMBOTS[ticket.who] : STEMBOTS.matthew;
  const locked = phase !== "build" || done || !started;

  return (
    <div data-game="room-designer" className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "linear-gradient(#6ec6ff, #bfe8ff 55%, #dff5ff)" }}>
      {/* Pixel clouds */}
      {[
        [6, 22, 1],
        [58, 34, 0.8],
        [80, 12, 1.2],
      ].map(([left, top, sc], i) => (
        <div key={i} className="absolute pointer-events-none" style={{ left: `${left}%`, top: top + 96, transform: `scale(${sc})`, animation: `game-float ${4 + i}s ease-in-out infinite` }}>
          <div className="flex items-end">
            <span className="block w-8 h-5 -ml-3 rounded-full bg-white/90 blur-[1px]" />
            <span className="block w-10 h-8 -ml-3 rounded-full bg-white/95 blur-[1px]" />
            <span className="block w-12 h-6 -ml-3 rounded-full bg-white/90 blur-[1px]" />
          </div>
        </div>
      ))}

      {/* HUD */}
      <div className="relative z-10 flex items-stretch gap-2 p-2 sm:p-3">
        <div key={`o${idx}`} className={cn("flex-1 min-w-0 bg-white/95 rounded-2xl game-panel px-2 sm:px-3 py-2 flex items-center gap-2 sm:gap-3 game-bounce-in min-h-[88px]")}>
          <div key={`s${shakeId}`} className={cn("relative shrink-0 rounded-2xl p-1", BOT_COLORS[ticket?.who ?? "matthew"], shakeId > 0 && "game-shake")}>
            <img src={bot.avatar} alt={bot.name} className="w-9 h-9 sm:w-14 sm:h-14 object-contain drop-shadow" />
            <span className="absolute -bottom-1 -right-1 text-lg">{ticket?.emoji ?? "🏆"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[8px] sm:text-[9px] text-slate-500 truncate">
              {ticket ? (
                <>
                  ORDER {idx + 1}/{tickets.length} · {bot.name.toUpperCase()}
                  {ticket.order.k === "same3" && <span className="text-fuchsia-600"> · SPECIAL {Math.min(sub.length + 1, 3)}/3</span>}
                </>
              ) : (
                "ALL ORDERS DONE"
              )}
            </p>
            <p className="game-fun font-semibold text-slate-900 leading-snug text-[12px] sm:text-[15px]">
              {text ? text.say : "Amazing building, Master Builder!"}
            </p>
            {text && (
              <div className="flex flex-wrap gap-1 mt-1">
                {text.chips.map((c) => (
                  <span key={c} data-chip className="game-fun font-bold text-[11px] bg-indigo-100 text-indigo-700 rounded-md px-1.5 py-0.5">
                    {c}
                  </span>
                ))}
                {ticket?.order.k === "sameShape" && lastBuilt && (
                  <span data-chip className="game-fun font-bold text-[11px] bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5">
                    Last: {lastBuilt.l}×{lastBuilt.w}
                  </span>
                )}
                {ticket?.order.k === "same3" &&
                  sub.map((s, i) => (
                    <span key={i} data-chip className="game-fun font-bold text-[11px] bg-emerald-100 text-emerald-700 rounded-md px-1.5 py-0.5">
                      ✓ {s.l}×{s.w}×{s.h}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex-1 bg-slate-900/85 text-white rounded-2xl game-panel px-2 py-1 flex items-center justify-center gap-1.5 min-w-[58px] sm:min-w-[74px]">
            <Timer size={14} className="text-amber-300" />
            <span className={cn("game-pixel text-xs", timeLeft <= 20 && "text-rose-400")}>{timeLeft}</span>
          </div>
          <div className="flex-1 bg-slate-900/85 text-white rounded-2xl game-panel px-2 py-1 flex items-center justify-center gap-1.5 min-w-[58px] sm:min-w-[74px]">
            <span className="text-[8px] font-bold text-amber-300">PTS</span>
            <span className="game-pixel text-xs text-yellow-300">{score}</span>
          </div>
        </div>
      </div>

      {/* 3D world */}
      <div ref={worldRef} className="relative flex-1 min-h-0">
        <VoxelWorld cols={GRID} rows={GRID} size={S} className="absolute inset-0" style={{ paddingTop: S * 3.4 }}>
          <Slab w={GRID * S} d={GRID * S} t={S * 0.7} top="#6fcf3b" side="#8b5a2b" side2="#6e4520" />
          <Room l={l} w={w} h={h} S={S} fillZ={fillZ} />
          {FLOWER_SPOTS.filter(([x, y]) => x > l + 1 || y > w + 1).map(([x, y, c]) => (
            <Fragment key={`${x},${y}`}>
              <Voxel x={(x + 0.35) / 0.3} y={(y + 0.35) / 0.3} z={0} size={S * 0.3} colors={{ top: c, side: "#16a34a", side2: "#15803d" }} heightScale={1.6} textured={false} />
            </Fragment>
          ))}
          {/* Dimension labels on the grass */}
          <GroundLabel x={(1 + l / 2) * S} y={(w + 1.55) * S} color="#dc2626" text={`L = ${l}`} S={S} />
          <GroundLabel x={(l + 1.55) * S} y={(w / 2 + 1) * S} color="#2563eb" text={`W = ${w}`} S={S} rotate={-90} />
        </VoxelWorld>

        {/* Fill counter */}
        {fillZ !== null && (
          <div className="absolute inset-x-0 top-2 flex justify-center z-10 pointer-events-none">
            <div className="bg-amber-400 text-slate-900 rounded-2xl game-panel px-3 py-1.5 text-center game-bounce-in">
              <p className="game-pixel text-[9px]">COUNTING BLOCKS</p>
              <p className="game-fun font-bold text-sm">
                {Math.min(fillZ, h)} layer{Math.min(fillZ, h) === 1 ? "" : "s"} × {area} = {Math.min(fillZ, h) * area} blocks³
              </p>
            </div>
          </div>
        )}

        {/* Readouts */}
        <div className="absolute left-2 bottom-2 flex flex-col gap-1.5 z-10">
          <Readout label="FLOOR AREA" color="bg-emerald-500">
            <span className="text-rose-200">{l}</span> × <span className="text-sky-200">{w}</span> = <b className="text-yellow-200">{area}</b>{" "}
            <span className="text-[10px]">blocks²</span>
          </Readout>
          <Readout label="VOLUME" color="bg-violet-600">
            <span className="text-rose-200">{l}</span> × <span className="text-sky-200">{w}</span> × <span className="text-lime-200">{h}</span> ={" "}
            <b className="text-yellow-200">{volume}</b> <span className="text-[10px]">blocks³</span>
          </Readout>
        </div>

        {/* Combo + host */}
        <div className="absolute right-2 bottom-2 z-10 flex flex-col items-end gap-1.5">
          {streak >= 2 && (
            <span key={streak} className="game-bounce-in bg-orange-500 text-white game-pixel text-[9px] px-2 py-1.5 rounded-xl game-panel flex items-center gap-1">
              <Flame size={12} /> COMBO x{streak}
            </span>
          )}
          <img src={STEMBOTS.matthew.avatar} alt="Matthew" className="w-12 h-12 sm:w-16 sm:h-16 object-contain game-float drop-shadow-lg" />
        </div>

        {/* Flash */}
        {flash && (
          <div className="absolute inset-x-0 top-14 flex justify-center z-20 pointer-events-none">
            <span key={flash.id} className={cn("game-bounce-in text-white game-fun font-bold px-4 py-2 rounded-2xl game-panel", flash.good ? "bg-emerald-500" : "bg-rose-500")}>
              {flash.text}
            </span>
          </div>
        )}

        {/* Hint */}
        {hint && phase === "build" && (
          <div className="absolute right-2 top-2 z-10 max-w-[260px] sm:max-w-[300px]">
            <div key={shakeId} className="bg-rose-50 border-rose-300 text-rose-900 rounded-2xl game-panel px-3 py-2 game-shake flex gap-2">
              <img src={STEMBOTS.matthew.avatar} alt="" className="w-8 h-8 object-contain shrink-0" />
              <p className="text-xs font-semibold leading-snug">{hint}</p>
            </div>
          </div>
        )}

        {/* Special challenge quiz */}
        {(phase === "quiz" || phase === "reveal") && ticket?.order.k === "same3" && (
          <div className="absolute inset-0 z-30 bg-slate-950/50 flex items-center justify-center p-3">
            <div className="bg-indigo-600 text-white rounded-3xl game-panel p-4 w-full max-w-md game-bounce-in">
              <div className="flex items-center gap-2 mb-2">
                <img src={STEMBOTS.matthew.avatar} alt="" className="w-12 h-12 object-contain" />
                <div>
                  <p className="game-pixel text-[9px] text-yellow-300">BIG QUESTION</p>
                  <p className="game-fun font-bold leading-snug">
                    All 3 rooms have a floor area of {ticket.order.A} blocks². Are their volumes the same?
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 my-3">
                {sub.map((s, i) => (
                  <div key={i} className="bg-white/15 rounded-xl p-2 text-center">
                    <p className="game-pixel text-[8px] text-indigo-200">ROOM {i + 1}</p>
                    <p className="game-fun font-bold text-sm">
                      {s.l} × {s.w}, h {s.h}
                    </p>
                    {phase === "reveal" && (
                      <p className="game-bounce-in game-fun font-bold text-yellow-300 text-xs mt-0.5">
                        {s.l * s.w} × {s.h} = {s.l * s.w * s.h}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {phase === "quiz" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => answerQuiz(0)} className="game-btn bg-white text-indigo-700 text-sm px-2">
                    Yes, all the same
                  </button>
                  <button onClick={() => answerQuiz(1)} className="game-btn bg-white text-indigo-700 text-sm px-2">
                    No, they're different
                  </button>
                </div>
              ) : (
                <div className="game-bounce-in">
                  <p className={cn("game-fun font-bold text-center mb-1", quizPick === 1 ? "text-emerald-300" : "text-rose-300")}>
                    {quizPick === 1 ? "Yes! They're different!" : "Not quite — they're different!"}
                  </p>
                  <p className="text-xs text-indigo-100 text-center mb-3">
                    Volume = floor area × height. Same floor area but a taller room means a bigger volume!
                  </p>
                  <button onClick={nextOrder} className="game-btn bg-yellow-400 text-slate-900 w-full">
                    Next order ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 bg-slate-900/90 text-white px-2 sm:px-3 py-2 grid grid-cols-3 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:gap-3 items-center">
        <Stepper label="Length" color="#ef4444" value={l} max={MAX_LW} disabled={locked} onChange={(v) => change(setL, v, MAX_LW)} />
        <Stepper label="Width" color="#3b82f6" value={w} max={MAX_LW} disabled={locked} onChange={(v) => change(setW, v, MAX_LW)} />
        <Stepper label="Height" color="#22c55e" value={h} max={MAX_H} disabled={locked} onChange={(v) => change(setH, v, MAX_H)} />
        <button
          onClick={build}
          disabled={locked}
          className="col-span-3 sm:col-span-1 game-btn bg-yellow-400 text-slate-900 text-lg sm:text-xl px-6 py-2 sm:py-4 flex items-center justify-center gap-2"
        >
          <Hammer size={20} /> BUILD!
        </button>
      </div>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────
function Room({ l, w, h, S, fillZ }: { l: number; w: number; h: number; S: number; fillZ: number | null }) {
  const blocks: ReactNode[] = [];
  // Floor (grid offset by 1: row/col 0 is the back walls)
  for (let y = 0; y < w; y++)
    for (let x = 0; x < l; x++)
      blocks.push(<Voxel key={`f${x},${y}`} x={x + 1} y={y + 1} z={0} size={S} heightScale={0.22} colors={(x + y) % 2 ? FLOOR_ALT : FLOOR} />);
  // Corner pillar
  for (let z = 0; z < h; z++) blocks.push(<Voxel key={`p${z}`} x={0} y={0} z={z} size={S} colors={BLOCKS.log} />);
  // Back walls (north row and west column), windows in the middle layer
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < l; x++) {
      const win = h >= 3 && z === 1 && x % 3 === 1;
      blocks.push(<Voxel key={`n${x},${z}`} x={x + 1} y={0} z={z} size={S} colors={win ? BLOCKS.glass : z === 0 ? WALL_DARK : WALL} textured={!win} />);
    }
    for (let y = 0; y < w; y++) {
      const win = h >= 3 && z === 1 && y % 3 === 1;
      blocks.push(<Voxel key={`w${y},${z}`} x={0} y={y + 1} z={z} size={S} colors={win ? BLOCKS.glass : z === 0 ? WALL_DARK : WALL} textured={!win} />);
    }
  }
  // Furniture
  if (fillZ === null) {
    blocks.push(<Voxel key="bed" x={1} y={1} z={0.22} size={S} heightScale={0.45} colors={BED} />);
    blocks.push(<Voxel key="pillow" x={2.5} y={2.5} z={1.34} size={S / 2} heightScale={0.45} colors={PILLOW} />);
    if (l >= 3) blocks.push(<Voxel key="table" x={l} y={1} z={0.22} size={S} heightScale={0.9} colors={TABLE} />);
    if (l >= 2 && w >= 3) blocks.push(<Voxel key="chest" x={l} y={w} z={0.22} size={S} heightScale={0.75} colors={BLOCKS.gold} />);
  }
  // Volume fill
  if (fillZ !== null) {
    for (let z = 0; z < Math.min(fillZ, h); z++)
      for (let y = 0; y < w; y++)
        for (let x = 0; x < l; x++)
          blocks.push(<Voxel key={`v${x},${y},${z}`} x={x + 1} y={y + 1} z={z + 0.22} size={S} colors={FILL} textured={false} />);
  }
  return <>{blocks}</>;
}

function Slab({ w, d, t, top, side, side2 }: { w: number; d: number; t: number; top: string; side: string; side2: string }) {
  const face: CSSProperties = { position: "absolute", left: 0, top: 0 };
  return (
    <div className="vx-block" style={{ width: w, height: d, left: 0, top: 0, transform: `translateZ(${-t}px)` }}>
      <div
        className="vx-face"
        style={{
          ...face,
          width: w,
          height: d,
          background: top,
          backgroundImage: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.25), transparent 60%)",
          transform: `translateZ(${t}px)`,
        }}
      />
      <div className="vx-face" style={{ ...face, top: d - t, width: w, height: t, background: side, transformOrigin: "bottom", transform: "rotateX(-90deg)" }} />
      <div className="vx-face" style={{ ...face, left: w - t, width: t, height: d, background: side2, transformOrigin: "right", transform: "rotateY(90deg)" }} />
    </div>
  );
}

function GroundLabel({ x, y, text, color, S, rotate = 0 }: { x: number; y: number; text: string; color: string; S: number; rotate?: number }) {
  return (
    <div
      className="absolute game-pixel whitespace-nowrap rounded-md text-white flex items-center justify-center"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -50%) translateZ(1px) rotate(${rotate}deg)`,
        background: color,
        fontSize: Math.max(7, S * 0.36),
        padding: `${S * 0.12}px ${S * 0.2}px`,
        boxShadow: "0 3px 0 rgba(0,0,0,0.3)",
      }}
    >
      {text}
    </div>
  );
}

function Readout({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div className={cn("text-white rounded-xl game-panel px-2.5 py-1", color)}>
      <p className="game-pixel text-[7px] sm:text-[8px] text-white/80">{label}</p>
      <p className="game-fun font-bold text-sm sm:text-base leading-tight whitespace-nowrap">{children}</p>
    </div>
  );
}

function Stepper({
  label,
  color,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1">
        <button
          aria-label={`Less ${label}`}
          disabled={disabled || value <= 1}
          onClick={() => onChange(value - 1)}
          className="game-btn !p-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white shrink-0"
          style={{ background: color }}
        >
          <Minus size={16} strokeWidth={3} />
        </button>
        <div className="text-center min-w-0">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-white/70 truncate"><span className="sm:hidden">{label[0]}</span><span className="hidden sm:inline">{label}</span></p>
          <p className="game-pixel text-sm sm:text-base leading-none" style={{ color }}>
            {value}
          </p>
        </div>
        <button
          aria-label={`More ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className="game-btn !p-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-white shrink-0"
          style={{ background: color }}
        >
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="game-range"
        style={{ "--track": `linear-gradient(90deg, ${color}55, ${color})`, "--thumb": color } as CSSProperties}
      />
    </div>
  );
}
