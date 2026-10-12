// Drippy's Water Cycle Dash — Minecraft Masterminds science game.
// A flappy-style flight through a blocky Minecraft world, following one water
// drop around the water cycle: ocean (evaporation), forest (transpiration),
// sky (condensation), snowy peaks (precipitation) and rivers (collection).
// Each stage ends at a gate with three lanes: fly through the right answer.
// Three other drops (STEMbots, or live players) fly alongside you.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cloud, CloudRain, Droplet, Leaf, Sun, Waves } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { cn } from "../components/ui/utils";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import { clamp, fitText, loadImage, roundRect, shuffled, useCanvasLoop } from "./kit/canvas";
import type { BotId, GameProps, RivalInfo } from "./kit/types";

// ── World constants (units are blocks) ────────────────
const ROWS = 14; // visible height
const GROUND = 12; // top of the ground strip
const SPEED = 3.3; // blocks per second
const SLOW = 0.5; // speed near a question gate
const GRAVITY = 19;
const FLAP_V = -6.9;
const MAX_FALL = 10;
const R = 0.36; // drop hit radius
const STEP = 1 / 60;
const SLOT_GAP = 1.7; // how far behind each other drop flies
const OBST_PER_ZONE = 6;
const OBST_SPACING = 7;
const LEAD_IN = 13;
const PLAYER_AT = 0.36; // where your drop sits across the screen
const BANDS = [2.5, 6.5, 10.5]; // centres of the three gate lanes
const DIVIDERS = [0, 4, 8]; // gate rows that are solid

type ZoneKey = "evaporation" | "transpiration" | "condensation" | "precipitation" | "collection";
type Tile = "grass" | "dirt" | "stone" | "sand" | "water" | "leaves" | "log" | "snowstone" | "snow" | "cloud" | "raincloud" | "cobble" | "sandstone";

interface Zone {
  key: ZoneKey;
  name: string;
  /** What Sophia says as you enter. */
  say: string;
  /** Drippy's form in this stage. */
  form: "drop" | "vapour";
  sky: [string, string];
  far: string;
  farTop: string;
  ground: [Tile, Tile];
  sun: boolean;
}

const ZONES: Zone[] = [
  {
    key: "evaporation",
    name: "Evaporation",
    say: "The Sun is heating the ocean. Its heat energy lifts us up out of the water!",
    form: "drop",
    sky: ["#7ec8f8", "#c9ecff"],
    far: "#9fd3b8",
    farTop: "#b7e3c9",
    ground: ["water", "water"],
    sun: true,
  },
  {
    key: "transpiration",
    name: "Transpiration",
    say: "We're water vapour now! Plants breathe out vapour from their leaves too.",
    form: "vapour",
    sky: ["#86cdf5", "#d4f1ff"],
    far: "#7fc28f",
    farTop: "#98d6a5",
    ground: ["grass", "dirt"],
    sun: true,
  },
  {
    key: "condensation",
    name: "Condensation",
    say: "Brrr, it's cold up here. Vapour cools into tiny droplets and makes clouds.",
    form: "vapour",
    sky: ["#4f8fd6", "#a9d3f5"],
    far: "#dfeefa",
    farTop: "#ffffff",
    ground: ["cloud", "cloud"],
    sun: false,
  },
  {
    key: "precipitation",
    name: "Precipitation",
    say: "The droplets got heavy. We fall as rain, or as snow on the cold peaks!",
    form: "drop",
    sky: ["#7d93ad", "#c3d1df"],
    far: "#9aa6b4",
    farTop: "#f1f5f9",
    ground: ["snowstone", "stone"],
    sun: false,
  },
  {
    key: "collection",
    name: "Collection",
    say: "Splash! Water collects in rivers, lakes, oceans and underground.",
    form: "drop",
    sky: ["#7ec8f8", "#d6f1ff"],
    far: "#8fcf9c",
    farTop: "#a8ddb2",
    ground: ["water", "dirt"],
    sun: true,
  },
];

const ZONE_ICONS = [Sun, Leaf, Cloud, CloudRain, Waves];

interface Question {
  q: string;
  a: [string, string, string]; // first is right
  why: string;
}

const QUESTIONS: Record<ZoneKey, Question[]> = {
  evaporation: [
    { q: "The Sun heats the ocean. What does the liquid water turn into?", a: ["Water vapour", "Ice", "Salt"], why: "Heat turns liquid water into a gas called water vapour. That's evaporation!" },
    { q: "What gives water the energy to evaporate?", a: ["Heat from the Sun", "The Moon", "Rocks"], why: "The Sun's heat energy makes water evaporate." },
    { q: "Evaporation changes water from a…", a: ["Liquid to a gas", "Gas to a liquid", "Solid to a liquid"], why: "Evaporation: liquid water becomes a gas (water vapour)." },
  ],
  transpiration: [
    { q: "Plants give off water vapour from their leaves. This is called…", a: ["Transpiration", "Condensation", "Collection"], why: "Transpiration is when plants 'breathe out' water vapour through their leaves." },
    { q: "Which part of a plant lets water vapour out?", a: ["The leaves", "The roots", "The seeds"], why: "Tiny holes in the leaves let water vapour escape into the air." },
    { q: "Plants drink water through their roots and give it off as…", a: ["Water vapour", "Snow", "Sand"], why: "Roots take water in, and leaves give it off as vapour. That's transpiration." },
  ],
  condensation: [
    { q: "High up, the air is cold. What happens to water vapour there?", a: ["It cools into droplets", "It gets hotter", "It turns to sand"], why: "Cold air cools vapour into tiny liquid droplets. That's condensation!" },
    { q: "Clouds are made of…", a: ["Tiny water droplets", "Cotton wool", "Smoke"], why: "Billions of tiny droplets condense together to make a cloud." },
    { q: "Condensation changes water from a…", a: ["Gas to a liquid", "Liquid to a gas", "Liquid to a solid"], why: "Condensation: water vapour (a gas) becomes liquid droplets." },
  ],
  precipitation: [
    { q: "Cloud droplets join up and get heavy. Then they fall as…", a: ["Precipitation", "Evaporation", "Transpiration"], why: "Rain, snow, sleet and hail falling from clouds is precipitation." },
    { q: "On cold, snowy mountain peaks, water falls as…", a: ["Snow", "Steam", "Water vapour"], why: "When it's cold, precipitation falls as snow: frozen water crystals." },
    { q: "Which one is NOT precipitation?", a: ["Water vapour", "Hail", "Sleet"], why: "Rain, snow, sleet and hail fall from clouds. Water vapour is a gas in the air." },
  ],
  collection: [
    { q: "Rain soaks into the soil and is stored underground. This is called…", a: ["Groundwater", "Cloud water", "Vapour"], why: "Water stored in the soil and rocks underground is groundwater." },
    { q: "After it rains, where does the water collect?", a: ["Rivers, lakes, oceans", "Inside clouds", "On the Sun"], why: "Water collects in rivers, lakes, oceans and underground." },
    { q: "What happens to the collected water next?", a: ["It evaporates again", "It vanishes forever", "It turns into rock"], why: "The cycle never stops! The Sun heats the water and it evaporates again." },
  ],
};

// ── Block textures (16×16, made once) ─────────────────
const PALETTES: Record<Tile, string[]> = {
  grass: ["#6cc24a", "#5fae3e", "#7bd157", "#58a636"],
  dirt: ["#8a5a32", "#7a4e2a", "#96643a", "#6b4423"],
  stone: ["#8e8e8e", "#7f7f7f", "#9a9a9a", "#747474"],
  cobble: ["#7a7a7a", "#6a6a6a", "#8d8d8d", "#5c5c5c"],
  sand: ["#ecd590", "#dfc67c", "#f3df9f", "#d8bf73"],
  sandstone: ["#d9bf78", "#cdb26a", "#e3ca86", "#c6a95f"],
  water: ["#3f78e6", "#3a6fd8", "#4a84ef", "#3568cc"],
  leaves: ["#4f9b2f", "#5aab36", "#428a28", "#67b83f"],
  log: ["#6b4a2b", "#5a3d22", "#7a5733", "#4f351d"],
  snow: ["#ffffff", "#eef4fb", "#f6f9fd", "#e3ecf6"],
  snowstone: ["#8e8e8e", "#7f7f7f", "#9a9a9a", "#747474"],
  cloud: ["#ffffff", "#f6f9fc", "#fbfdff", "#eef3f8"],
  raincloud: ["#9aa5b1", "#8c97a3", "#a7b1bc", "#828d99"],
};
const TOP_COLOR: Record<Tile, string> = {
  grass: "#86d860",
  dirt: "#a06c40",
  stone: "#a8a8a8",
  cobble: "#959595",
  sand: "#f7e6aa",
  sandstone: "#e8d08f",
  water: "#6c9df4",
  leaves: "#6cbf45",
  log: "#8a6740",
  snow: "#ffffff",
  snowstone: "#ffffff",
  cloud: "#ffffff",
  raincloud: "#b4bec8",
};
const SIDE_COLOR: Record<Tile, string> = {
  grass: "#5b3c20",
  dirt: "#5b3c20",
  stone: "#5f5f5f",
  cobble: "#555555",
  sand: "#c2a75e",
  sandstone: "#b0954f",
  water: "#2a56b0",
  leaves: "#356f20",
  log: "#47301b",
  snow: "#c9d6e4",
  snowstone: "#5f5f5f",
  cloud: "#d3dde8",
  raincloud: "#6f7a86",
};

const texCache = new Map<Tile, HTMLCanvasElement>();
function tex(kind: Tile): HTMLCanvasElement {
  const hit = texCache.get(kind);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d")!;
  const rnd = seededRandom(kind.length * 977 + kind.charCodeAt(0) * 31);
  const pal = PALETTES[kind];
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const noise = (p: string[], y0 = 0, y1 = 16) => {
    for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) px(x, y, p[Math.floor(rnd() * p.length)]);
  };
  if (kind === "grass") {
    noise(PALETTES.dirt);
    for (let x = 0; x < 16; x++) {
      const d = 3 + Math.floor(rnd() * 3);
      for (let y = 0; y < d; y++) px(x, y, pal[Math.floor(rnd() * pal.length)]);
    }
  } else if (kind === "snowstone") {
    noise(PALETTES.stone);
    for (let x = 0; x < 16; x++) {
      const d = 3 + Math.floor(rnd() * 3);
      for (let y = 0; y < d; y++) px(x, y, PALETTES.snow[Math.floor(rnd() * 4)]);
    }
  } else if (kind === "log") {
    for (let x = 0; x < 16; x++) {
      const base = x % 4 === 0 ? pal[3] : pal[Math.floor(rnd() * 3)];
      for (let y = 0; y < 16; y++) px(x, y, rnd() < 0.15 ? pal[3] : base);
    }
  } else if (kind === "water") {
    noise(pal);
    for (const row of [3, 10]) for (let x = 0; x < 16; x++) if ((x + row) % 5 < 3) px(x, row, "#7aa8f6");
  } else if (kind === "leaves") {
    noise(pal);
    for (let i = 0; i < 18; i++) px(Math.floor(rnd() * 16), Math.floor(rnd() * 16), "#2f6b1c");
  } else if (kind === "cobble") {
    noise(pal);
    g.fillStyle = "#4d4d4d";
    for (let i = 0; i < 5; i++) g.fillRect(Math.floor(rnd() * 14), Math.floor(rnd() * 14), 3, 1);
  } else {
    noise(pal);
  }
  texCache.set(kind, c);
  return c;
}

// ── World generation ──────────────────────────────────
interface Cell {
  x: number;
  y: number;
  t: Tile;
}
interface Obstacle {
  x: number;
  zone: number;
  gapTop: number;
  gapH: number;
  cells: Cell[];
  solid: Set<string>;
}
interface Gate {
  x: number;
  zone: number;
  q: string;
  options: string[];
  correct: number;
  why: string;
}
interface Pickup {
  id: number;
  x: number;
  y: number;
}
interface World {
  obstacles: Obstacle[];
  gates: Gate[];
  pickups: Pickup[];
  zoneStart: number[];
  endX: number;
}

function obstacleCells(zone: number, x0: number, gapTop: number, gapH: number, rnd: () => number): Cell[] {
  const cells: Cell[] = [];
  const add = (x: number, y: number, t: Tile) => {
    if (y >= 0 && y < GROUND) cells.push({ x, y, t });
  };
  const bot = gapTop + gapH; // first solid row of the bottom part
  const z = ZONES[zone].key;
  if (z === "evaporation") {
    for (let y = bot; y < GROUND; y++) for (let x = x0; x < x0 + 2; x++) add(x, y, y === bot ? "sand" : y < bot + 3 ? "sandstone" : "stone");
    for (let y = 0; y < gapTop; y++) for (let x = x0 - (y === gapTop - 1 ? 0 : 1); x < x0 + 2 + (y < gapTop - 1 && rnd() < 0.5 ? 1 : 0); x++) add(x, y, "cloud");
  } else if (z === "transpiration") {
    const canopy = Math.min(2, GROUND - bot);
    for (let y = bot; y < bot + canopy; y++) for (let x = x0 - 1; x < x0 + 2; x++) add(x, y, "leaves");
    for (let y = bot + canopy; y < GROUND; y++) add(x0, y, "log");
    for (let y = 0; y < gapTop; y++) {
      const wide = y < gapTop - 1;
      for (let x = x0 - (wide ? 1 : 0); x < x0 + (wide ? 2 : 1); x++) add(x, y, "leaves");
    }
  } else if (z === "condensation") {
    for (let y = bot; y < GROUND; y++) for (let x = x0 - (y > bot ? 1 : 0); x < x0 + 2; x++) add(x, y, "cloud");
    for (let y = 0; y < gapTop; y++) for (let x = x0 - (y < gapTop - 1 ? 1 : 0); x < x0 + 2; x++) add(x, y, "cloud");
  } else if (z === "precipitation") {
    for (let y = bot; y < GROUND; y++) {
      for (let x = x0; x < x0 + 2; x++) add(x, y, y === bot ? "snowstone" : "stone");
      if (y >= bot + 2) add(x0 - 1, y, y === bot + 2 ? "snowstone" : "stone");
    }
    for (let y = 0; y < gapTop; y++) for (let x = x0 - 1; x < x0 + 2; x++) if (y < gapTop - 1 || x !== x0 - 1) add(x, y, "raincloud");
  } else {
    for (let y = bot; y < GROUND; y++) for (let x = x0; x < x0 + 2; x++) add(x, y, y === bot ? "grass" : "dirt");
    for (let y = 0; y < gapTop; y++) for (let x = x0; x < x0 + 2; x++) add(x, y, y === gapTop - 1 && x === x0 + 1 && rnd() < 0.5 ? "cobble" : "stone");
  }
  return cells;
}

function buildWorld(seed: number): World {
  const rnd = seededRandom(seed + 101);
  const obstacles: Obstacle[] = [];
  const gates: Gate[] = [];
  const pickups: Pickup[] = [];
  const zoneStart: number[] = [];
  let x = LEAD_IN;
  let pid = 0;
  let lastTop = 4;
  for (let z = 0; z < ZONES.length; z++) {
    zoneStart.push(z === 0 ? 0 : x - 6);
    const gapH = z < 3 ? 5 : 4;
    for (let i = 0; i < OBST_PER_ZONE; i++) {
      const lo = Math.max(1, lastTop - 3);
      const hi = Math.min(GROUND - gapH - 1, lastTop + 3);
      const gapTop = lo + Math.floor(rnd() * (hi - lo + 1));
      const cells = obstacleCells(z, x, gapTop, gapH, rnd);
      obstacles.push({ x, zone: z, gapTop, gapH, cells, solid: new Set(cells.map((c) => `${c.x},${c.y}`)) });
      pickups.push({ id: pid++, x: x + 1, y: gapTop + gapH / 2 });
      // A bonus droplet between this gap and the next.
      if (i < OBST_PER_ZONE - 1) pickups.push({ id: pid++, x: x + 1 + OBST_SPACING / 2, y: clamp(gapTop + gapH / 2 + (rnd() - 0.5) * 3, 2, GROUND - 2) });
      lastTop = gapTop;
      x += OBST_SPACING;
    }
    // The question gate for this stage.
    const gx = x + 2;
    const bank = QUESTIONS[ZONES[z].key];
    const q = bank[Math.floor(rnd() * bank.length)];
    const order = shuffled([0, 1, 2], rnd);
    gates.push({ x: gx, zone: z, q: q.q, options: order.map((k) => q.a[k]), correct: order.indexOf(0), why: q.why });
    lastTop = 4;
    x = gx + 12;
  }
  return { obstacles, gates, pickups, zoneStart, endX: x };
}

const zoneAt = (w: World, x: number) => {
  let z = 0;
  for (let i = 0; i < w.zoneStart.length; i++) if (x >= w.zoneStart[i]) z = i;
  return z;
};

// ── Flyers ────────────────────────────────────────────
interface Flyer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  slot: number;
  kind: "me" | "bot" | "remote";
  y: number;
  vy: number;
  started: boolean;
  stun: number;
  safe: number;
  inv: number;
  crashes: number;
  got: Set<number>;
  gates: (boolean | null)[];
  // Bot brain
  skill?: number;
  smart?: number;
  rnd?: () => number;
  aimOff?: Map<number, number>;
  choice?: Map<number, number>;
  // Remote players: last relayed state
  seenAt?: number;
  remoteForm?: string;
}

const BOT_COLORS: Record<BotId, string> = { sophia: "#5cc23a", timothy: "#22b8e6", emily: "#f472b6", matthew: "#ef4444" };
// Each live player keeps their room seat's colour on every screen
const seatColour = (ids: string[], id: string) => Math.max(0, ids.indexOf(id)) % 4;
const PLAYER_COLORS = ["#3b82f6", "#f59e0b", "#a855f7", "#10b981"];
const RIVAL_BOTS: BotId[] = ["timothy", "emily", "matthew"];

function scoreOf(f: Flyer, total: number, progress: number) {
  const right = f.gates.filter((g) => g === true).length;
  const dropPts = Math.min(20, Math.round((f.got.size / Math.max(1, total * 0.75)) * 20));
  // Flying carefully earns up to 20, a little at a time; each splash costs 5.
  const crashPts = Math.max(0, Math.round(20 * progress) - 5 * f.crashes);
  return Math.min(100, right * 12 + dropPts + crashPts);
}

function newFlyer(p: Partial<Flyer> & Pick<Flyer, "id" | "name" | "avatar" | "color" | "slot" | "kind">, gates: number): Flyer {
  return { y: 6, vy: 0, started: false, stun: 0, safe: 6, inv: 0, crashes: 0, got: new Set(), gates: Array(gates).fill(null), ...p };
}

// ── Drawing helpers ───────────────────────────────────
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(clamp(k >= 1 ? v + (255 - v) * (k - 1) : v * k, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, form: string, tilt: number, alpha = 1, blink = false) {
  ctx.save();
  ctx.globalAlpha = alpha * (blink ? 0.45 : 1);
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = "#1e293b";
  if (form === "vapour") {
    ctx.fillStyle = "rgba(240,248,255,0.92)";
    for (const [dx, dy, rr] of [
      [-0.55, 0.15, 0.62],
      [0.5, 0.2, 0.6],
      [0, -0.25, 0.78],
    ]) {
      ctx.beginPath();
      ctx.arc(dx * r, dy * r, rr * r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    for (const [dx, dy, rr] of [
      [-0.55, 0.15, 0.62],
      [0.5, 0.2, 0.6],
      [0, -0.25, 0.78],
    ]) ctx.arc(dx * r, dy * r, rr * r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.arc(0, 0.1 * r, 0.7 * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * (blink ? 0.45 : 1);
  } else {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, shade(color, 1.45));
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -1.55 * r);
    ctx.bezierCurveTo(0.25 * r, -1.0 * r, r, -0.45 * r, r, 0.2 * r);
    ctx.arc(0, 0.2 * r, r, 0, Math.PI, false);
    ctx.bezierCurveTo(-r, -0.45 * r, -0.25 * r, -1.0 * r, 0, -1.55 * r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(-0.45 * r, -0.2 * r, 0.16 * r, 0.32 * r, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Face
  const ey = 0.12 * r;
  for (const ex of [-0.3 * r, 0.32 * r]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex, ey, 0.2 * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(ex + 0.05 * r, ey + 0.03 * r, 0.11 * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.arc(0.02 * r, 0.42 * r, 0.22 * r, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// ── Component ─────────────────────────────────────────
interface Hud {
  zone: number;
  pts: number;
  drops: number;
  crashes: number;
  started: boolean;
  gate: number | null;
  ended: boolean;
}

interface Toast {
  id: number;
  good: boolean;
  title: string;
  text: string;
}

export function DropDash({ seed, mode, me, live, playing, reportProgress, reportBots, finish }: GameProps) {
  const world = useMemo(() => buildWorld(seed), [seed]);
  const isLive = mode === "live" && !!live;
  const sophia = STEMBOTS.sophia;

  // Everyone in the race. Humans in a live room first, then bots to fill four seats.
  const flyersRef = useRef<Flyer[]>([]);
  const humans = live?.room.players ?? [];
  const seatOf = (id: string) => seatColour(humans.map((p) => p.id), id);
  const humanKey = humans.map((p) => p.id).join(",");
  useMemo(() => {
    const list: Flyer[] = [];
    const gates = world.gates.length;
    list.push(newFlyer({ id: me.id, name: "You", avatar: me.avatar, color: PLAYER_COLORS[seatOf(me.id)], slot: 0, kind: "me" }, gates));
    const others = isLive ? humans.filter((p) => p.id !== me.id) : [];
    others.forEach((p, i) =>
      list.push(newFlyer({ id: p.id, name: p.name, avatar: p.avatar, color: PLAYER_COLORS[seatOf(p.id)], slot: i + 1, kind: "remote" }, gates)),
    );
    const botCount = Math.max(0, 4 - list.length);
    RIVAL_BOTS.slice(0, botCount).forEach((b, i) => {
      const rnd = seededRandom(seed * 7 + i * 131 + 5);
      list.push(
        newFlyer(
          {
            id: `bot-${b}`,
            name: STEMBOTS[b].name,
            avatar: STEMBOTS[b].avatar,
            color: BOT_COLORS[b],
            slot: list.length,
            kind: "bot",
            skill: 0.55 + rnd() * 0.35,
            smart: 0.55 + rnd() * 0.3,
            rnd,
            aimOff: new Map(),
            choice: new Map(),
          },
          gates,
        ),
      );
    });
    flyersRef.current = list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seed, me.id, humanKey, isLive]);

  const sim = useRef({ scroll: 0, t: 0, acc: 0, flap: false, ended: false, endAt: 0, sendAt: 0, hudAt: 0, botAt: 0, shake: 0 });
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[]>([]);
  const [hud, setHud] = useState<Hud>({ zone: 0, pts: 0, drops: 0, crashes: 0, started: false, gate: null, ended: false });
  const [toast, setToast] = useState<Toast | null>(null);
  const [say, setSay] = useState<{ zone: number; id: number } | null>({ zone: 0, id: 0 });
  const totalPickups = world.pickups.length;
  const playingRef = useRef(!!playing);
  playingRef.current = !!playing;

  // Sophia introduces each stage.
  useEffect(() => {
    setSay({ zone: hud.zone, id: Date.now() });
    const t = setTimeout(() => setSay(null), 5200);
    return () => clearTimeout(t);
  }, [hud.zone]);

  // Live: other players' drops.
  useEffect(() => {
    if (!isLive || !live) return;
    return live.onRelay((from, data) => {
      if (!data || data.k !== "dd" || from === me.id) return;
      const f = flyersRef.current.find((x) => x.id === from);
      if (!f) return;
      f.y = data.y;
      f.vy = data.vy;
      f.remoteForm = data.f;
      f.crashes = data.c ?? f.crashes;
      f.stun = data.s ? 0.2 : 0;
      f.seenAt = performance.now();
      f.started = true;
    });
  }, [isLive, live, me.id]);

  const flap = useCallback(() => {
    if (!playingRef.current || sim.current.ended) return;
    sim.current.flap = true;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  const formFor = useCallback((x: number) => ZONES[zoneAt(world, x)].form, [world]);

  // ── Simulation (fixed step, so bots move the same for everyone) ──
  const crash = (f: Flyer, fx: number) => {
    f.crashes += 1;
    f.stun = 0.6;
    f.inv = 1.8;
    f.vy = 0;
    const next = world.obstacles.find((o) => o.x + 2 > fx);
    f.safe = next ? next.gapTop + next.gapH / 2 : 6;
    for (let i = 0; i < 14; i++)
      particles.current.push({ x: fx, y: f.y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 6, life: 0.7, color: f.color, size: 0.12 + Math.random() * 0.1 });
    if (f.kind === "me") {
      sfx.bonk();
      sim.current.shake = 0.3;
    }
  };

  const stepWorld = () => {
    const s = sim.current;
    s.t += STEP;
    const lastSlot = Math.max(...flyersRef.current.map((f) => f.slot));
    const slowGate = world.gates.some((g) => s.scroll > g.x - 17 && s.scroll < g.x + 2 + lastSlot * SLOT_GAP);
    s.scroll += SPEED * (slowGate ? SLOW : 1) * STEP;

    for (const f of flyersRef.current) {
      if (f.kind === "remote") {
        // Predict between relays.
        if (!f.stun) {
          f.vy = Math.min(MAX_FALL, f.vy + GRAVITY * STEP);
          f.y = clamp(f.y + f.vy * STEP, 0.4, GROUND - 0.4);
        }
        continue;
      }
      const fx = s.scroll - f.slot * SLOT_GAP;
      if (fx < 0) continue;
      let wantFlap = false;
      if (f.kind === "me") {
        wantFlap = s.flap;
        s.flap = false;
        if (!f.started && (wantFlap || fx > LEAD_IN - 5)) f.started = true;
      } else {
        if (!f.started && s.t > 0.6 + f.slot * 0.25) f.started = true;
        wantFlap = f.started && botWantsFlap(f, fx);
      }
      if (!f.started) {
        f.y = 6 + Math.sin(s.t * 3 + f.slot) * 0.35;
        continue;
      }
      if (f.stun > 0) {
        f.stun -= STEP;
        f.y += (f.safe - f.y) * 0.12;
        f.vy = 0;
        continue;
      }
      if (wantFlap) {
        f.vy = FLAP_V;
        if (f.kind === "me") sfx.flap();
      }
      f.vy = Math.min(MAX_FALL, f.vy + GRAVITY * STEP);
      f.y += f.vy * STEP;
      if (f.inv > 0) f.inv -= STEP;

      // Gates: fly through a lane to answer.
      world.gates.forEach((g, gi) => {
        if (f.gates[gi] !== null || fx < g.x + 0.75) return;
        let lane = 0;
        BANDS.forEach((b, i) => {
          if (Math.abs(f.y - b) < Math.abs(f.y - BANDS[lane])) lane = i;
        });
        const right = lane === g.correct;
        f.gates[gi] = right;
        if (f.kind === "me") {
          if (right) sfx.correct();
          else sfx.wrong();
          setToast({
            id: Date.now(),
            good: right,
            title: right ? `Advancement made! ${ZONES[g.zone].name}` : `Not quite! It's "${g.options[g.correct]}"`,
            text: g.why,
          });
        }
      });

      const inGate = world.gates.some((g) => fx > g.x - 0.6 && fx < g.x + 2);
      if (f.inv <= 0 && !inGate) {
        if (f.y + R > GROUND || f.y - R < 0) {
          crash(f, fx);
          continue;
        }
        let hit = false;
        for (const o of world.obstacles) {
          if (o.x > fx + 2 || o.x + 3 < fx - 2) continue;
          for (const c of o.cells) {
            const nx = clamp(fx, c.x, c.x + 1);
            const ny = clamp(f.y, c.y, c.y + 1);
            if ((fx - nx) ** 2 + (f.y - ny) ** 2 < R * R) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          crash(f, fx);
          continue;
        }
      } else {
        f.y = clamp(f.y, R, GROUND - R);
      }

      for (const p of world.pickups) {
        if (f.got.has(p.id) || Math.abs(p.x - fx) > 0.7 || Math.abs(p.y - f.y) > 0.75) continue;
        f.got.add(p.id);
        if (f.kind === "me") {
          sfx.coin();
          for (let i = 0; i < 6; i++)
            particles.current.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.5, color: "#7dd3fc", size: 0.1 });
        }
      }
    }

    if (!s.ended && s.scroll >= world.endX) {
      s.ended = true;
      s.endAt = s.t;
    }
  };

  // Bot pilots aim for the gap (or the lane they picked), with a little wobble.
  function botWantsFlap(f: Flyer, fx: number) {
    const gate = world.gates.find((g, gi) => f.gates[gi] === null && g.x + 1 > fx && g.x - fx < 9);
    let target = 6;
    if (gate) {
      const gi = world.gates.indexOf(gate);
      if (!f.choice!.has(gi)) {
        const right = f.rnd!() < f.smart!;
        const wrong = [0, 1, 2].filter((i) => i !== gate.correct);
        f.choice!.set(gi, right ? gate.correct : wrong[Math.floor(f.rnd!() * 2)]);
      }
      target = BANDS[f.choice!.get(gi)!];
    } else {
      const o = world.obstacles.find((ob) => ob.x + 2.4 > fx);
      if (o) {
        const oi = world.obstacles.indexOf(o);
        if (!f.aimOff!.has(oi)) {
          const miss = f.rnd!() > f.skill! + 0.25;
          f.aimOff!.set(oi, miss ? (f.rnd!() < 0.5 ? -1 : 1) * (o.gapH / 2 + 0.6) : (f.rnd!() - 0.5) * 0.8);
        }
        target = o.gapTop + o.gapH / 2 + f.aimOff!.get(oi)!;
      }
    }
    return f.y > target + 0.25 && f.vy > -1.5;
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
    } else if (playingRef.current && s.ended) {
      s.t += dt;
    }

    const me0 = flyersRef.current[0];
    const S = h / ROWS;
    const VW = w / S;
    let camX = s.scroll - VW * PLAYER_AT;
    if (s.shake > 0) {
      s.shake -= dt;
      camX += (Math.random() - 0.5) * 0.15;
    }
    const sx = (x: number) => (x - camX) * S;
    const sy = (y: number) => y * S;
    const centerZone = zoneAt(world, camX + VW * 0.5);

    // Sky and far hills, cross-fading between stages.
    const drawBackdrop = (zi: number, alpha: number) => {
      const z = ZONES[zi];
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, z.sky[0]);
      g.addColorStop(1, z.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (z.sun) {
        const px = w * 0.84;
        const py = h * 0.14;
        const sz = S * 1.5;
        const glow = ctx.createRadialGradient(px, py, sz * 0.3, px, py, sz * 2.2);
        glow.addColorStop(0, "rgba(255,240,150,0.7)");
        glow.addColorStop(1, "rgba(255,240,150,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(px - sz * 2.5, py - sz * 2.5, sz * 5, sz * 5);
        ctx.fillStyle = "#fde047";
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(px - sz / 2 + sz * 0.15, py - sz / 2 + sz * 0.15, sz * 0.7, sz * 0.7);
        if (zi === 0) {
          ctx.strokeStyle = "rgba(245,158,11,0.55)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            const yy = py + sz * (1.2 + i * 0.5);
            for (let xx = px - sz * 3; xx < px + sz * 0.5; xx += 4) ctx.lineTo(xx, yy + Math.sin(xx / 9 + s.t * 4 + i) * 3);
            ctx.stroke();
          }
        }
      }
      // Far blocky hills / mountains
      const par = 0.3;
      const bs = S * 0.9;
      const off = camX * S * par;
      const first = Math.floor(off / bs) - 1;
      for (let i = first; i < first + w / bs + 3; i++) {
        const hh = zi === 2 ? 2 + ((i * 2654435761) >>> 0) % 2 : 3 + (((i * 2654435761) >>> 0) % 5) + (zi === 3 ? 3 : 0);
        const x = i * bs - off;
        const top = h - S * 2 - hh * bs * 0.75;
        ctx.fillStyle = z.far;
        ctx.fillRect(x, top, bs + 1, h - top);
        ctx.fillStyle = z.farTop;
        ctx.fillRect(x, top, bs + 1, bs * 0.45);
      }
      // Drifting blocky clouds
      ctx.fillStyle = zi === 3 ? "rgba(203,213,225,0.9)" : "rgba(255,255,255,0.9)";
      for (let i = 0; i < 6; i++) {
        const span = w + S * 8;
        const cx = ((i * 0.37 * span - camX * S * 0.12 - s.t * 8) % span + span) % span - S * 4;
        const cy = S * (1 + (i % 3) * 1.2);
        const u = S * 0.5;
        ctx.fillRect(cx, cy, u * 6, u * 1.5);
        ctx.fillRect(cx + u, cy - u, u * 3, u);
      }
      ctx.globalAlpha = 1;
    };
    const boundary = world.zoneStart[centerZone];
    const into = camX + VW * 0.5 - boundary;
    if (centerZone > 0 && into < 8) {
      drawBackdrop(centerZone - 1, 1);
      drawBackdrop(centerZone, clamp(into / 8, 0, 1));
    } else drawBackdrop(centerZone, 1);

    // Weather
    if (centerZone === 3) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) {
        const x = ((i * 97.3 + s.t * 40) % w + w) % w;
        const y = ((i * 53.1 + s.t * 420) % h + h) % h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 10);
        ctx.stroke();
      }
    }
    if (centerZone === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 18; i++) {
        const x = ((i * 131.7 - camX * S) % w + w) % w;
        const y = h - S * 2 - ((i * 41 + s.t * 30) % (h * 0.6));
        ctx.fillRect(x, y, S * 0.15, S * 0.15);
      }
    }

    // Blocks with a little 3D depth
    const depth = S * 0.2;
    const drawCells = (cells: Cell[], solid: (x: number, y: number) => boolean) => {
      for (const c of cells) {
        const x = sx(c.x);
        const y = sy(c.y);
        if (x < -S * 2 || x > w + S) continue;
        if (!solid(c.x, c.y - 1)) {
          ctx.fillStyle = TOP_COLOR[c.t];
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + depth, y - depth);
          ctx.lineTo(x + S + depth, y - depth);
          ctx.lineTo(x + S, y);
          ctx.fill();
        }
        if (!solid(c.x + 1, c.y)) {
          ctx.fillStyle = SIDE_COLOR[c.t];
          ctx.beginPath();
          ctx.moveTo(x + S, y);
          ctx.lineTo(x + S + depth, y - depth);
          ctx.lineTo(x + S + depth, y + S - depth);
          ctx.lineTo(x + S, y + S);
          ctx.fill();
        }
      }
      for (const c of cells) {
        const x = sx(c.x);
        if (x < -S * 2 || x > w + S) continue;
        ctx.drawImage(tex(c.t), x, sy(c.y), S + 0.6, S + 0.6);
      }
    };

    // Ground strip
    const firstCol = Math.floor(camX) - 1;
    const ground: Cell[] = [];
    for (let x = firstCol; x < firstCol + VW + 3; x++) {
      const z = ZONES[zoneAt(world, x)];
      ground.push({ x, y: GROUND, t: z.ground[0] }, { x, y: GROUND + 1, t: z.ground[1] });
    }
    for (const o of world.obstacles) {
      if (o.x < camX - 4 || o.x > camX + VW + 3) continue;
      drawCells(o.cells, (x, y) => o.solid.has(`${x},${y}`));
    }
    drawCells(ground, (_x, y) => y >= GROUND);

    // Gates: three lanes with answer signs
    world.gates.forEach((g, gi) => {
      if (g.x < camX - 6 || g.x > camX + VW + 8) return;
      const z = ZONES[g.zone];
      const wallTile: Tile = z.key === "transpiration" ? "log" : z.key === "condensation" ? "cloud" : z.key === "precipitation" ? "snowstone" : z.key === "collection" ? "cobble" : "sandstone";
      const cells: Cell[] = [];
      for (const r of DIVIDERS) for (let x = g.x; x < g.x + 2; x++) cells.push({ x, y: r, t: wallTile });
      const done = flyersRef.current[0].gates[gi];
      // Lane glass
      BANDS.forEach((b, i) => {
        const top = sy(b - 1.5);
        const col = done === null ? "rgba(125,211,252,0.28)" : i === g.correct ? "rgba(74,222,128,0.45)" : "rgba(248,113,113,0.3)";
        ctx.fillStyle = col;
        ctx.fillRect(sx(g.x), top, S * 2, S * 3);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(g.x) + 1, top + 1, S * 2 - 2, S * 3 - 2);
      });
      drawCells(cells, (x, y) => cells.some((c) => c.x === x && c.y === y));
      // Answer signs in front of the gate
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      BANDS.forEach((b, i) => {
        const bw = S * 5.6;
        const bh = S * 1.25;
        const bx = sx(g.x - 0.6) - bw;
        const by = sy(b) - bh / 2;
        ctx.fillStyle = done === null ? "rgba(30,27,46,0.88)" : i === g.correct ? "rgba(22,101,52,0.92)" : "rgba(127,29,29,0.85)";
        roundRect(ctx, bx, by, bw, bh, 6);
        ctx.fill();
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 2;
        ctx.stroke();
        // arrow
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.moveTo(bx + bw + S * 0.15, by + bh / 2 - S * 0.25);
        ctx.lineTo(bx + bw + S * 0.45, by + bh / 2);
        ctx.lineTo(bx + bw + S * 0.15, by + bh / 2 + S * 0.25);
        ctx.fill();
        ctx.fillStyle = "#fff";
        fitText(ctx, g.options[i], bx + bw / 2, by + bh / 2 + 1, bw - 10, Math.round(S * 0.5));
      });
    });

    // Water droplets to collect
    const mine = flyersRef.current[0]?.got;
    for (const p of world.pickups) {
      if (mine?.has(p.id) || p.x < camX - 1 || p.x > camX + VW + 1) continue;
      const bob = Math.sin(s.t * 4 + p.id) * 0.12;
      drawDrop(ctx, sx(p.x), sy(p.y + bob), S * 0.22, "#38bdf8", "drop", 0);
    }

    // Particles
    particles.current = particles.current.filter((p) => (p.life -= dt) > 0);
    for (const p of particles.current) {
      p.vy += 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx(p.x), sy(p.y), S * p.size, S * p.size);
    }
    ctx.globalAlpha = 1;

    // Flyers: furthest back first, you on top.
    const list = [...flyersRef.current].sort((a, b) => b.slot - a.slot);
    // Name tags: yours first, then nudge any tag that would overlap one already placed
    const tagH = S * 0.55 + 4;
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const tagLift = new Map<string, number>();
    ctx.font = `700 ${Math.round(S * 0.36)}px Fredoka, Nunito, system-ui, sans-serif`;
    for (const f of [...list].sort((a, b) => a.slot - b.slot)) {
      const x = sx(s.scroll - f.slot * SLOT_GAP);
      const r = S * (f.kind === "me" ? 0.5 : 0.42);
      const bw = ctx.measureText(f.kind === "me" ? "YOU" : f.name).width + S * 0.55 + 12;
      let y0 = sy(f.y) - r * 1.6 - tagH - 2;
      let lift = 0;
      while (placed.some((p) => x - bw / 2 < p.x1 + 3 && x + bw / 2 > p.x0 - 3 && y0 < p.y1 + 2 && y0 + tagH > p.y0 - 2) && lift < 4) {
        y0 -= tagH + 3;
        lift++;
      }
      placed.push({ x0: x - bw / 2, x1: x + bw / 2, y0, y1: y0 + tagH });
      tagLift.set(f.id, lift * (tagH + 3));
    }
    for (const f of list) {
      const fx = s.scroll - f.slot * SLOT_GAP;
      if (fx < camX - 1) continue;
      const x = sx(fx);
      const y = sy(f.y);
      const form = f.kind === "remote" ? f.remoteForm ?? "drop" : formFor(fx);
      const blink = (f.stun > 0 || f.inv > 0) && Math.floor(s.t * 10) % 2 === 0;
      const r = S * (f.kind === "me" ? 0.5 : 0.42);
      drawDrop(ctx, x, y, r, f.color, form, clamp(f.vy * 0.045, -0.35, 0.5), f.kind === "me" ? 1 : 0.92, blink);
      // Name tag with avatar
      const label = f.kind === "me" ? "YOU" : f.name;
      ctx.font = `700 ${Math.round(S * 0.36)}px Fredoka, Nunito, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const ah = S * 0.55;
      const bw = tw + ah + 12;
      const bx = x - bw / 2;
      const by = y - r * 1.6 - ah - 6 - (tagLift.get(f.id) ?? 0);
      ctx.fillStyle = f.kind === "me" ? "#facc15" : "rgba(255,255,255,0.92)";
      roundRect(ctx, bx, by, bw, ah + 4, (ah + 4) / 2);
      ctx.fill();
      ctx.strokeStyle = "#2a1f0c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const img = f.avatar ? loadImage(f.avatar) : null;
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, bx + 3, by + 2, ah, ah);
      else {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(bx + 3 + ah / 2, by + 2 + ah / 2, ah / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + ah + 7, by + ah / 2 + 2.5);
    }

    // Finish line
    if (world.endX - camX < VW + 2) {
      const x = sx(world.endX);
      for (let r = 0; r < GROUND; r++) {
        ctx.fillStyle = r % 2 ? "#ffffff" : "#1e293b";
        ctx.fillRect(x, sy(r), S * 0.5, S);
        ctx.fillStyle = r % 2 ? "#1e293b" : "#ffffff";
        ctx.fillRect(x + S * 0.5, sy(r), S * 0.5, S);
      }
    }

    // ── Outside the canvas: HUD, relays, progress ──
    const now = performance.now();
    const meF = me0;
    const myScore = meF ? scoreOf(meF, totalPickups, clamp(s.scroll / world.endX, 0, 1)) : 0;
    const gate = world.gates.findIndex((g, gi) => meF && meF.gates[gi] === null && s.scroll > g.x - 17);
    if (now - s.hudAt > 120 && meF) {
      s.hudAt = now;
      const next: Hud = {
        zone: zoneAt(world, s.scroll),
        pts: myScore,
        drops: meF.got.size,
        crashes: meF.crashes,
        started: meF.started,
        gate: gate >= 0 ? gate : null,
        ended: s.ended,
      };
      setHud((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      if (playingRef.current) reportProgress(myScore, clamp(s.scroll / world.endX, 0, 1));
    }
    if (isLive && live && meF && playingRef.current && now - s.sendAt > 110) {
      s.sendAt = now;
      live.send({ k: "dd", y: +meF.y.toFixed(2), vy: +meF.vy.toFixed(2), f: formFor(s.scroll), c: meF.crashes, s: meF.stun > 0 ? 1 : 0 });
    }
    if (reportBots && now - s.botAt > 500) {
      s.botAt = now;
      const bots: RivalInfo[] = flyersRef.current
        .filter((f) => f.kind === "bot")
        .map((f) => {
          const progress = clamp((s.scroll - f.slot * SLOT_GAP) / world.endX, 0, 1);
          return { id: f.id, name: f.name, avatar: f.avatar, score: scoreOf(f, totalPickups, s.ended ? 1 : progress), progress, done: s.ended, isBot: true };
        });
      reportBots(bots);
    }
  });

  // Finish a moment after the line.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!hud.ended || finishedRef.current) return;
    finishedRef.current = true;
    const meF = flyersRef.current[0];
    const t = setTimeout(() => {
      const right = meF.gates.filter((g) => g === true).length;
      finish(scoreOf(meF, totalPickups, 1), [
        { label: "Water cycle gates", value: `${right}/${world.gates.length}` },
        { label: "Droplets", value: `${meF.got.size}` },
        { label: "Splashes", value: `${meF.crashes}` },
      ]);
    }, 2600);
    return () => clearTimeout(t);
  }, [hud.ended, finish, totalPickups, world.gates.length]);

  // Clear the toast after a while
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const gate = hud.gate !== null ? world.gates[hud.gate] : null;
  const zone = ZONES[hud.zone];

  return (
    <div
      data-game="drop-dash"
      className="absolute inset-0 overflow-hidden select-none touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        flap();
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Stage track */}
      <div className="absolute left-2 right-2 top-2 flex items-start gap-2 pointer-events-none">
        <div className="bg-[#1e1b2e]/85 text-white rounded-xl border-2 border-[#2a1f0c] px-2 py-1.5 flex items-center gap-1 sm:gap-1.5">
          {ZONES.map((z, i) => {
            const Icon = ZONE_ICONS[i];
            const doneGate = flyersRef.current[0]?.gates[i];
            return (
              <div
                key={z.key}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors",
                  i === hud.zone ? "bg-yellow-400 text-slate-900" : doneGate === true ? "bg-emerald-500/80" : doneGate === false ? "bg-rose-500/70" : "bg-white/10 text-white/70",
                )}
                title={z.name}
              >
                <Icon size={14} strokeWidth={2.6} />
                <span className={cn("game-pixel text-[9px]", i === hud.zone ? "inline" : "hidden lg:inline")}>{z.name.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
        <div className="ml-auto flex gap-2">
          <div className="bg-white/95 rounded-xl game-panel px-2.5 py-1 flex items-center gap-1.5">
            <Droplet size={14} className="text-sky-500" fill="currentColor" />
            <span className="game-pixel text-sm text-slate-900">{hud.drops}</span>
          </div>
          <div className="bg-slate-900/85 text-white rounded-xl game-panel px-2.5 py-1 text-center">
            <p className="game-pixel text-[8px] text-amber-300 leading-none">PTS</p>
            <p className="game-pixel text-sm text-yellow-300 leading-tight">{hud.pts}</p>
          </div>
        </div>
      </div>

      {/* Question for the coming gate */}
      {gate && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-1.5 w-[min(94%,620px)] pointer-events-none game-bounce-in" key={hud.gate}>
          <div className="bg-[#1e1b2e]/94 text-white rounded-2xl border-[3px] border-[#facc15] px-3 py-1.5 sm:py-2 text-center shadow-xl">
            <p className="game-pixel text-[9px] text-yellow-300">QUESTION GATE · {ZONES[gate.zone].name.toUpperCase()} · FLY THROUGH THE RIGHT ANSWER</p>
            <p className="game-fun font-bold text-[14px] sm:text-[17px] leading-snug">{gate.q}</p>
          </div>
        </div>
      )}

      {/* Advancement toast */}
      {toast && (
        <div key={toast.id} className="absolute right-2 top-14 w-[min(88%,330px)] pointer-events-none game-bounce-in">
          <div className={cn("rounded-xl border-[3px] px-3 py-2 shadow-xl", toast.good ? "bg-[#1e1b2e]/95 border-emerald-400" : "bg-[#1e1b2e]/95 border-rose-400")}>
            <p className={cn("game-pixel text-[10px]", toast.good ? "text-emerald-300" : "text-rose-300")}>{toast.title.toUpperCase()}</p>
            <p className="text-white text-[12px] sm:text-[13px] font-semibold leading-snug mt-0.5">{toast.text}</p>
          </div>
        </div>
      )}

      {/* Sophia narrates each stage */}
      {say && !gate && (
        <div key={say.id} className="absolute left-2 bottom-[16%] max-w-[min(80%,380px)] flex items-end gap-2 pointer-events-none game-bounce-in">
          <img src={sophia.avatar} alt="Sophia" className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow game-float" />
          <div className="bg-white/95 rounded-2xl game-panel px-3 py-2">
            <p className="game-pixel text-[9px] text-emerald-600">SOPHIA · {zone.name.toUpperCase()}</p>
            <p className="text-[12px] sm:text-[13px] font-semibold text-slate-800 leading-snug">{zone.say}</p>
          </div>
        </div>
      )}

      {playing && !hud.started && (
        <div className="absolute inset-x-0 bottom-[30%] flex justify-center pointer-events-none">
          <div className="bg-yellow-400 text-slate-900 game-btn px-5 py-2.5 text-lg game-pulse">Tap, click or press SPACE to fly up!</div>
        </div>
      )}

      {hud.ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-sky-900/30 pointer-events-none">
          <div className="bg-white rounded-3xl game-panel px-6 py-4 text-center game-bounce-in max-w-sm mx-4">
            <p className="game-pixel text-sm text-sky-600">BACK TO THE OCEAN!</p>
            <p className="game-fun font-bold text-slate-900 text-lg mt-1">The Sun will heat Drippy again and the whole cycle starts over.</p>
          </div>
        </div>
      )}
    </div>
  );
}
