// Among Us Tasks as BODMAS — Space Busters maths game.
// Walk a cute crewmate around a tilted 3D spaceship. Each broken system
// (Navigation, Communication, Engine, Cooling) has 2 repair tasks that are
// really BODMAS puzzles: reroute the wires (tap the operations in order),
// enter the access code (keypad) and calibrate the dial (avoid trap answers).
// A sabotage meter fills over time and jumps on mistakes. Once the ship is
// fixed, an emergency meeting asks: whose working breaks BODMAS? Vote them out!

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, Delete, Timer } from "lucide-react";
import { cn } from "../components/ui/utils";
import { STEMBOTS } from "../data/mock";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import type { GameProps } from "./kit/types";

// ── BODMAS engine (token based) ─────────────────────────────────────────

type Op = "+" | "−" | "×" | "÷";
type Tok = { k: "n"; v: number; fresh?: boolean } | { k: "o"; o: Op } | { k: "(" } | { k: ")" } | { k: "sq" };
type Strategy = "bodmas" | "addFirst" | "l2r";

const isHi = (o: Op) => o === "×" || o === "÷";

function applyOp(a: number, o: Op, b: number): number | null {
  let r: number;
  if (o === "+") r = a + b;
  else if (o === "−") r = a - b;
  else if (o === "×") r = a * b;
  else {
    if (b === 0) return null;
    r = a / b;
  }
  return Number.isInteger(r) && r >= 0 ? r : null;
}

/** Remove brackets that only hold one number: ( 7 ) → 7 */
function normalize(t: Tok[]): Tok[] {
  const out = t.slice();
  for (let i = 0; i + 2 < out.length; i++) {
    if (out[i].k === "(" && out[i + 1].k === "n" && out[i + 2].k === ")") {
      out.splice(i, 3, out[i + 1]);
      i = -1;
    }
  }
  return out;
}

/** Innermost bracket groups (inclusive ranges), or the whole expression. */
function groups(t: Tok[]): [number, number][] {
  const res: [number, number][] = [];
  let open = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i].k === "(") open = i;
    else if (t[i].k === ")") {
      if (open >= 0) res.push([open + 1, i - 1]);
      open = -1;
    }
  }
  return res.length ? res : [[0, t.length - 1]];
}

function pickInRange(t: Tok[], [s, e]: [number, number], strat: Strategy): number | null {
  for (let i = s; i <= e; i++) if (t[i].k === "sq") return i;
  const ops: number[] = [];
  for (let i = s; i <= e; i++) if (t[i].k === "o") ops.push(i);
  if (!ops.length) return null;
  if (strat === "l2r") return ops[0];
  const hi = ops.find((i) => isHi((t[i] as { o: Op }).o));
  const lo = ops.find((i) => !isHi((t[i] as { o: Op }).o));
  if (strat === "bodmas") return hi ?? ops[0];
  return lo ?? ops[0];
}

interface Step {
  a: number;
  o: Op | "²";
  b: number;
  r: number;
}

function performAt(t: Tok[], idx: number): { tokens: Tok[]; step: Step } | null {
  const clean = t.map((x) => (x.k === "n" && x.fresh ? { k: "n" as const, v: x.v } : x));
  const tk = clean[idx];
  if (tk.k === "sq") {
    const a = clean[idx - 1];
    if (a?.k !== "n") return null;
    const r = a.v * a.v;
    clean.splice(idx - 1, 2, { k: "n", v: r, fresh: true });
    return { tokens: normalize(clean), step: { a: a.v, o: "²", b: 2, r } };
  }
  if (tk.k !== "o") return null;
  const a = clean[idx - 1];
  const b = clean[idx + 1];
  if (a?.k !== "n" || b?.k !== "n") return null;
  const r = applyOp(a.v, tk.o, b.v);
  if (r === null) return null;
  clean.splice(idx - 1, 3, { k: "n", v: r, fresh: true });
  return { tokens: normalize(clean), step: { a: a.v, o: tk.o, b: b.v, r } };
}

function acceptable(t: Tok[]): number[] {
  return groups(t)
    .map((g) => pickInRange(t, g, "bodmas"))
    .filter((x): x is number => x !== null);
}

function tokStr(t: Tok[]) {
  let out = "";
  for (const x of t) {
    if (x.k === "sq") out += "²";
    else if (x.k === ")") out += ")";
    else {
      if (out && !out.endsWith("(")) out += " ";
      out += x.k === "(" ? "(" : x.k === "n" ? String(x.v) : x.o;
    }
  }
  return out;
}

function solve(t: Tok[], strat: Strategy): { answer: number | null; lines: string[]; steps: Step[] } {
  let cur = normalize(t);
  const lines: string[] = [];
  const steps: Step[] = [];
  let guard = 0;
  while (cur.length > 1 && guard++ < 20) {
    const idx = pickInRange(cur, groups(cur)[0], strat);
    if (idx === null) return { answer: null, lines, steps };
    const res = performAt(cur, idx);
    if (!res) return { answer: null, lines, steps };
    cur = res.tokens;
    steps.push(res.step);
    lines.push(tokStr(cur));
  }
  return { answer: cur.length === 1 && cur[0].k === "n" ? cur[0].v : null, lines, steps };
}

// Expression generator: builds a tree top-down from a target so every step
// is a whole number, then prints it with only the brackets it needs.
type Node = { k: "n"; v: number } | { k: "sq"; b: number } | { k: "o"; o: Op; l: Node; r: Node };
const SQUARES: Record<number, number> = { 4: 2, 9: 3, 16: 4, 25: 5, 36: 6, 49: 7, 64: 8, 81: 9, 100: 10, 121: 11, 144: 12 };

interface GenCfg {
  ops: number;
  set: Op[];
  lo: number;
  hi: number;
  max: number;
  sq: boolean;
  bracket: boolean;
}

function gen(ops: number, target: number, cfg: GenCfg, rnd: () => number): Node | null {
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  if (ops === 0) {
    if (cfg.sq && SQUARES[target] && rnd() < 0.5) return { k: "sq", b: SQUARES[target] };
    return { k: "n", v: target };
  }
  const leftOps = ri(0, ops - 1);
  const rightOps = ops - 1 - leftOps;
  for (let attempt = 0; attempt < 6; attempt++) {
    const o = cfg.set[Math.floor(rnd() * cfg.set.length)];
    let a: number;
    let b: number;
    if (o === "+") {
      if (target < 2) continue;
      a = ri(1, target - 1);
      b = target - a;
    } else if (o === "−") {
      b = ri(1, 15);
      a = target + b;
      if (a > cfg.max) continue;
    } else if (o === "×") {
      const divs: number[] = [];
      for (let d = 2; d <= 12; d++) if (target % d === 0 && target / d >= 2 && target / d <= 12) divs.push(d);
      if (!divs.length) continue;
      const d = divs[Math.floor(rnd() * divs.length)];
      a = target / d;
      b = d;
      if (rnd() < 0.5) [a, b] = [b, a];
    } else {
      b = ri(2, 9);
      a = target * b;
      if (a > Math.max(cfg.max, 72)) continue;
    }
    const L = gen(leftOps, a, cfg, rnd);
    const R = gen(rightOps, b, cfg, rnd);
    if (L && R) return { k: "o", o, l: L, r: R };
  }
  return null;
}

const prec = (n: Node) => (n.k === "o" ? (isHi(n.o) ? 2 : 1) : 3);

function flatten(n: Node): Tok[] {
  if (n.k === "n") return [{ k: "n", v: n.v }];
  if (n.k === "sq") return [{ k: "n", v: n.b }, { k: "sq" }];
  const p = prec(n);
  const wrap = (c: Node, right: boolean): Tok[] => {
    const t = flatten(c);
    const cp = prec(c);
    const need = cp < p || (right && cp === p && (n.o === "−" || n.o === "÷"));
    return need ? [{ k: "(" }, ...t, { k: ")" }] : t;
  };
  return [...wrap(n.l, false), { k: "o", o: n.o }, ...wrap(n.r, true)];
}

interface Puzzle {
  tokens: Tok[];
  answer: number;
  ops: number;
  working: string[];
  options: number[];
}

const LEVELS: GenCfg[] = [
  { ops: 2, set: ["+", "−", "×"], lo: 10, hi: 30, max: 60, sq: false, bracket: false },
  { ops: 2, set: ["+", "−", "×", "÷"], lo: 6, hi: 30, max: 60, sq: false, bracket: true },
  { ops: 3, set: ["+", "−", "×", "÷"], lo: 10, hi: 40, max: 80, sq: false, bracket: false },
  { ops: 3, set: ["+", "−", "×", "÷"], lo: 10, hi: 40, max: 80, sq: false, bracket: true },
  { ops: 3, set: ["+", "−", "×", "÷"], lo: 12, hi: 50, max: 100, sq: true, bracket: false },
  { ops: 3, set: ["+", "−", "×", "÷"], lo: 15, hi: 50, max: 100, sq: false, bracket: true },
  { ops: 4, set: ["+", "−", "×", "÷"], lo: 15, hi: 60, max: 100, sq: true, bracket: false },
  { ops: 4, set: ["+", "−", "×", "÷"], lo: 15, hi: 60, max: 100, sq: true, bracket: true },
];

function makePuzzle(cfg: GenCfg, rnd: () => number, needWrong?: Strategy[]): Puzzle & { wrong?: { strat: Strategy; lines: string[]; answer: number } } {
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  let best: (Puzzle & { wrong?: { strat: Strategy; lines: string[]; answer: number } }) | null = null;
  for (let tries = 0; tries < 400; tries++) {
    const target = ri(cfg.lo, cfg.hi);
    const tree = gen(cfg.ops, target, cfg, rnd);
    if (!tree) continue;
    const tokens = flatten(tree);
    const s = solve(tokens, "bodmas");
    if (s.answer !== target) continue;
    const nums = tokens.filter((t) => t.k === "n") as { v: number }[];
    if (nums.some((n) => n.v > 144)) continue;
    const hasBr = tokens.some((t) => t.k === "(");
    if (cfg.bracket && !hasBr) continue;
    if (!cfg.bracket && hasBr && rnd() < 0.6) continue;
    const l2r = solve(tokens, "l2r").answer;
    const add = solve(tokens, "addFirst").answer;
    const noBr = hasBr ? solve(tokens.filter((t) => t.k !== "(" && t.k !== ")"), "bodmas").answer : target;
    if (l2r === target && add === target && noBr === target) continue; // order would not matter
    if (nums.filter((n) => n.v === 1).length >= 2) continue;
    let wrong: { strat: Strategy; lines: string[]; answer: number } | undefined;
    if (needWrong) {
      for (const st of needWrong) {
        const w = solve(tokens, st);
        if (w.answer !== null && w.answer !== target) {
          wrong = { strat: st, lines: w.lines, answer: w.answer };
          break;
        }
      }
      if (!wrong) continue;
    }
    // Dial options: correct + the classic order-mistake answers + near misses
    const opts = new Set<number>([target]);
    for (const w of [l2r, add, noBr]) if (w !== null && w !== target && w <= 200 && opts.size < 4) opts.add(w);
    let g = 0;
    while (opts.size < 4 && g++ < 50) {
      const d = ri(1, 9) * (rnd() < 0.5 ? -1 : 1);
      if (target + d >= 0) opts.add(target + d);
    }
    const options = [...opts].sort(() => rnd() - 0.5);
    best = { tokens, answer: target, ops: cfg.ops, working: s.lines, options, wrong };
    break;
  }
  if (!best) {
    const tokens: Tok[] = [{ k: "n", v: 4 }, { k: "o", o: "+" }, { k: "n", v: 3 }, { k: "o", o: "×" }, { k: "n", v: 5 }];
    best = {
      tokens,
      answer: 19,
      ops: 2,
      working: ["4 + 15", "19"],
      options: [19, 35, 23, 17],
      wrong: { strat: "l2r", lines: ["7 × 5", "35"], answer: 35 },
    };
  }
  return best;
}

// ── Ship map ────────────────────────────────────────────────────────────

type SysId = "nav" | "comms" | "engine" | "cooling";
type RoomId = SysId | "cafe";
type TaskType = "wires" | "keypad" | "dial";

const SYSTEMS: Record<SysId, { name: string; icon: string; color: string; dark: string; verb: string }> = {
  nav: { name: "Navigation", icon: "🧭", color: "#38bdf8", dark: "#0369a1", verb: "Course plotted" },
  comms: { name: "Communication", icon: "📡", color: "#a78bfa", dark: "#6d28d9", verb: "Signal restored" },
  engine: { name: "Engine", icon: "🚀", color: "#fb923c", dark: "#c2410c", verb: "Engines roaring" },
  cooling: { name: "Cooling", icon: "❄️", color: "#22d3ee", dark: "#0e7490", verb: "Reactor cooled" },
};
const SYS_IDS: SysId[] = ["nav", "comms", "engine", "cooling"];
const TASKS_PER_SYS = 2;
const TOTAL_TASKS = SYS_IDS.length * TASKS_PER_SYS;
const TASK_ORDER: TaskType[] = ["wires", "keypad", "dial", "wires", "dial", "keypad", "wires", "keypad"];
const TASK_INFO: Record<TaskType, { name: string; how: string }> = {
  wires: { name: "Reroute the wires", how: "Tap each sign in BODMAS order to connect the wires." },
  keypad: { name: "Enter the access code", how: "Work out the answer and type it on the keypad." },
  dial: { name: "Calibrate the dial", how: "Turn the dial to the correct answer. Watch out for traps!" },
};

const ROOMS: Record<RoomId, { x: number; y: number; w: number; h: number }> = {
  comms: { x: 230, y: 0, w: 150, h: 110 },
  nav: { x: 0, y: 165, w: 160, h: 115 },
  cafe: { x: 225, y: 160, w: 160, h: 125 },
  engine: { x: 450, y: 165, w: 160, h: 115 },
  cooling: { x: 230, y: 335, w: 150, h: 110 },
};
const CENTER = (r: RoomId) => ({ x: ROOMS[r].x + ROOMS[r].w / 2, y: ROOMS[r].y + ROOMS[r].h / 2 });
const WORLD_W = 610;
const WORLD_H = 445;
const TILT = 52;
const SPIN = -14;
const ROOM_Z = 30;

const SUSPECTS = [
  { name: "Lime", color: "#84cc16" },
  { name: "Cyan", color: "#22d3ee" },
  { name: "Yellow", color: "#facc15" },
  { name: "Pink", color: "#f472b6" },
];
const PLAYER_COLOR = "#f97316";

const KEY_DIR: Record<string, RoomId> = {
  ArrowUp: "comms",
  w: "comms",
  W: "comms",
  ArrowDown: "cooling",
  s: "cooling",
  S: "cooling",
  ArrowLeft: "nav",
  a: "nav",
  A: "nav",
  ArrowRight: "engine",
  d: "engine",
  D: "engine",
};

const SAB_FILL_SECONDS = 260;
const SAB_WRONG = 0.05;
const TASK_POINTS = 8;
const SAB_POINTS = 16;
const VOTE_POINTS = 20;

const STRAT_MISTAKE: Record<Strategy, string> = {
  addFirst: "did + or − before × and ÷",
  l2r: "just went left to right and skipped the × ÷ first rule",
  bodmas: "",
};

// ── Main component ──────────────────────────────────────────────────────

export function BodmasTasks({ seed, reportProgress, finish }: GameProps) {
  const data = useMemo(() => {
    const rnd = seededRandom(seed * 7 + 13);
    const puzzles = LEVELS.map((cfg) => makePuzzle(cfg, rnd));
    const impostor = Math.floor(rnd() * 4);
    const voteCfg: GenCfg = { ops: 3, set: ["+", "−", "×", "÷"], lo: 10, hi: 40, max: 80, sq: false, bracket: false };
    const suspects = SUSPECTS.map((s, i) => {
      const order: Strategy[] = rnd() < 0.5 ? ["addFirst", "l2r"] : ["l2r", "addFirst"];
      const p = makePuzzle({ ...voteCfg, bracket: i % 2 === 1 }, rnd, i === impostor ? order : undefined);
      const isImp = i === impostor && !!p.wrong;
      return {
        ...s,
        expr: tokStr(p.tokens),
        lines: isImp ? p.wrong!.lines : p.working,
        strat: isImp ? p.wrong!.strat : ("bodmas" as Strategy),
      };
    });
    return { puzzles, impostor, suspects };
  }, [seed]);

  const [phase, setPhase] = useState<"play" | "allFixed" | "meeting" | "eject" | "lost" | "done">("play");
  const [started, setStarted] = useState(false);
  const [sab, setSab] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [fixed, setFixed] = useState<Record<SysId, number>>({ nav: 0, comms: 0, engine: 0, cooling: 0 });
  const [doneCount, setDoneCount] = useState(0);
  const [taskPts, setTaskPts] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [playerRoom, setPlayerRoom] = useState<RoomId>("cafe");
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [panel, setPanel] = useState<{ sys: SysId; slot: number; wrongs: number; openedAt: number; stamp: boolean } | null>(null);
  const [sabEnd, setSabEnd] = useState<number | null>(null);
  const [vote, setVote] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ text: string; color: string } | null>(null);
  const [sabPulse, setSabPulse] = useState(0);
  const [wander, setWander] = useState<RoomId[]>(["nav", "engine", "comms", "cooling"]);

  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  useEffect(() => {
    const t = window.setTimeout(() => setStarted(true), 2600);
    return () => clearTimeout(t);
  }, []);

  const showFlash = (text: string, color = "bg-emerald-500") => {
    setFlash({ text, color });
    later(() => setFlash((f) => (f?.text === text ? null : f)), 1600);
  };

  // ── Score ──
  const voteCorrect = vote !== null && vote === data.impostor;
  const score = Math.max(
    0,
    Math.min(100, Math.round(taskPts + (sabEnd !== null ? SAB_POINTS * (1 - sabEnd) : 0) + (voteCorrect ? VOTE_POINTS : 0))),
  );
  const progress = Math.min(1, (doneCount + (vote !== null ? 1 : 0)) / (TOTAL_TASKS + 1));
  useEffect(() => {
    reportProgress(score, progress);
  }, [score, progress, reportProgress]);

  // ── Clock + sabotage ──
  const sabRef = useRef(sab);
  sabRef.current = sab;
  const lastAlarm = useRef(0);
  useEffect(() => {
    if (!started || phase !== "play") return;
    const id = window.setInterval(() => {
      setElapsed((e) => e + 0.1);
      setSab((s) => Math.min(1, s + 0.1 / SAB_FILL_SECONDS));
      const now = Date.now();
      if (sabRef.current > 0.72 && now - lastAlarm.current > 3200) {
        lastAlarm.current = now;
        sfx.alarm();
      }
    }, 100);
    return () => clearInterval(id);
  }, [started, phase]);

  useEffect(() => {
    if (phase === "play" && sab >= 1) {
      setPhase("lost");
      setPanel(null);
      sfx.explode();
    }
  }, [sab, phase]);

  // Wandering crewmates (visual only)
  useEffect(() => {
    if (phase !== "play") return;
    const rooms: RoomId[] = ["nav", "comms", "engine", "cooling", "cafe"];
    const id = window.setInterval(() => {
      setWander((w) => {
        const n = w.slice();
        const i = Math.floor(Math.random() * n.length);
        n[i] = rooms[Math.floor(Math.random() * rooms.length)];
        return n;
      });
    }, 1400);
    return () => clearInterval(id);
  }, [phase]);

  // ── Finish ──
  const finishedRef = useRef(false);
  useEffect(() => {
    if ((phase !== "done" && phase !== "lost") || finishedRef.current) return;
    finishedRef.current = true;
    const t = window.setTimeout(
      () =>
        finish(score, [
          { label: "Systems fixed", value: `${SYS_IDS.filter((s) => fixed[s] >= TASKS_PER_SYS).length}/4` },
          { label: "First-try fixes", value: `${firstTry}/${TOTAL_TASKS}` },
          { label: "Ship safety", value: sabEnd !== null ? `${Math.round((1 - sabEnd) * 100)}%` : "Sabotaged!" },
          { label: "Impostor", value: vote === null ? "Escaped" : voteCorrect ? "Caught!" : "Escaped" },
        ]),
      phase === "lost" ? 2600 : 700,
    );
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Movement ──
  const live = useRef({ walking, panel, phase, playerRoom, fixed, doneCount, started });
  live.current = { walking, panel, phase, playerRoom, fixed, doneCount, started };

  // Wrongs and start time stick to a task even if the panel is closed and reopened
  const slotMem = useRef<Record<number, { wrongs: number; openedAt: number }>>({});
  const tryOpen = (room: RoomId) => {
    const L = live.current;
    if (room === "cafe" || L.panel || L.phase !== "play") return;
    if (L.fixed[room] >= TASKS_PER_SYS) {
      showFlash(`${SYSTEMS[room].name} is already fixed!`, "bg-sky-500");
      return;
    }
    sfx.whoosh();
    const slot = L.doneCount;
    const mem = slotMem.current[slot] ?? (slotMem.current[slot] = { wrongs: 0, openedAt: Date.now() });
    setPanel({ sys: room, slot, wrongs: mem.wrongs, openedAt: mem.openedAt, stamp: false });
  };

  const goTo = (room: RoomId) => {
    const L = live.current;
    if (!L.started || L.walking || L.panel || L.phase !== "play") return;
    if (room === L.playerRoom) {
      tryOpen(room);
      return;
    }
    const path: RoomId[] = L.playerRoom === "cafe" || room === "cafe" ? [room] : ["cafe", room];
    sfx.click();
    setWalking(true);
    let prev = L.playerRoom;
    path.forEach((r, k) => {
      later(() => {
        setFacing(CENTER(r).x >= CENTER(prev).x ? 1 : -1);
        prev = r;
        setPlayerRoom(r);
        sfx.tick();
      }, k * 560);
      later(() => sfx.tick(), k * 560 + 280);
    });
    later(() => {
      setWalking(false);
      later(() => tryOpen(room), 60);
    }, path.length * 560 + 80);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const L = live.current;
      if (L.panel || L.phase !== "play") return;
      const dest = KEY_DIR[e.key];
      if (dest) {
        e.preventDefault();
        goTo(dest === L.playerRoom ? "cafe" : dest);
      } else if (e.key === "Enter" || e.key === " " || e.key === "e" || e.key === "E") {
        e.preventDefault();
        tryOpen(L.playerRoom);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Task results ──
  const onWrong = () => {
    sfx.wrong();
    setSab((s) => Math.min(1, s + SAB_WRONG));
    setSabPulse((p) => p + 1);
    setPanel((p) => {
      if (!p) return p;
      const mem = slotMem.current[p.slot];
      if (mem) mem.wrongs = p.wrongs + 1;
      return { ...p, wrongs: p.wrongs + 1 };
    });
  };

  const onSolved = () => {
    const p = panel;
    if (!p || p.stamp) return;
    const puzzle = data.puzzles[p.slot];
    const secs = (Date.now() - p.openedAt) / 1000;
    const par = 10 + puzzle.ops * 4;
    const spd = Math.max(0.5, Math.min(1, 1 - Math.max(0, secs - par) / 30));
    const acc = [1, 0.6, 0.35, 0.15][Math.min(3, p.wrongs)] ?? 0.1;
    const pts = TASK_POINTS * acc * spd;
    setTaskPts((t) => t + pts);
    if (p.wrongs === 0) setFirstTry((f) => f + 1);
    const newDone = doneCount + 1;
    setDoneCount(newDone);
    const sysDone = fixed[p.sys] + 1;
    setFixed((f) => ({ ...f, [p.sys]: sysDone }));
    setPanel({ ...p, stamp: true });
    sfx.correct();
    if (sysDone >= TASKS_PER_SYS) {
      later(() => {
        setPanel(null);
        sfx.levelUp();
        showFlash(`${SYSTEMS[p.sys].icon} ${SYSTEMS[p.sys].name} ONLINE! +${Math.round(pts)}`);
        if (newDone >= TOTAL_TASKS) {
          setSabEnd(sabRef.current);
          setPhase("allFixed");
          later(() => sfx.fanfare(), 300);
          later(() => {
            sfx.alarm();
            setPhase("meeting");
          }, 2600);
        }
      }, 900);
    } else {
      later(() => {
        slotMem.current[newDone] = { wrongs: 0, openedAt: Date.now() };
        setPanel({ sys: p.sys, slot: newDone, wrongs: 0, openedAt: Date.now(), stamp: false });
      }, 950);
    }
  };

  const castVote = (i: number) => {
    if (vote !== null) return;
    setVote(i);
    sfx.click();
    later(() => {
      setPhase("eject");
      sfx.whoosh();
    }, 500);
    later(() => (i === data.impostor ? sfx.fanfare() : sfx.wrong()), 2300);
    later(() => setPhase("done"), 6500);
  };

  const timeShown = Math.floor(elapsed);
  const fixedSystems = SYS_IDS.filter((s) => fixed[s] >= TASKS_PER_SYS).length;
  const danger = sab > 0.72 && phase === "play";

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden game-fun select-none" style={{ background: "radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #0b1026 60%, #050816 100%)" }}>
      <style>{CSS}</style>
      <Stars />
      {danger && <div className="absolute inset-0 pointer-events-none z-[5] bt-redalert" />}

      {/* HUD */}
      <div className="relative z-10 flex items-stretch gap-2 p-2 sm:p-3">
        <div className="flex-1 min-w-0 bg-white/95 rounded-2xl game-panel px-2 sm:px-3 py-2 flex items-center gap-2 sm:gap-3">
          <img src={STEMBOTS.matthew.avatar} alt="Matthew" className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0 game-float" />
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[8px] sm:text-[9px] text-slate-500">
              TASKS {doneCount}/{TOTAL_TASKS}<span className="hidden sm:inline"> · SYSTEMS {fixedSystems}/4</span>
            </p>
            <div className="h-3 bg-slate-200 rounded-full mt-1 overflow-hidden border-2 border-black/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all duration-500" style={{ width: `${(doneCount / TOTAL_TASKS) * 100}%` }} />
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <AlertTriangle size={12} className={cn("shrink-0", danger ? "text-rose-600" : "text-rose-400")} />
              <div key={sabPulse} className={cn("relative h-3 flex-1 bg-slate-200 rounded-full overflow-hidden border-2 border-black/10", sabPulse > 0 && "game-shake")}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${sab * 100}%`, background: "repeating-linear-gradient(45deg,#ef4444 0 8px,#b91c1c 8px 16px)" }}
                />
              </div>
              <span className={cn("game-pixel text-[8px] w-9 text-right", danger ? "text-rose-600" : "text-slate-500")}>{Math.round(sab * 100)}%</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-2 sm:px-3 py-2 flex flex-col items-center justify-center min-w-[64px] sm:min-w-[84px]">
          <Timer size={14} className="text-amber-300" />
          <span className="game-pixel text-xs sm:text-sm">{timeShown}s</span>
        </div>
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-2 sm:px-3 py-2 flex flex-col items-center justify-center min-w-[64px] sm:min-w-[84px]">
          <span className="text-[9px] font-bold text-amber-300">SCORE</span>
          <span className="game-pixel text-xs sm:text-sm text-yellow-300">{score}</span>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-0">
        <ShipMap
          playerRoom={playerRoom}
          walking={walking}
          facing={facing}
          fixed={fixed}
          wander={wander}
          onRoom={goTo}
          meeting={phase === "meeting" || phase === "eject" || phase === "done"}
        />

        {/* Task list */}
        <div className="absolute left-2 top-2 hidden sm:block bg-slate-900/80 text-white rounded-xl game-panel px-3 py-2 w-[168px] z-10">
          <p className="game-pixel text-[8px] text-amber-300 mb-1.5">TASK LIST</p>
          {SYS_IDS.map((s) => {
            const done = fixed[s] >= TASKS_PER_SYS;
            return (
              <button key={s} onClick={() => goTo(s)} className={cn("w-full flex items-center gap-1.5 text-[12px] font-semibold py-0.5 text-left", done ? "text-emerald-300" : "text-white")}>
                <span>{SYSTEMS[s].icon}</span>
                <span className={cn("flex-1 truncate", done && "line-through opacity-80")}>{SYSTEMS[s].name}</span>
                <span className="text-[10px]">{fixed[s]}/2</span>
              </button>
            );
          })}
        </div>

        {/* Controls hint */}
        <div className="absolute inset-x-0 bottom-2 flex justify-center z-10 pointer-events-none px-2">
          <div className="bg-slate-900/80 text-white/90 text-[11px] sm:text-xs font-semibold rounded-full px-3 py-1.5 game-panel text-center">
            {!started ? "Get ready, crewmate…" : "Tap a room (or use arrow keys / WASD) to walk there and fix it"}
          </div>
        </div>

        {flash && (
          <div className="absolute inset-x-0 top-3 flex justify-center z-20 pointer-events-none px-2">
            <span key={flash.text} className={cn("game-bounce-in text-white font-bold px-4 py-2 rounded-2xl game-panel text-sm sm:text-base text-center", flash.color)}>
              {flash.text}
            </span>
          </div>
        )}
      </div>

      {/* Task panel */}
      {panel && (
        <TaskPanel
          key={`${panel.slot}`}
          sys={panel.sys}
          part={fixed[panel.sys] + (panel.stamp ? 0 : 1)}
          type={TASK_ORDER[panel.slot]}
          puzzle={data.puzzles[panel.slot]}
          wrongs={panel.wrongs}
          stamp={panel.stamp}
          onWrong={onWrong}
          onSolved={onSolved}
          onClose={() => {
            sfx.click();
            setPanel(null);
          }}
        />
      )}

      {phase === "allFixed" && (
        <Overlay>
          <div className="text-center game-bounce-in">
            <p className="text-6xl mb-3">🛰️✨</p>
            <p className="game-pixel text-lg sm:text-2xl text-emerald-300 drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]">ALL SYSTEMS ONLINE!</p>
            <p className="text-white/90 mt-3 font-semibold">Ship safety bonus: +{Math.round(SAB_POINTS * (1 - (sabEnd ?? 0)))}</p>
            <p className="text-amber-300 mt-1 font-bold">But wait… someone broke the ship on purpose…</p>
          </div>
        </Overlay>
      )}

      {phase === "meeting" && <Meeting suspects={data.suspects} vote={vote} onVote={castVote} />}

      {phase === "eject" && vote !== null && (
        <Ejection suspect={data.suspects[vote]} wasImpostor={vote === data.impostor} real={data.suspects[data.impostor]} />
      )}

      {phase === "lost" && (
        <Overlay red>
          <div className="text-center game-bounce-in px-4">
            <p className="text-6xl mb-3">💥</p>
            <p className="game-pixel text-lg sm:text-2xl text-rose-300 drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]">SHIP SABOTAGED!</p>
            <p className="text-white/90 mt-3 font-semibold">The impostor wins this time. Replay and fix the systems faster!</p>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ── Ship map (CSS 3D) ───────────────────────────────────────────────────

function ShipMap({
  playerRoom,
  walking,
  facing,
  fixed,
  wander,
  onRoom,
  meeting,
}: {
  playerRoom: RoomId;
  walking: boolean;
  facing: 1 | -1;
  fixed: Record<SysId, number>;
  wander: RoomId[];
  onRoom: (r: RoomId) => void;
  meeting: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.max(0.42, Math.min(1.1, w / 760, h / 430)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const offsets = [
    [-40, -22],
    [40, -22],
    [-44, 28],
    [44, 28],
  ];
  const p = CENTER(playerRoom);
  const roomList: RoomId[] = ["comms", "nav", "cafe", "engine", "cooling"];

  return (
    <div ref={box} className="absolute inset-0 flex items-center justify-center">
      <div style={{ transform: `scale(${scale})`, perspective: 1300 }}>
        <div
          className="relative"
          style={{
            width: WORLD_W,
            height: WORLD_H,
            transformStyle: "preserve-3d",
            transform: `translateY(-10px) rotateX(${TILT}deg) rotateZ(${SPIN}deg)`,
          }}
        >
          {/* Hull */}
          <Slab
            x={-26}
            y={-26}
            w={WORLD_W + 52}
            h={WORLD_H + 52}
            d={26}
            z={-26}
            top="#1e293b"
            side="#334155"
            side2="#0f172a"
            topStyle={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.12) 2px, transparent 2px), linear-gradient(90deg, rgba(148,163,184,0.12) 2px, transparent 2px)",
              backgroundSize: "30px 30px",
              borderRadius: 26,
              boxShadow: "inset 0 0 0 4px #475569",
            }}
          />
          {/* Corridors */}
          <Slab x={160} y={200} w={65} h={44} d={14} top="#64748b" side="#475569" side2="#334155" topStyle={STRIPES_H} />
          <Slab x={385} y={200} w={65} h={44} d={14} top="#64748b" side="#475569" side2="#334155" topStyle={STRIPES_H} />
          <Slab x={283} y={110} w={44} h={50} d={14} top="#64748b" side="#475569" side2="#334155" topStyle={STRIPES_V} />
          <Slab x={283} y={285} w={44} h={50} d={14} top="#64748b" side="#475569" side2="#334155" topStyle={STRIPES_V} />

          {/* Cargo crates in the corners */}
          {[
            [40, 30],
            [80, 50],
            [520, 40],
            [40, 380],
            [520, 370],
            [555, 395],
          ].map(([x, y], i) => (
            <Slab key={i} x={x} y={y} w={34} h={34} d={30} top="#d4a373" side="#a26c3c" side2="#7c4f28" topStyle={CRATE} />
          ))}
          <Slab x={60} y={30} w={34} h={34} d={30} z={30} top="#d4a373" side="#a26c3c" side2="#7c4f28" topStyle={CRATE} />

          {/* Rooms */}
          {roomList.map((r) => {
            const R = ROOMS[r];
            const isSys = r !== "cafe";
            const done = isSys && fixed[r as SysId] >= TASKS_PER_SYS;
            const S = isSys ? SYSTEMS[r as SysId] : null;
            const top = S ? (done ? S.color : S.dark) : "#cbd5e1";
            return (
              <div key={r} onClick={() => onRoom(r)} className="cursor-pointer" style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", pointerEvents: "none" }}>
                <Slab
                  x={R.x}
                  y={R.y}
                  w={R.w}
                  h={R.h}
                  d={ROOM_Z}
                  top={top}
                  side={S ? S.dark : "#94a3b8"}
                  side2={S ? "#1e1b4b" : "#64748b"}
                  topStyle={{
                    backgroundImage:
                      "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28), transparent 55%), linear-gradient(160deg, rgba(255,255,255,0.12), rgba(0,0,0,0.04))",
                    boxShadow: done ? "inset 0 0 0 4px #4ade80, 0 0 24px #4ade80" : isSys ? "inset 0 0 0 4px rgba(248,113,113,0.85)" : "inset 0 0 0 4px #e2e8f0",
                    pointerEvents: "auto",
                    transition: "background-color 500ms",
                  }}
                />
                {/* Console block */}
                <Slab
                  x={R.x + R.w / 2 - 22}
                  y={R.y + 12}
                  w={44}
                  h={26}
                  z={ROOM_Z}
                  d={22}
                  top={r === "cafe" ? "#e2e8f0" : "#334155"}
                  side={r === "cafe" ? "#94a3b8" : "#1e293b"}
                  side2="#0f172a"
                />
                <Billboard x={R.x + R.w / 2} y={R.y + 26} z={ROOM_Z + 22}>
                  <div className="flex flex-col items-center pointer-events-auto" style={{ marginBottom: -4 }}>
                    {r === "cafe" ? (
                      <div className="w-10 h-10 rounded-full border-4 border-slate-700 shadow-lg" style={{ background: "radial-gradient(circle at 35% 30%, #fca5a5, #dc2626 55%, #7f1d1d)" }} />
                    ) : (
                      <div className={cn("text-[34px] leading-none", !done && "bt-broken")}>{S!.icon}</div>
                    )}
                  </div>
                </Billboard>
                {/* Sign + status light */}
                <Billboard x={R.x + R.w / 2} y={R.y + R.h - 6} z={ROOM_Z}>
                  <div
                    className={cn(
                      "pointer-events-auto whitespace-nowrap rounded-lg px-2 py-0.5 text-[11px] font-bold border-2 shadow-md flex items-center gap-1",
                      !isSys ? "bg-white text-slate-700 border-slate-300" : done ? "bg-emerald-500 text-white border-emerald-700" : "bg-slate-900 text-white border-rose-500",
                    )}
                  >
                    {isSys && <span className={cn("inline-block w-2 h-2 rounded-full", done ? "bg-lime-200" : "bg-rose-500 bt-blink")} />}
                    {S ? S.name : meeting ? "Meeting!" : "Cafeteria"}
                    {isSys && <span className="opacity-80">{done ? "✓" : `${fixed[r as SysId]}/2`}</span>}
                  </div>
                </Billboard>
              </div>
            );
          })}

          {/* Wandering crewmates */}
          {!meeting &&
            wander.map((r, i) => {
              const c = CENTER(r);
              return (
                <Billboard key={i} x={c.x + offsets[i][0]} y={c.y + offsets[i][1] + 10} z={ROOM_Z} moving slow>
                  <Bean color={SUSPECTS[i].color} size={34} bob />
                </Billboard>
              );
            })}

          {/* Player */}
          <Billboard x={p.x} y={p.y + 18} z={ROOM_Z} moving>
            <div className="flex flex-col items-center">
              <span className="game-pixel text-[8px] bg-white text-slate-900 rounded px-1 mb-0.5 shadow">YOU</span>
              <div style={{ transform: `scaleX(${facing})` }}>
                <Bean color={PLAYER_COLOR} size={44} walking={walking} hat />
              </div>
            </div>
          </Billboard>
        </div>
      </div>
    </div>
  );
}

const STRIPES_H: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0 6px, transparent 6px 16px)",
  boxShadow: "inset 0 3px 0 #facc15, inset 0 -3px 0 #facc15",
};
const STRIPES_V: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0 6px, transparent 6px 16px)",
  boxShadow: "inset 3px 0 0 #facc15, inset -3px 0 0 #facc15",
};
const CRATE: CSSProperties = {
  boxShadow: "inset 0 0 0 3px #7c4f28",
  backgroundImage: "linear-gradient(45deg, transparent 45%, #a26c3c 45%, #a26c3c 55%, transparent 55%)",
};

function Slab({
  x,
  y,
  w,
  h,
  d,
  z = 0,
  top,
  side,
  side2,
  topStyle,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  z?: number;
  top: string;
  side: string;
  side2: string;
  topStyle?: CSSProperties;
}) {
  const f: CSSProperties = { position: "absolute", backfaceVisibility: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transformStyle: "preserve-3d", transform: `translateZ(${z}px)`, pointerEvents: "none" }}>
      <div style={{ ...f, left: 0, top: 0, width: w, height: h, transform: `translateZ(${d}px)`, ...topStyle, backgroundColor: top }} />
      <div style={{ ...f, left: 0, top: h - d, width: w, height: d, transformOrigin: "bottom", transform: "rotateX(-90deg)", backgroundColor: side }} />
      <div style={{ ...f, left: 0, top: 0, width: w, height: d, transformOrigin: "top", transform: "rotateX(90deg)", backgroundColor: side2 }} />
      <div style={{ ...f, left: w - d, top: 0, width: d, height: h, transformOrigin: "right", transform: "rotateY(90deg)", backgroundColor: side2 }} />
      <div style={{ ...f, left: 0, top: 0, width: d, height: h, transformOrigin: "left", transform: "rotateY(-90deg)", backgroundColor: side }} />
    </div>
  );
}

/** Stands a flat sprite upright on the tilted floor, facing the camera. */
function Billboard({ x, y, z, children, moving, slow }: { x: number; y: number; z: number; children: ReactNode; moving?: boolean; slow?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        transform: `translateZ(${z}px)`,
        transition: moving ? `left ${slow ? 1.6 : 0.55}s ${slow ? "ease-in-out" : "linear"}, top ${slow ? 1.6 : 0.55}s ${slow ? "ease-in-out" : "linear"}` : undefined,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          transformOrigin: "50% 100%",
          transform: `translateX(-50%) rotateZ(${-SPIN}deg) rotateX(${-TILT}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Bean({ color, size = 40, walking, bob, hat, dead }: { color: string; size?: number; walking?: boolean; bob?: boolean; hat?: boolean; dead?: boolean }) {
  return (
    <div className={cn(walking && "bt-walk", bob && "bt-bob")} style={{ width: size, height: size * 1.2 }}>
      <svg viewBox="0 0 40 48" width={size} height={size * 1.2} style={{ overflow: "visible", filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.35))" }}>
        <ellipse cx="20" cy="46" rx="14" ry="3" fill="rgba(0,0,0,0.35)" />
        <rect x="2" y="17" width="9" height="17" rx="3" fill={color} stroke="#111827" strokeWidth="2.5" />
        <rect x="11" y="34" width="9" height="11" rx="3" fill={color} stroke="#111827" strokeWidth="2.5" className={walking ? "bt-legA" : undefined} />
        <rect x="23" y="34" width="9" height="11" rx="3" fill={color} stroke="#111827" strokeWidth="2.5" className={walking ? "bt-legB" : undefined} />
        <rect x="8" y="4" width="27" height="36" rx="13" fill={color} stroke="#111827" strokeWidth="2.5" />
        <rect x="10" y="26" width="23" height="11" rx="5" fill="rgba(0,0,0,0.12)" />
        {dead ? (
          <text x="27" y="20" fontSize="12" textAnchor="middle">
            ✖
          </text>
        ) : (
          <>
            <rect x="18" y="10" width="20" height="12" rx="6" fill="#7dd3fc" stroke="#111827" strokeWidth="2.5" />
            <rect x="23" y="12.5" width="9" height="3.5" rx="1.75" fill="#f0f9ff" />
          </>
        )}
        {hat && (
          <g>
            <rect x="14" y="0" width="14" height="6" rx="2" fill="#facc15" stroke="#111827" strokeWidth="2" />
            <circle cx="21" cy="-2" r="2.5" fill="#ef4444" stroke="#111827" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        left: (i * 37.7) % 100,
        top: (i * 53.3) % 100,
        s: i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1,
        d: (i % 5) * 0.6,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white bt-twinkle"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }}
        />
      ))}
      <span className="absolute text-5xl opacity-80" style={{ right: "4%", bottom: "8%" }}>
        🪐
      </span>
      <span className="absolute text-2xl opacity-70" style={{ left: "6%", bottom: "14%" }}>
        🌑
      </span>
    </div>
  );
}

function Overlay({ children, red }: { children: ReactNode; red?: boolean }) {
  return (
    <div className={cn("absolute inset-0 z-30 flex items-center justify-center backdrop-blur-[2px]", red ? "bg-rose-950/80" : "bg-slate-950/75")}>{children}</div>
  );
}

// ── Task panel ──────────────────────────────────────────────────────────

function TaskPanel({
  sys,
  part,
  type,
  puzzle,
  wrongs,
  stamp,
  onWrong,
  onSolved,
  onClose,
}: {
  sys: SysId;
  part: number;
  type: TaskType;
  puzzle: Puzzle;
  wrongs: number;
  stamp: boolean;
  onWrong: () => void;
  onSolved: () => void;
  onClose: () => void;
}) {
  const S = SYSTEMS[sys];
  const info = TASK_INFO[type];
  const tip =
    wrongs === 0
      ? type === "wires"
        ? "Brackets first, then squares, then × and ÷ from left to right, then + and − from left to right!"
        : type === "dial"
          ? "Careful! Some dial numbers are traps for crewmates who just go left to right."
          : "Work it out one step at a time, then punch in the code!"
      : wrongs < 3
        ? type === "wires"
          ? "Not that one! Any brackets? Then look for × or ÷ before + and −."
          : "Oops! Did you do the × and ÷ before the + and −?"
        : type === "wires"
          ? "Follow the glowing sign. You've got this!"
          : `Here's how: ${puzzle.working.join(" → ")}`;

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/60 flex items-center justify-center p-2 sm:p-4">
      <div
        className="relative w-full max-w-[620px] max-h-full overflow-y-auto rounded-3xl game-panel game-bounce-in text-white"
        style={{ background: "linear-gradient(160deg, #475569, #1e293b 55%, #0f172a)", border: `4px solid ${S.color}` }}
      >
        {/* bolts */}
        {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((c) => (
          <span key={c} className={cn("absolute w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-700", c)} />
        ))}
        <div className="flex items-center gap-2 sm:gap-3 px-4 pt-3 pb-2" style={{ background: `linear-gradient(90deg, ${S.dark}, transparent)` }}>
          <span className="text-3xl">{S.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="game-pixel text-[8px] sm:text-[9px] text-white/70">
              {S.name.toUpperCase()} · TASK {Math.min(part, 2)}/2
            </p>
            <p className="font-bold text-base sm:text-lg leading-tight">{info.name}</p>
          </div>
          <button onClick={onClose} className="game-btn bg-rose-500 text-white px-3 py-1.5 text-sm" aria-label="Close task">
            ✕
          </button>
        </div>

        <div className="@container px-3 sm:px-5 pb-3 pt-1">
          <p className="text-[12px] sm:text-[13px] text-white/80 mb-2">{info.how}</p>
          <div className="relative">
            {type === "wires" && <WiresTask puzzle={puzzle} wrongs={wrongs} onWrong={onWrong} onSolved={onSolved} />}
            {type === "keypad" && <KeypadTask puzzle={puzzle} wrongs={wrongs} onWrong={onWrong} onSolved={onSolved} locked={stamp} />}
            {type === "dial" && <DialTask puzzle={puzzle} onWrong={onWrong} onSolved={onSolved} locked={stamp} />}
          </div>

          <div className="flex items-start gap-2 mt-3">
            <img src={STEMBOTS.matthew.avatar} alt="Matthew" className="w-10 h-10 object-contain shrink-0" />
            <div key={tip} className={cn("relative bg-white text-slate-800 rounded-2xl px-3 py-1.5 text-[12px] sm:text-[13px] font-semibold game-panel flex-1", wrongs > 0 && "game-shake")}>
              <span className="text-rose-600 font-bold">Matthew: </span>
              {tip}
            </div>
          </div>
        </div>

        {stamp && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/25 pointer-events-none">
            <div className="game-bounce-in bg-emerald-500 border-4 border-white text-white game-pixel text-sm sm:text-lg px-5 py-3 rounded-2xl rotate-[-6deg] shadow-2xl">
              ✔ TASK COMPLETE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExprView({
  tokens,
  onTap,
  hint,
  bad,
  big,
}: {
  tokens: Tok[];
  onTap?: (i: number) => void;
  hint?: number[];
  bad?: number | null;
  big?: boolean;
}) {
  const wireColors = ["#f43f5e", "#3b82f6", "#facc15", "#a855f7", "#22c55e"];
  let opN = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
      {tokens.map((t, i) => {
        if (t.k === "n")
          return (
            <span
              key={i}
              className={cn(
                "inline-flex items-center justify-center rounded-xl font-bold text-slate-900 border-b-4",
                big ? "min-w-[44px] h-12 px-2 text-2xl" : "min-w-[38px] h-11 px-2 text-xl",
                t.fresh ? "bg-lime-300 border-lime-600 game-bounce-in shadow-[0_0_16px_#bef264]" : "bg-white border-slate-300",
              )}
            >
              {t.v}
            </span>
          );
        if (t.k === "(" || t.k === ")")
          return (
            <span key={i} className={cn("font-bold text-amber-300", big ? "text-4xl" : "text-3xl")}>
              {t.k}
            </span>
          );
        const label = t.k === "sq" ? "²" : t.o;
        const color = wireColors[opN++ % wireColors.length];
        if (!onTap)
          return (
            <span key={i} className={cn("font-bold text-yellow-300", big ? "text-3xl px-1" : "text-2xl px-0.5", t.k === "sq" && "-ml-1 self-start text-xl")}>
              {label}
            </span>
          );
        return (
          <button
            key={i}
            onClick={() => onTap(i)}
            className={cn(
              "game-btn relative !p-0 w-11 h-11 sm:w-12 sm:h-12 text-2xl text-white flex items-center justify-center",
              hint?.includes(i) && "game-pulse ring-4 ring-yellow-300",
              bad === i && "game-shake",
            )}
            style={{ background: color }}
          >
            {label}
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-3 rounded-b" style={{ background: color, filter: "brightness(0.7)" }} />
          </button>
        );
      })}
    </div>
  );
}

function ScreenBox({ children }: { children: ReactNode }) {
  return (
    <div className="bt-screen rounded-2xl border-4 border-slate-950 p-3 sm:p-4" style={{ background: "radial-gradient(ellipse at 50% 0%, #134e4a, #042f2e)", boxShadow: "inset 0 0 20px rgba(0,0,0,0.6)" }}>
      {children}
    </div>
  );
}

function WiresTask({ puzzle, wrongs, onWrong, onSolved }: { puzzle: Puzzle; wrongs: number; onWrong: () => void; onSolved: () => void }) {
  const [tokens, setTokens] = useState<Tok[]>(puzzle.tokens);
  const [log, setLog] = useState<string[]>([]);
  const [bad, setBad] = useState<{ i: number; n: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = tokens.length === 1;
  const ok = acceptable(tokens);

  const tap = (i: number) => {
    if (done) return;
    if (ok.includes(i)) {
      const res = performAt(tokens, i);
      if (!res) return;
      sfx.pop();
      const s = res.step;
      setLog((l) => [...l, s.o === "²" ? `${s.a}² = ${s.r}` : `${s.a} ${s.o} ${s.b} = ${s.r}`]);
      setTokens(res.tokens);
      if (res.tokens.length === 1) setTimeout(onSolved, 450);
    } else {
      setBad({ i, n: (bad?.n ?? 0) + 1 });
      setMistakes((m) => m + 1);
      onWrong();
    }
  };
  void wrongs;

  return (
    <ScreenBox>
      <div className="min-h-[60px] flex items-center justify-center">
        <ExprView tokens={tokens} onTap={tap} hint={mistakes >= 2 ? ok : undefined} bad={bad?.i ?? null} big />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 justify-center min-h-[26px]">
        {log.map((l, i) => (
          <span key={i} className="game-bounce-in bg-emerald-400/20 border border-emerald-300/50 text-emerald-200 rounded-lg px-2 py-0.5 text-xs sm:text-sm font-bold">
            ⚡ {l}
          </span>
        ))}
        {!log.length && <span className="text-emerald-200/60 text-xs">Which sign do you work out first?</span>}
      </div>
    </ScreenBox>
  );
}

function KeypadTask({ puzzle, wrongs, onWrong, onSolved, locked }: { puzzle: Puzzle; wrongs: number; onWrong: () => void; onSolved: () => void; locked: boolean }) {
  const [val, setVal] = useState("");
  const [bad, setBad] = useState(0);
  const state = useRef({ val, locked });
  state.current = { val, locked };

  const press = (k: string) => {
    if (state.current.locked) return;
    if (k === "⌫") {
      sfx.tick();
      setVal((v) => v.slice(0, -1));
    } else if (k === "OK") {
      const v = state.current.val;
      if (!v) return;
      if (Number(v) === puzzle.answer) onSolved();
      else {
        onWrong();
        setBad((b) => b + 1);
        setVal("");
      }
    } else {
      sfx.tick();
      setVal((v) => (v.length >= 4 ? v : v === "0" ? k : v + k));
    }
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === "Backspace") pressRef.current("⌫");
      else if (e.key === "Enter") {
        e.preventDefault();
        pressRef.current("OK");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="grid grid-cols-1 @md:grid-cols-[1fr_auto] gap-3 items-center">
      <ScreenBox>
        <ExprView tokens={puzzle.tokens} big />
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-emerald-200 font-bold text-2xl">=</span>
          <div
            key={bad}
            className={cn(
              "min-w-[110px] h-12 rounded-xl border-4 border-emerald-900 bg-black/60 flex items-center justify-center game-pixel text-xl text-emerald-300",
              bad > 0 && "game-shake",
            )}
          >
            {val || <span className="text-emerald-300/30">?</span>}
            <span className="bt-blink ml-0.5">_</span>
          </div>
        </div>
        {wrongs >= 3 && <p className="text-center text-amber-300 text-xs mt-2 font-bold">Code hint: {puzzle.answer}</p>}
      </ScreenBox>
      <div className="grid grid-cols-3 gap-1.5 justify-self-center">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className={cn(
              "game-btn !p-0 w-14 h-10 sm:h-11 text-lg flex items-center justify-center",
              k === "OK" ? "bg-emerald-500 text-white" : k === "⌫" ? "bg-amber-400 text-slate-900" : "bg-slate-200 text-slate-900",
            )}
          >
            {k === "⌫" ? <Delete size={18} /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}

function DialTask({ puzzle, onWrong, onSolved, locked }: { puzzle: Puzzle; onWrong: () => void; onSolved: () => void; locked: boolean }) {
  const [angle, setAngle] = useState(-90);
  const [crossed, setCrossed] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const pos = [
    { a: -45, cls: "left-[calc(50%+62px)] top-[18px]" },
    { a: 45, cls: "left-[calc(50%+62px)] bottom-[18px]" },
    { a: 135, cls: "right-[calc(50%+62px)] bottom-[18px]" },
    { a: -135, cls: "right-[calc(50%+62px)] top-[18px]" },
  ];
  const choose = (i: number) => {
    if (locked || crossed.includes(i) || picked === puzzle.answer) return;
    sfx.tick();
    setAngle(pos[i].a);
    const v = puzzle.options[i];
    setPicked(v);
    setTimeout(() => {
      if (v === puzzle.answer) onSolved();
      else {
        setCrossed((c) => [...c, i]);
        onWrong();
      }
    }, 380);
  };
  return (
    <ScreenBox>
      <ExprView tokens={puzzle.tokens} big />
      <div className="relative h-[170px] mt-2">
        {/* dial */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] rounded-full border-[6px] border-slate-900"
          style={{ background: "conic-gradient(#22d3ee, #a78bfa, #f472b6, #facc15, #22d3ee)", boxShadow: "0 6px 0 rgba(0,0,0,0.4), inset 0 0 0 8px rgba(255,255,255,0.25)" }}
        >
          <div className="absolute inset-[18px] rounded-full bg-slate-800 border-4 border-slate-950" />
          <div className="absolute left-1/2 top-1/2 h-2 w-[54px] origin-left rounded-full bg-white transition-transform duration-300" style={{ transform: `translateY(-50%) rotate(${angle}deg)`, boxShadow: "0 0 8px #fff" }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-rose-500 border-4 border-slate-950" />
        </div>
        {puzzle.options.map((o, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            className={cn(
              "absolute game-btn !px-3 !py-1.5 text-xl min-w-[64px]",
              pos[i].cls,
              crossed.includes(i) ? "bg-slate-500 text-slate-300 line-through game-shake" : picked === o && o === puzzle.answer ? "bg-emerald-400 text-white" : "bg-white text-slate-900",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </ScreenBox>
  );
}

// ── Emergency meeting ───────────────────────────────────────────────────

type SuspectInfo = { name: string; color: string; expr: string; lines: string[]; strat: Strategy };

function Meeting({ suspects, vote, onVote }: { suspects: SuspectInfo[]; vote: number | null; onVote: (i: number) => void }) {
  return (
    <div className="absolute inset-0 z-30 flex p-2 sm:p-4 overflow-y-auto" style={{ background: "radial-gradient(ellipse at 50% 0%, #7f1d1d, #1e1b4b 70%)" }}>
      <div className="m-auto w-full max-w-[760px]">
      <div className="text-center mb-2 game-bounce-in">
        <p className="game-pixel text-sm sm:text-xl text-rose-300 drop-shadow-[0_6px_14px_rgba(0,0,0,0.4)]">🚨 EMERGENCY MEETING 🚨</p>
        <p className="text-white font-bold text-sm sm:text-base mt-1">Who is the impostor? One crewmate's working breaks BODMAS. Vote them out!</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-2 sm:gap-3 w-full max-w-[760px]">
        {suspects.map((s, i) => (
          <div
            key={s.name}
            className={cn("bg-white/95 rounded-2xl game-panel p-2 sm:p-3 flex gap-2 game-bounce-in", vote === i && "ring-4 ring-yellow-300")}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex flex-col items-center shrink-0 gap-1">
              <Bean color={s.color} size={34} bob />
              <span className="text-[11px] font-bold text-slate-700">{s.name}</span>
              <button disabled={vote !== null} onClick={() => onVote(i)} className="game-btn bg-rose-500 text-white !py-1 !px-2.5 text-xs">
                {vote === i ? "VOTED" : "VOTE"}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[12px] sm:text-[13px] font-bold text-slate-900 leading-snug break-words">{s.expr}</p>
              {s.lines.map((l, k) => (
                <p key={k} className={cn("font-mono text-[11px] sm:text-[12px] leading-snug break-words", k === s.lines.length - 1 ? "text-indigo-700 font-bold" : "text-slate-600")}>
                  = {l}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

function Ejection({ suspect, wasImpostor, real }: { suspect: SuspectInfo; wasImpostor: boolean; real: SuspectInfo }) {
  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-[#030712] flex flex-col items-center justify-center">
      <Stars />
      <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-24">
        <div className="absolute bt-eject" style={{ top: 0 }}>
          <Bean color={suspect.color} size={64} />
        </div>
      </div>
      <div className="relative mt-48 text-center px-4 bt-fadein">
        <p className="text-white text-xl sm:text-2xl font-bold">
          {suspect.name} was {wasImpostor ? "" : "not "}The Impostor.
        </p>
        <p className={cn("mt-2 font-bold text-sm sm:text-base", wasImpostor ? "text-emerald-300" : "text-rose-300")}>
          {wasImpostor ? `Caught! +${VOTE_POINTS}. ` : `The real impostor was ${real.name}. `}
          {real.name} {STRAT_MISTAKE[real.strat]}.
        </p>
      </div>
    </div>
  );
}

const CSS = `
@keyframes bt-walk { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-5px) rotate(4deg); } }
.bt-walk { animation: bt-walk 0.28s ease-in-out infinite; }
@keyframes bt-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.bt-bob { animation: bt-bob 0.9s ease-in-out infinite; }
@keyframes bt-leg { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.bt-legA { animation: bt-leg 0.28s infinite; }
.bt-legB { animation: bt-leg 0.28s 0.14s infinite; }
@keyframes bt-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0.15; } }
.bt-blink { animation: bt-blink 0.8s steps(1) infinite; }
@keyframes bt-broken { 0%,100% { transform: rotate(-6deg); filter: grayscale(0.6) drop-shadow(0 0 6px #ef4444); } 50% { transform: rotate(6deg); filter: grayscale(0.2) drop-shadow(0 0 12px #ef4444); } }
.bt-broken { animation: bt-broken 1.1s ease-in-out infinite; }
@keyframes bt-twinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
.bt-twinkle { animation: bt-twinkle 2.4s ease-in-out infinite; }
@keyframes bt-red { 0%,100% { box-shadow: inset 0 0 60px 10px rgba(239,68,68,0.15); } 50% { box-shadow: inset 0 0 90px 30px rgba(239,68,68,0.5); } }
.bt-redalert { animation: bt-red 1s ease-in-out infinite; }
@keyframes bt-eject { 0% { left: -12%; transform: rotate(0deg); } 100% { left: 110%; transform: rotate(900deg); } }
.bt-eject { animation: bt-eject 3.2s linear forwards; }
@keyframes bt-fadein { 0%,45% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
.bt-fadein { animation: bt-fadein 2.6s ease-out forwards; }
`;
