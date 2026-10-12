// Asteroid Blasters — Space Busters science game (forces and energy).
// Four crewmates guard the ship from the deck. Asteroids carry answers:
// blast the ones that answer the question, dodge the wrong ones, and clear
// the plain rocks before they hit the hull. Three waves: Forces, Energy, and
// an Impostor attack that mixes both. STEMbots (or live players) blast alongside you.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Shield, Zap } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { cn } from "../components/ui/utils";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import { clamp, loadImage, roundRect, shuffled, useCanvasLoop } from "./kit/canvas";
import type { BotId, GameProps, RivalInfo } from "./kit/types";

// ── World (units: the play area is 16 × 10) ───────────
const W = 16;
const H = 10;
const DECK = 8.7; // crewmates stand here
const STEP = 1 / 60;
const Q_SECONDS = 12;
const INTRO_SECONDS = 3;
const SHOT_SPEED = 15;
const COOLDOWN = 0.28;
const WALK = 7;
const PTS_RIGHT = 6;
const PTS_WRONG = -3;
const PTS_ROCK = 1;

interface Q {
  q: string;
  a: string;
  wrong: [string, string];
  why: string;
}

const FORCES: Q[] = [
  { q: "Blast the force that pulls everything down to the ground!", a: "Gravity", wrong: ["Friction", "Magnetism"], why: "Gravity pulls things down towards the ground." },
  { q: "Blast the force that slows a box sliding across the floor!", a: "Friction", wrong: ["Gravity", "Thrust"], why: "Friction acts where surfaces rub, and slows things down." },
  { q: "A parachute slows a falling astronaut. Blast that force!", a: "Air resistance", wrong: ["Magnetism", "Thrust"], why: "Air pushes up against the parachute. That's air resistance." },
  { q: "Rocket engines push the rocket upwards. Blast that force!", a: "Thrust", wrong: ["Friction", "Gravity"], why: "Thrust is the push from the rocket's engines." },
  { q: "A magnet picks up a paper clip. Is that a push or a pull?", a: "Pull", wrong: ["Push", "Twist"], why: "Magnets pull iron and steel towards them." },
  { q: "Kicking a ball away from you is a…", a: "Push", wrong: ["Pull", "Gravity"], why: "Moving something away from you is a push." },
  { q: "Which force keeps the Moon going around the Earth?", a: "Gravity", wrong: ["Friction", "Air resistance"], why: "Earth's gravity pulls on the Moon and keeps it in orbit." },
];

const ENERGY: Q[] = [
  { q: "Blast the energy stored in food and fuel!", a: "Chemical", wrong: ["Sound", "Light"], why: "Food and fuel store chemical energy." },
  { q: "A speeding asteroid has lots of which energy?", a: "Kinetic", wrong: ["Sound", "Chemical"], why: "Anything moving has kinetic (movement) energy." },
  { q: "A solar panel turns light energy into…", a: "Electrical", wrong: ["Sound", "Chemical"], why: "Solar panels change light energy into electrical energy." },
  { q: "Banging a drum makes which energy?", a: "Sound", wrong: ["Light", "Chemical"], why: "Vibrations make sound energy." },
  { q: "The Sun gives us light energy and…", a: "Heat", wrong: ["Sound", "Magnetism"], why: "The Sun sends us light and heat energy." },
  { q: "A stretched rubber band stores which energy?", a: "Elastic", wrong: ["Light", "Sound"], why: "Stretched or squashed things store elastic energy." },
  { q: "Burning rocket fuel turns chemical energy into heat and…", a: "Kinetic", wrong: ["Sound only", "Magnetism"], why: "The burning fuel makes the rocket move: kinetic energy." },
];

interface Wave {
  name: string;
  topic: string;
  say: string;
  every: number; // seconds between asteroids
  fall: number; // units per second
}
const WAVES: Wave[] = [
  { name: "Wave 1", topic: "Forces", say: "Asteroids ahead! Each one carries a force. Blast the ones that answer the question!", every: 0.72, fall: 1.35 },
  { name: "Wave 2", topic: "Energy", say: "Now it's energy. Remember: moving things have kinetic energy, food and fuel store chemical energy.", every: 0.64, fall: 1.5 },
  { name: "Wave 3", topic: "Impostor attack!", say: "The impostor is throwing everything at us! Forces AND energy. Stay sharp, crew!", every: 0.55, fall: 1.7 },
];

// ── Precomputed match plan (same for every player) ────
interface Rock {
  id: number;
  t: number; // spawn time
  x: number;
  vx: number;
  vy: number;
  r: number;
  label: string | null;
  right: boolean;
  qi: number;
  spin: number;
  hue: number;
}
interface Slot {
  q: Q;
  wave: number;
  start: number;
  end: number;
}
interface Plan {
  slots: Slot[];
  rocks: Rock[];
  waveStart: number[];
  end: number;
}

function makePlan(seed: number): Plan {
  const rnd = seededRandom(seed + 404);
  const f = shuffled(FORCES, rnd);
  const e = shuffled(ENERGY, rnd);
  const picks: Q[][] = [f.slice(0, 3), e.slice(0, 3), shuffled([f[3], e[3], f[4]], rnd)];
  const slots: Slot[] = [];
  const rocks: Rock[] = [];
  const waveStart: number[] = [];
  let t = 0;
  let id = 0;
  picks.forEach((qs, wi) => {
    waveStart.push(t);
    t += INTRO_SECONDS;
    qs.forEach((q) => {
      const qi = slots.length;
      slots.push({ q, wave: wi, start: t, end: t + Q_SECONDS });
      const wave = WAVES[wi];
      let k = 0;
      for (let st = t + 0.4; st < t + Q_SECONDS - 2.5; st += wave.every) {
        const roll = rnd();
        // Make sure the right answer turns up early and often.
        const kind = k % 3 === 0 || roll < 0.38 ? "right" : roll < 0.72 ? "wrong" : "rock";
        const label = kind === "right" ? q.a : kind === "wrong" ? q.wrong[Math.floor(rnd() * 2)] : null;
        rocks.push({
          id: id++,
          t: st,
          x: 1.2 + rnd() * (W - 2.4),
          vx: (rnd() - 0.5) * 0.5,
          vy: wave.fall * (0.85 + rnd() * 0.3),
          r: label ? 0.62 : 0.38,
          label,
          right: kind === "right",
          qi,
          spin: (rnd() - 0.5) * 2,
          hue: rnd(),
        });
        k++;
      }
      t += Q_SECONDS;
    });
  });
  return { slots, rocks, waveStart, end: t + 1 };
}

// ── Crew ──────────────────────────────────────────────
interface Crew {
  id: string;
  name: string;
  avatar: string;
  color: string;
  kind: "me" | "bot" | "remote";
  x: number;
  tx: number;
  face: 1 | -1;
  walk: number;
  cool: number;
  pts: number;
  right: number;
  wrongHits: number;
  rocksHit: number;
  // bot brain
  rnd?: () => number;
  smart?: number;
  aim?: number;
  think?: number;
  target?: number | null;
  home?: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  by: string;
  live: boolean; // only shots fired on this screen (or by bots we run) can score
}

interface Boom {
  x: number;
  y: number;
  t: number;
  color: string;
  text?: string;
  good?: boolean;
}

const BOT_COLORS: Record<BotId, string> = { sophia: "#4ade80", timothy: "#38bdf8", emily: "#f5f5f4", matthew: "#ef4444" };
// Each live player keeps their room seat's colour on every screen
const seatColour = (ids: string[], id: string) => Math.max(0, ids.indexOf(id)) % 4;
const PLAYER_COLORS = ["#f97316", "#a855f7", "#facc15", "#ec4899"];
const RIVAL_BOTS: BotId[] = ["sophia", "timothy", "matthew"];
const START_X = [8, 3.5, 12.5, 5.75];

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(clamp(k >= 1 ? v + (255 - v) * (k - 1) : v * k, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawCrew(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: Crew, aimAngle: number) {
  const step = Math.sin(c.walk * 10);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(c.face, 1);
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.strokeStyle = "#111827";
  const body = c.color;
  // legs
  ctx.fillStyle = shade(body, 0.75);
  roundRect(ctx, -0.32 * s, 0.15 * s + Math.max(0, step) * 0.06 * s, 0.26 * s, 0.38 * s, 0.1 * s);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 0.06 * s, 0.15 * s + Math.max(0, -step) * 0.06 * s, 0.26 * s, 0.38 * s, 0.1 * s);
  ctx.fill();
  ctx.stroke();
  // backpack
  ctx.fillStyle = shade(body, 0.8);
  roundRect(ctx, -0.55 * s, -0.42 * s, 0.22 * s, 0.55 * s, 0.08 * s);
  ctx.fill();
  ctx.stroke();
  // body
  const g = ctx.createLinearGradient(-0.4 * s, -0.8 * s, 0.4 * s, 0.4 * s);
  g.addColorStop(0, shade(body, 1.25));
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  roundRect(ctx, -0.4 * s, -0.8 * s, 0.8 * s, 1.05 * s, 0.36 * s);
  ctx.fill();
  ctx.stroke();
  // visor
  const vg = ctx.createLinearGradient(0, -0.62 * s, 0, -0.3 * s);
  vg.addColorStop(0, "#c7f0ff");
  vg.addColorStop(1, "#5ab4d6");
  ctx.fillStyle = vg;
  roundRect(ctx, -0.05 * s, -0.62 * s, 0.55 * s, 0.32 * s, 0.15 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  roundRect(ctx, 0.08 * s, -0.56 * s, 0.2 * s, 0.07 * s, 0.03 * s);
  ctx.fill();
  ctx.restore();
  // blaster, pointing where they aim
  ctx.save();
  ctx.translate(x + 0.18 * s * c.face, y - 0.2 * s);
  ctx.rotate(aimAngle);
  ctx.fillStyle = "#475569";
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = Math.max(1.2, s * 0.05);
  roundRect(ctx, -0.08 * s, -0.12 * s, 0.62 * s, 0.24 * s, 0.08 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.color;
  ctx.fillRect(0.38 * s, -0.06 * s, 0.14 * s, 0.12 * s);
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, hue: number, small: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const base = small ? ["#57534e", "#44403c"] : hue < 0.5 ? ["#a8a29e", "#57534e"] : ["#b08968", "#6f4e37"];
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, base[0]);
  g.addColorStop(1, base[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.86 + ((i * 37) % 7) / 40);
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (const [cx, cy, cr] of [
    [0.3, -0.2, 0.2],
    [-0.25, 0.3, 0.16],
    [0.1, 0.4, 0.1],
  ]) {
    ctx.beginPath();
    ctx.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Component ─────────────────────────────────────────
interface Hud {
  slot: number;
  wave: number;
  intro: boolean;
  qLeft: number;
  pts: number;
  ended: boolean;
}
interface Toast {
  id: number;
  good: boolean;
  text: string;
}

export function AsteroidBlasters({ seed, mode, me, live, playing, reportProgress, reportBots, finish }: GameProps) {
  const plan = useMemo(() => makePlan(seed), [seed]);
  const isLive = mode === "live" && !!live;
  const isHost = !isLive || !!live?.isHost;
  const emily = STEMBOTS.emily;

  const crewRef = useRef<Crew[]>([]);
  const humans = live?.room.players ?? [];
  const seatOf = (id: string) => seatColour(humans.map((p) => p.id), id);
  const humanKey = humans.map((p) => p.id).join(",");
  useMemo(() => {
    const list: Crew[] = [];
    const base = (p: Pick<Crew, "id" | "name" | "avatar" | "color" | "kind">, i: number): Crew => ({
      ...p,
      x: START_X[i],
      tx: START_X[i],
      face: 1,
      walk: 0,
      cool: 0,
      pts: 0,
      right: 0,
      wrongHits: 0,
      rocksHit: 0,
    });
    list.push(base({ id: me.id, name: "You", avatar: me.avatar, color: PLAYER_COLORS[seatOf(me.id)], kind: "me" }, 0));
    (isLive ? humans.filter((p) => p.id !== me.id) : []).forEach((p, i) =>
      list.push(base({ id: p.id, name: p.name, avatar: p.avatar, color: PLAYER_COLORS[seatOf(p.id)], kind: "remote" }, list.length)),
    );
    RIVAL_BOTS.slice(0, Math.max(0, 4 - list.length)).forEach((b, i) => {
      const rnd = seededRandom(seed * 13 + i * 71 + 3);
      const c = base({ id: `bot-${b}`, name: STEMBOTS[b].name, avatar: STEMBOTS[b].avatar, color: BOT_COLORS[b], kind: isHost ? "bot" : "remote" }, list.length);
      Object.assign(c, { home: START_X[list.length], rnd, smart: 0.5 + rnd() * 0.25, aim: 0.7 + rnd() * 0.6, think: 0.5 + rnd() * 0.5, target: null });
      list.push(c);
    });
    crewRef.current = list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, me.id, humanKey, isLive, isHost]);

  const sim = useRef({ t: 0, acc: 0, ended: false, fire: null as null | { x: number; y: number }, keys: { l: false, r: false }, sendAt: 0, hudAt: 0, botAt: 0, shake: 0, hull: 10 });
  const gone = useRef(new Set<number>());
  const shots = useRef<Shot[]>([]);
  const booms = useRef<Boom[]>([]);
  const [hud, setHud] = useState<Hud>({ slot: -1, wave: 0, intro: true, qLeft: 1, pts: 0, ended: false });
  const [toast, setToast] = useState<Toast | null>(null);
  const playingRef = useRef(!!playing);
  playingRef.current = !!playing;
  const geo = useRef({ u: 40, ox: 0, oy: 0 });

  const crewById = (id: string) => crewRef.current.find((c) => c.id === id);

  // ── Hits (local or relayed) ──
  const applyHit = useCallback((rockId: number, by: string, fromRelay: boolean) => {
    if (gone.current.has(rockId)) return;
    const rock = plan.rocks[rockId];
    if (!rock) return;
    gone.current.add(rockId);
    const c = crewById(by);
    const age = sim.current.t - rock.t;
    const x = rock.x + rock.vx * age;
    const y = -0.8 + rock.vy * age;
    const delta = rock.label === null ? PTS_ROCK : rock.right ? PTS_RIGHT : PTS_WRONG;
    if (c) {
      c.pts += delta;
      if (rock.label === null) c.rocksHit++;
      else if (rock.right) c.right++;
      else c.wrongHits++;
    }
    booms.current.push({ x, y, t: 0, color: c?.color ?? "#fff", text: `${delta > 0 ? "+" : ""}${delta}`, good: delta > 0 });
    if (c?.kind === "me") {
      if (rock.label === null) sfx.pop();
      else if (rock.right) sfx.correct();
      else {
        sfx.wrong();
        const slot = plan.slots[rock.qi];
        setToast({ id: Date.now(), good: false, text: `"${rock.label}" isn't it! ${slot.q.why}` });
      }
    } else if (!fromRelay || rock.label) sfx.explode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // ── Live relays ──
  useEffect(() => {
    if (!isLive || !live) return;
    return live.onRelay((from, data) => {
      if (!data || typeof data.k !== "string") return;
      if (data.k === "ab-pos") {
        for (const p of data.c as { id: string; x: number; f: 1 | -1 }[]) {
          if (p.id === me.id) continue;
          const c = crewById(p.id);
          if (c && c.kind === "remote") {
            c.tx = p.x;
            c.face = p.f;
          }
        }
      } else if (data.k === "ab-shot" && data.by !== me.id) {
        const c = crewById(data.by);
        if (c?.kind !== "remote") return;
        shots.current.push({ x: data.x, y: data.y, vx: data.vx, vy: data.vy, life: 1.2, color: c.color, by: c.id, live: false });
      } else if (data.k === "ab-hit" && data.by !== me.id) {
        applyHit(data.id, data.by, true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, live, me.id, applyHit]);

  // ── Input ──
  const fireAt = useCallback((px: number, py: number) => {
    if (!playingRef.current || sim.current.ended) return;
    const { u, ox, oy } = geo.current;
    sim.current.fire = { x: (px - ox) / u, y: (py - oy) / u };
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") sim.current.keys.l = true;
      else if (e.code === "ArrowRight" || e.code === "KeyD") sim.current.keys.r = true;
      else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        const meC = crewRef.current[0];
        if (meC && playingRef.current) sim.current.fire = { x: meC.x, y: 0 };
      } else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") sim.current.keys.l = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") sim.current.keys.r = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const rockPos = (r: Rock, t: number) => {
    const age = t - r.t;
    return { x: clamp(r.x + r.vx * age, r.r, W - r.r), y: -0.8 + r.vy * age };
  };
  const activeSlot = (t: number) => plan.slots.findIndex((s) => t >= s.start && t < s.end);

  const shoot = (c: Crew, tx: number, ty: number, isLocal: boolean) => {
    if (c.cool > 0) return;
    c.cool = COOLDOWN;
    const sx = c.x;
    const sy = DECK - 0.7;
    let dx = tx - sx;
    let dy = Math.min(ty, DECK - 1.2) - sy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (dy > -0.2) {
      dy = -0.2;
      dx = Math.sign(dx) * Math.sqrt(1 - 0.04);
    }
    c.face = dx >= 0 ? 1 : -1;
    const shot: Shot = { x: sx, y: sy, vx: dx * SHOT_SPEED, vy: dy * SHOT_SPEED, life: 1.2, color: c.color, by: c.id, live: true };
    shots.current.push(shot);
    if (c.kind === "me") sfx.laser();
    if (isLive && live && isLocal) live.send({ k: "ab-shot", by: c.id, x: sx, y: sy, vx: shot.vx, vy: shot.vy });
  };

  // ── One fixed step ──
  const stepWorld = () => {
    const s = sim.current;
    s.t += STEP;
    const t = s.t;
    const slotIdx = activeSlot(t);
    for (const c of crewRef.current) {
      c.cool = Math.max(0, c.cool - STEP);
      if (c.kind === "me") {
        if (s.keys.l) c.tx = c.x - 1;
        if (s.keys.r) c.tx = c.x + 1;
        if (s.fire) {
          c.tx = clamp(s.fire.x, 0.6, W - 0.6);
          shoot(c, s.fire.x, s.fire.y, true);
          s.fire = null;
        }
      } else if (c.kind === "bot") {
        botThink(c, t, slotIdx);
      }
      const d = clamp(c.tx, 0.6, W - 0.6) - c.x;
      const mv = clamp(d, -WALK * STEP, WALK * STEP);
      c.x += mv;
      if (Math.abs(mv) > 0.001) {
        c.walk += STEP;
        if (c.kind !== "remote" && Math.abs(d) > 0.3) c.face = d > 0 ? 1 : -1;
      }
    }

    // Shots
    for (const sh of shots.current) {
      sh.x += sh.vx * STEP;
      sh.y += sh.vy * STEP;
      sh.life -= STEP;
      if (!sh.live || sh.life <= 0) continue;
      for (const r of plan.rocks) {
        if (gone.current.has(r.id) || r.t > t || t > plan.slots[r.qi].end) continue;
        const p = rockPos(r, t);
        if ((p.x - sh.x) ** 2 + (p.y - sh.y) ** 2 < (r.r + 0.12) ** 2) {
          sh.life = 0;
          applyHit(r.id, sh.by, false);
          if (isLive && live) live.send({ k: "ab-hit", id: r.id, by: sh.by });
          break;
        }
      }
    }
    shots.current = shots.current.filter((sh) => sh.life > 0 && sh.y > -1);

    // Rocks reaching the hull
    for (const r of plan.rocks) {
      if (gone.current.has(r.id) || r.t > t) continue;
      const p = rockPos(r, t);
      if (t > plan.slots[r.qi].end) {
        // Question over: its answer rocks fizzle out.
        gone.current.add(r.id);
        booms.current.push({ x: p.x, y: p.y, t: 0.3, color: "#94a3b8" });
        continue;
      }
      if (p.y > DECK - 0.6) {
        gone.current.add(r.id);
        booms.current.push({ x: p.x, y: DECK - 0.4, t: 0, color: "#fb923c" });
        if (r.label === null) {
          s.shake = 0.35;
          s.hull = Math.max(0, s.hull - 1);
          sfx.bonk();
        }
      }
    }

    if (!s.ended && t >= plan.end) s.ended = true;
  };

  // Bot crewmates pick a rock, walk under it and fire (with a little wobble).
  function botThink(c: Crew, t: number, slotIdx: number) {
    c.think = (c.think ?? 0) - STEP;
    if (c.think! > 0) return;
    c.think = 0.55 + c.rnd!() * 0.6;
    if (slotIdx < 0) {
      c.tx = clamp(c.x + (c.rnd!() - 0.5) * 3, 1, W - 1);
      return;
    }
    const knows = c.rnd!() < c.smart!;
    let best: Rock | null = null;
    let bestScore = -1;
    for (const r of plan.rocks) {
      if (gone.current.has(r.id) || r.t > t || r.qi !== slotIdx) continue;
      const p = rockPos(r, t);
      if (p.y < 0.6 || p.y > DECK - 1.6) continue;
      let want = r.label === null ? 0.5 : r.right ? (knows ? 2 : 0.6) : knows ? 0 : 0.7;
      want -= Math.abs(p.x - c.x) * 0.08 + Math.abs(p.x - (c.home ?? W / 2)) * 0.05;
      if (want > bestScore) {
        bestScore = want;
        best = r;
      }
    }
    if (!best || bestScore <= 0.1) return;
    const p = rockPos(best, t);
    c.tx = clamp(p.x + (c.rnd!() - 0.5) * 2, 0.8, W - 0.8);
    const lead = Math.hypot(p.x - c.x, DECK - p.y) / SHOT_SPEED;
    shoot(c, p.x + best.vx * lead + (c.rnd!() - 0.5) * c.aim!, p.y + best.vy * lead + (c.rnd!() - 0.5) * c.aim!, true);
  }

  // ── Frame ──
  const canvasRef = useCanvasLoop(({ ctx, w, h, dt }) => {
    const s = sim.current;
    if (playingRef.current && !s.ended) {
      s.acc += dt;
      while (s.acc >= STEP) {
        stepWorld();
        s.acc -= STEP;
      }
    }
    const u = Math.min(w / W, h / H);
    const ox = (w - W * u) / 2;
    const oy = h - H * u;
    geo.current = { u, ox, oy };
    let shx = 0;
    if (s.shake > 0) {
      s.shake -= dt;
      shx = (Math.random() - 0.5) * u * 0.2;
    }
    const X = (x: number) => ox + x * u + shx;
    const Y = (y: number) => oy + y * u;

    // Space
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1026");
    g.addColorStop(0.6, "#1e1b4b");
    g.addColorStop(1, "#312e81");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const neb = ctx.createRadialGradient(w * 0.75, h * 0.25, 10, w * 0.75, h * 0.25, w * 0.45);
    neb.addColorStop(0, "rgba(236,72,153,0.22)");
    neb.addColorStop(1, "rgba(236,72,153,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + layer * 0.25})`;
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137.5 + layer * 61) % 997) / 997;
        const y = (((i * 89.3 + layer * 37) % 991) / 991 + s.t * (0.01 + layer * 0.012)) % 1;
        const sz = 1 + layer;
        ctx.fillRect(sx * w, y * h * 0.85, sz, sz);
      }
    }
    // Planet with rings
    const px = X(2.2);
    const py = Y(2.3);
    const pr = u * 1.3;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, "#c4b5fd");
    pg.addColorStop(1, "#6d28d9");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(253,224,71,0.8)";
    ctx.lineWidth = u * 0.12;
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 1.7, pr * 0.42, -0.25, 0, Math.PI * 2);
    ctx.stroke();

    // Rocks
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const r of plan.rocks) {
      if (gone.current.has(r.id) || r.t > s.t) continue;
      const p = rockPos(r, s.t);
      if (p.y < -1.5 || p.y > H) continue;
      const rot = (s.t - r.t) * r.spin;
      // trail
      ctx.fillStyle = "rgba(251,146,60,0.18)";
      ctx.beginPath();
      ctx.ellipse(X(p.x - r.vx * 0.25), Y(p.y - 0.45), r.r * u * 0.55, r.r * u * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      drawRock(ctx, X(p.x), Y(p.y), r.r * u, rot, r.hue, !r.label);
      if (r.label) {
        ctx.font = `700 ${Math.round(u * 0.3)}px Fredoka, Nunito, system-ui, sans-serif`;
        const tw = ctx.measureText(r.label).width + u * 0.3;
        const bh = u * 0.42;
        ctx.fillStyle = "rgba(15,23,42,0.88)";
        roundRect(ctx, X(p.x) - tw / 2, Y(p.y) - bh / 2, tw, bh, bh / 2);
        ctx.fill();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillText(r.label, X(p.x), Y(p.y) + 1);
      }
    }

    // Shots
    for (const sh of shots.current) {
      ctx.strokeStyle = sh.color;
      ctx.lineWidth = u * 0.1;
      ctx.lineCap = "round";
      ctx.shadowColor = sh.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(X(sh.x), Y(sh.y));
      ctx.lineTo(X(sh.x - sh.vx * 0.035), Y(sh.y - sh.vy * 0.035));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Explosions and points
    booms.current = booms.current.filter((b) => (b.t += dt) < 0.9);
    for (const b of booms.current) {
      const k = b.t / 0.9;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = u * 0.08;
      ctx.beginPath();
      ctx.arc(X(b.x), Y(b.y), u * (0.3 + k * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? "#fde047" : b.color;
        ctx.fillRect(X(b.x + Math.cos(a) * k * 1.2) - 3, Y(b.y + Math.sin(a) * k * 1.2) - 3, 6, 6);
      }
      if (b.text) {
        ctx.font = `800 ${Math.round(u * 0.42)}px Fredoka, Nunito, system-ui, sans-serif`;
        ctx.fillStyle = b.good ? "#4ade80" : "#f87171";
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 3;
        ctx.strokeText(b.text, X(b.x), Y(b.y - k * 1.2));
        ctx.fillText(b.text, X(b.x), Y(b.y - k * 1.2));
      }
      ctx.globalAlpha = 1;
    }

    // Ship deck
    const deckY = Y(DECK + 0.55);
    const dg = ctx.createLinearGradient(0, deckY, 0, h);
    dg.addColorStop(0, "#94a3b8");
    dg.addColorStop(0.15, "#64748b");
    dg.addColorStop(1, "#334155");
    ctx.fillStyle = dg;
    ctx.fillRect(0, deckY, w, h - deckY);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, deckY, w, 4);
    ctx.strokeStyle = "rgba(15,23,42,0.4)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= W; i++) {
      ctx.beginPath();
      ctx.moveTo(X(i), deckY + 4);
      ctx.lineTo(X(i), h);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const on = Math.floor(s.t * 2 + i) % 3 === 0;
      ctx.fillStyle = on ? "#22d3ee" : "#0e7490";
      ctx.fillRect(X(1 + i * 2) - 4, deckY + u * 0.5, 8, 5);
    }
    // Hull bar
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    roundRect(ctx, X(W) - u * 3.2, deckY + u * 0.28, u * 2.9, u * 0.36, u * 0.18);
    ctx.fill();
    ctx.fillStyle = s.hull > 4 ? "#4ade80" : "#f87171";
    roundRect(ctx, X(W) - u * 3.15, deckY + u * 0.32, (u * 2.8 * s.hull) / 10, u * 0.28, u * 0.14);
    ctx.fill();

    // Crew
    const crew = [...crewRef.current].sort((a, b) => (a.kind === "me" ? 1 : b.kind === "me" ? -1 : 0));
    const placedTags: { x0: number; x1: number; row: number }[] = [];
    for (const c of crew) {
      if (c.kind === "remote") {
        const d = c.tx - c.x;
        c.x += clamp(d, -WALK * dt, WALK * dt);
        if (Math.abs(d) > 0.01) c.walk += dt;
      }
      const sz = u * (c.kind === "me" ? 1.05 : 0.92);
      const cx = X(c.x);
      const cy = Y(DECK) + sz * 0.05;
      const last = [...shots.current].reverse().find((sh) => sh.by === c.id);
      const ang = last ? Math.atan2(last.vy, last.vx * c.face) : -Math.PI / 2.4;
      drawCrew(ctx, cx, cy, sz, c, c.face === 1 ? ang : -Math.PI - ang + Math.PI);
      // name tag
      const label = c.kind === "me" ? "YOU" : c.name;
      ctx.font = `700 ${Math.round(u * 0.3)}px Fredoka, Nunito, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const ah = u * 0.42;
      const bw = tw + ah + 12;
      const bx = cx - bw / 2;
      let row = 0;
      while (placedTags.some((p) => p.row === row && bx < p.x1 + 4 && bx + bw > p.x0 - 4)) row++;
      placedTags.push({ x0: bx, x1: bx + bw, row });
      const by = cy - sz * 1.25 - ah - row * (ah + 7);
      ctx.fillStyle = c.kind === "me" ? "#facc15" : "rgba(255,255,255,0.92)";
      roundRect(ctx, bx, by, bw, ah + 4, (ah + 4) / 2);
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const img = c.avatar ? loadImage(c.avatar) : null;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, bx + 3, by + 2, ah, ah);
      ctx.fillStyle = "#111827";
      ctx.textAlign = "left";
      ctx.fillText(label, bx + ah + 7, by + ah / 2 + 2.5);
      ctx.textAlign = "center";
    }

    // ── HUD, relays and progress ──
    const now = performance.now();
    const meC = crewRef.current[0];
    const myPts = clamp(meC?.pts ?? 0, 0, 100);
    if (now - s.hudAt > 120) {
      s.hudAt = now;
      const si = activeSlot(s.t);
      const waveIdx = plan.waveStart.reduce((acc, ws, i) => (s.t >= ws ? i : acc), 0);
      const next: Hud = {
        slot: si,
        wave: waveIdx,
        intro: si < 0 && !s.ended,
        qLeft: si >= 0 ? clamp((plan.slots[si].end - s.t) / Q_SECONDS, 0, 1) : 1,
        pts: myPts,
        ended: s.ended,
      };
      setHud((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      if (playingRef.current) reportProgress(myPts, clamp(s.t / plan.end, 0, 1));
    }
    if (isLive && live && playingRef.current && now - s.sendAt > 120) {
      s.sendAt = now;
      const mine = crewRef.current.filter((c) => c.kind === "me" || c.kind === "bot");
      live.send({ k: "ab-pos", c: mine.map((c) => ({ id: c.id, x: +c.x.toFixed(2), f: c.face })) });
    }
    if (reportBots && now - s.botAt > 500) {
      s.botAt = now;
      const bots: RivalInfo[] = crewRef.current
        .filter((c) => c.id.startsWith("bot-"))
        .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, score: clamp(c.pts, 0, 100), progress: clamp(s.t / plan.end, 0, 1), done: s.ended, isBot: true }));
      reportBots(bots);
    }
  });

  // Finish
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!hud.ended || finishedRef.current) return;
    finishedRef.current = true;
    const meC = crewRef.current[0];
    const t = setTimeout(
      () =>
        finish(clamp(meC.pts, 0, 100), [
          { label: "Right answers blasted", value: `${meC.right}` },
          { label: "Wrong answers hit", value: `${meC.wrongHits}` },
          { label: "Space rocks cleared", value: `${meC.rocksHit}` },
        ]),
      2200,
    );
    return () => clearTimeout(t);
  }, [hud.ended, finish]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  const slot = hud.slot >= 0 ? plan.slots[hud.slot] : null;
  const wave = WAVES[hud.wave];

  return (
    <div
      data-game="asteroid-blasters"
      className="absolute inset-0 overflow-hidden select-none touch-none cursor-crosshair"
      onPointerDown={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        fireAt(e.clientX - r.left, e.clientY - r.top);
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Question */}
      <div className="absolute left-2 right-2 top-2 flex items-start gap-2 pointer-events-none">
        <div className={cn("flex-1 min-w-0 rounded-2xl border-[3px] px-3 py-2 shadow-xl", slot ? "bg-[#1e1b2e]/92 border-[#facc15]" : "bg-[#1e1b2e]/80 border-white/30")}>
          <p className="game-pixel text-[9px] sm:text-[10px] text-yellow-300 flex items-center gap-1.5">
            <Crosshair size={12} strokeWidth={3} />
            {wave.name.toUpperCase()} · {wave.topic.toUpperCase()}
            {slot && ` · QUESTION ${(hud.slot % 3) + 1}/3`}
          </p>
          <p key={hud.slot} className="game-fun font-bold text-white text-[15px] sm:text-lg leading-snug game-bounce-in">
            {slot ? slot.q.q : hud.ended ? "Ship safe! Great blasting, crew." : "Get ready…"}
          </p>
          {slot && (
            <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-yellow-400 transition-[width] duration-150" style={{ width: `${hud.qLeft * 100}%` }} />
            </div>
          )}
        </div>
        <div className="bg-slate-900/85 text-white rounded-xl game-panel px-3 py-1.5 text-center">
          <p className="game-pixel text-[8px] text-amber-300 leading-none">PTS</p>
          <p className="game-pixel text-lg text-yellow-300 leading-tight">{hud.pts}</p>
        </div>
      </div>

      {/* Emily introduces each wave */}
      {hud.intro && !hud.ended && (
        <div key={hud.wave} className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-end gap-3 max-w-[min(92%,520px)] game-bounce-in">
            <img src={emily.avatar} alt="Emily" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow game-float" />
            <div className="bg-white rounded-2xl game-panel px-4 py-3">
              <p className="game-pixel text-[10px] text-violet-600">
                EMILY · {wave.name.toUpperCase()}: {wave.topic.toUpperCase()}
              </p>
              <p className="text-[13px] sm:text-sm font-semibold text-slate-800 leading-snug mt-0.5">{wave.say}</p>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.id} className="absolute left-1/2 -translate-x-1/2 bottom-[16%] w-[min(90%,440px)] pointer-events-none game-shake">
          <div className="bg-rose-50 text-rose-900 rounded-2xl game-panel px-3 py-2 flex gap-2 items-center">
            <img src={emily.avatar} alt="" className="w-9 h-9 object-contain shrink-0" />
            <p className="text-[12px] sm:text-[13px] font-semibold leading-snug">{toast.text}</p>
          </div>
        </div>
      )}

      {playing && hud.slot === 0 && hud.pts === 0 && (
        <div className="absolute inset-x-0 bottom-[17%] flex justify-center pointer-events-none">
          <div className="bg-yellow-400 text-slate-900 game-btn px-4 py-2 text-sm sm:text-base flex items-center gap-2">
            <Zap size={16} /> Tap an asteroid to blast it. Arrows / A D to walk, SPACE to fire up.
          </div>
        </div>
      )}

      {hud.ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-indigo-950/40 pointer-events-none">
          <div className="bg-white rounded-3xl game-panel px-6 py-4 text-center game-bounce-in max-w-sm mx-4">
            <p className="game-pixel text-sm text-violet-600 flex items-center justify-center gap-1.5">
              <Shield size={16} /> SHIP SAFE!
            </p>
            <p className="game-fun font-bold text-slate-900 text-lg mt-1">The impostor's asteroids are gone. Forces and energy saved the day!</p>
          </div>
        </div>
      )}
    </div>
  );
}
