// Singapore-themed Monopoly — Mission Millionaire maths game.
// A tilted 3D board of real Singapore places. Roll the dice, hop your STEMbot
// round the island, and work out GST, sale discounts and change to buy places,
// pay rent and collect bonuses. After 8 rounds the richest player wins.
//
// The game engine is a pure reducer (`reduce`) so solo play (vs 3 computer
// STEMbots) and live play (2-4 humans, host-authoritative) share it.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Coins, Crown, Dice5, Trophy } from "lucide-react";
import { cn } from "../components/ui/utils";
import { STEMBOTS } from "../data/mock";
import { sfx } from "./kit/audio";
import { seededRandom } from "./kit/scores";
import type { GameProps } from "./kit/types";

// ── Board ────────────────────────────────────────────────

type TileKind = "go" | "prop" | "chance" | "sale" | "gst" | "kopi";

interface Tile {
  kind: TileKind;
  name: string;
  short: string;
  emoji: string;
  price?: number; // dollars
  group?: string; // colour band
}

const G_RED = "#ef4444";
const G_ORANGE = "#f97316";
const G_YELLOW = "#eab308";
const G_GREEN = "#22c55e";
const G_SKY = "#0ea5e9";
const G_MRT = "#64748b";
const G_PURPLE = "#a855f7";
const G_PINK = "#ec4899";

const TILES: Tile[] = [
  { kind: "go", name: "Payday", short: "PAYDAY", emoji: "💰" },
  { kind: "prop", name: "Chinatown", short: "Chinatown", emoji: "🏮", price: 100, group: G_RED },
  { kind: "prop", name: "Lau Pa Sat", short: "Lau Pa Sat", emoji: "🍢", price: 120, group: G_RED },
  { kind: "chance", name: "Chance", short: "Chance", emoji: "❓" },
  { kind: "prop", name: "Little India", short: "Little India", emoji: "🪔", price: 140, group: G_ORANGE },
  { kind: "prop", name: "Kampong Glam", short: "Kg Glam", emoji: "🕌", price: 160, group: G_ORANGE },
  { kind: "sale", name: "Great Singapore Sale", short: "GREAT SG SALE", emoji: "🛍️" },
  { kind: "prop", name: "Clarke Quay", short: "Clarke Quay", emoji: "🚤", price: 180, group: G_YELLOW },
  { kind: "prop", name: "Dhoby Ghaut MRT", short: "Dhoby Ghaut", emoji: "🚇", price: 200, group: G_MRT },
  { kind: "prop", name: "Singapore Zoo", short: "S'pore Zoo", emoji: "🦧", price: 220, group: G_YELLOW },
  { kind: "gst", name: "GST Counter", short: "9% GST", emoji: "🧾" },
  { kind: "prop", name: "East Coast Park", short: "East Coast", emoji: "🚲", price: 240, group: G_GREEN },
  { kind: "kopi", name: "Kopi Break", short: "KOPI BREAK", emoji: "☕" },
  { kind: "prop", name: "Orchard Road", short: "Orchard Rd", emoji: "🛒", price: 260, group: G_SKY },
  { kind: "chance", name: "Chance", short: "Chance", emoji: "❓" },
  { kind: "prop", name: "Sentosa", short: "Sentosa", emoji: "🏝️", price: 280, group: G_SKY },
  { kind: "prop", name: "Raffles Place MRT", short: "Raffles Pl", emoji: "🚇", price: 300, group: G_MRT },
  { kind: "prop", name: "Merlion Park", short: "Merlion", emoji: "🦁", price: 320, group: G_PURPLE },
  { kind: "gst", name: "Tax Office", short: "TAX OFFICE", emoji: "🏛️" },
  { kind: "prop", name: "Changi Airport", short: "Changi", emoji: "✈️", price: 340, group: G_PURPLE },
  { kind: "prop", name: "Gardens by the Bay", short: "Gardens", emoji: "🌳", price: 360, group: G_PINK },
  { kind: "sale", name: "Sale!", short: "SALE", emoji: "🏷️" },
  { kind: "prop", name: "Jewel Changi", short: "Jewel", emoji: "💎", price: 380, group: G_PINK },
  { kind: "prop", name: "Marina Bay Sands", short: "MBS", emoji: "🏨", price: 400, group: G_PINK },
];
const NT = TILES.length;

function tileXY(i: number): [number, number] {
  if (i <= 6) return [6 - i, 6];
  if (i <= 12) return [0, 6 - (i - 6)];
  if (i <= 18) return [i - 12, 0];
  return [6, i - 18];
}

const ROUNDS = 8;
const START_CASH = 100000; // cents
const PAYDAY = 15000;
const OOPS = 500;
const PLACE_PTS = [40, 28, 16, 6];
const SEAT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];
const SEAT_BOTS = ["timothy", "sophia", "emily", "matthew"] as const;

const fmt = (c: number) => (c < 0 ? "−" : "") + "$" + (Math.abs(c) / 100).toFixed(2);
const rentOf = (tile: number, level: number) => Math.round((TILES[tile].price ?? 0) * 11.5) * Math.max(1, level);

// ── Engine state ─────────────────────────────────────────

type QKind = "buy" | "change" | "kopi" | "sale" | "gst" | "chance";

interface Question {
  kind: QKind;
  tile: number;
  title: string;
  prompt: string;
  ask: string;
  topic: string; // for "Bea is working out the …"
  options: number[]; // cents
  answer: number;
  reward?: number; // cents, for bonus questions
  amt?: number; // cents, chance card amount
}

interface Result {
  id: number;
  emoji: string;
  title: string;
  lines: string[];
  tone: "good" | "bad" | "info";
  sound: "buy" | "coin" | "good" | "bad" | "info" | "pay";
  toast?: string;
  bubble?: string;
}

interface PState {
  id: string;
  name: string;
  avatar: string;
  bot: boolean;
  pos: number;
  cash: number;
  credit: number;
  asked: number;
  right: number;
}

interface GState {
  v: number;
  rng: number;
  players: PState[];
  owner: number[];
  level: number[];
  turn: number;
  round: number;
  phase: "roll" | "question" | "result" | "over";
  dice: [number, number];
  rollId: number;
  mover: number;
  from: number;
  pre: string[];
  q: Question | null;
  picked: number | null;
  res: Result | null;
  resN: number;
}

type Action =
  | { type: "roll" }
  | { type: "answer"; choice: number; secs: number }
  | { type: "skip" }
  | { type: "next" };

function makeRng(state: number) {
  let s = state >>> 0 || 1;
  return {
    next() {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return (s % 1_000_000) / 1_000_000;
    },
    get state() {
      return s;
    },
  };
}
type Rng = ReturnType<typeof makeRng>;
const pick = <T,>(r: Rng, arr: readonly T[]) => arr[Math.floor(r.next() * arr.length)];

function initState(seed: number, players: { id: string; name: string; avatar: string; bot: boolean }[]): GState {
  const r = seededRandom(seed);
  return {
    v: 1,
    rng: Math.floor(r() * 4_000_000_000) + 1,
    players: players.map((p) => ({ ...p, pos: 0, cash: START_CASH, credit: 0, asked: 0, right: 0 })),
    owner: TILES.map(() => -1),
    level: TILES.map(() => 0),
    turn: 0,
    round: 1,
    phase: "roll",
    dice: [3, 4],
    rollId: 0,
    mover: 0,
    from: 0,
    pre: [],
    q: null,
    picked: null,
    res: null,
    resN: 0,
  };
}

/** Builds 3 options (correct + 2 distractors), shuffled with the game rng. */
function options(r: Rng, ans: number, wrongs: number[]) {
  const pool: number[] = [];
  for (const w of [...wrongs, ans + 100, ans - 100, ans + 10, ans - 10]) {
    if (w > 0 && w !== ans && !pool.includes(w)) pool.push(w);
  }
  const ws = pool.slice(0, 2);
  const opts = [ans, ...ws];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return { options: opts, answer: opts.indexOf(ans) };
}

function buyQuestion(r: Rng, tile: number, round: number): Question {
  const t = TILES[tile];
  const P = (t.price ?? 100) * 100;
  const roll = r.next();
  const base = { kind: "buy" as const, tile, title: `Buy ${t.name}?`, ask: "How much do you pay?" };
  if (round >= 4 && roll < 0.3) {
    const d = pick(r, [10, 20, 25, 50]);
    const sale = Math.round((P * (100 - d)) / 100);
    const ans = Math.round((sale * 109) / 100);
    return {
      ...base,
      prompt: `${d}% off ${fmt(P)}, then add 9% GST`,
      topic: "discount and GST",
      ...options(r, ans, [sale, Math.round((P * 109) / 100), Math.round((P * (109 - d)) / 100)]),
    };
  }
  if (roll < 0.62) {
    const ans = Math.round((P * 109) / 100);
    return {
      ...base,
      prompt: `${fmt(P)} + 9% GST`,
      topic: "GST",
      ...options(r, ans, [P + 900, Math.round((P * 91) / 100), P + Math.round((P * 9) / 1000)]),
    };
  }
  const d = pick(r, [10, 20, 25, 30, 40, 50]);
  const ans = Math.round((P * (100 - d)) / 100);
  return {
    ...base,
    prompt: `Sale! ${d}% off ${fmt(P)}`,
    topic: "discount",
    ...options(r, ans, [Math.round((P * d) / 100), P - d * 100, Math.round((P * (100 + d)) / 100)]),
  };
}

const KOPI_MENU: [string, number][] = [
  ["kopi", 180],
  ["teh", 160],
  ["kaya toast", 250],
  ["half-boiled eggs", 190],
  ["Milo", 220],
  ["roti prata", 150],
  ["curry puff", 140],
];
const SALE_ITEMS = ["sneakers", "headphones", "LEGO set", "scooter", "backpack", "board game"];
const SALE_PRICES = [6000, 8000, 9000, 12000, 15000, 7500, 4500];
const BILLS = [2000, 3000, 4000, 5000, 6000, 8000, 12000, 15000, 4500];

const CHANCE: { emoji: string; text: string; amt: number }[] = [
  { emoji: "🧧", text: "Grandma gives you a hongbao!", amt: 8800 },
  { emoji: "🧋", text: "Bubble tea for the whole team.", amt: -1290 },
  { emoji: "🏆", text: "You won the school science fair!", amt: 4550 },
  { emoji: "🚌", text: "Top up your EZ-Link card.", amt: -2000 },
  { emoji: "☂️", text: "Lost your umbrella in the rain. Buy a new one.", amt: -1590 },
  { emoji: "🎨", text: "Your art sold at the school fair!", amt: 3275 },
  { emoji: "🍗", text: "Treat your friends to chicken rice.", amt: -1850 },
  { emoji: "💡", text: "Your invention wins a prize!", amt: 6025 },
  { emoji: "🎟️", text: "Tickets to the Night Safari.", amt: -2560 },
];

function netWorth(g: GState, i: number) {
  let w = g.players[i].cash;
  g.owner.forEach((o, t) => {
    if (o === i) w += (TILES[t].price ?? 0) * 100;
  });
  return w;
}

function ranking(g: GState) {
  return g.players
    .map((_, i) => i)
    .sort((a, b) => netWorth(g, b) - netWorth(g, a) || g.players[b].cash - g.players[a].cash || a - b);
}

function setResult(n: GState, res: Omit<Result, "id">) {
  n.resN += 1;
  n.res = { ...res, id: n.resN, lines: [...n.pre, ...res.lines] };
  n.phase = "result";
}

function land(n: GState, r: Rng) {
  const pi = n.turn;
  const p = n.players[pi];
  const t = TILES[p.pos];
  if (t.kind === "go") {
    setResult(n, { emoji: "💰", title: "Payday!", lines: [], tone: "good", sound: "coin", toast: `+${fmt(PAYDAY)}` });
    return;
  }
  if (t.kind === "prop") {
    const own = n.owner[p.pos];
    if (own === -1) {
      const P = (t.price ?? 0) * 100;
      if (p.cash < P * 1.1) {
        setResult(n, { emoji: "😅", title: `Can't afford ${t.name}`, lines: [`It costs about ${fmt(P)}. You have ${fmt(p.cash)}.`], tone: "info", sound: "info", bubble: "Too pricey for me!" });
        return;
      }
      n.q = buyQuestion(r, p.pos, n.round);
      n.phase = "question";
      return;
    }
    if (own === pi) {
      if (n.level[p.pos] < 3) {
        n.level[p.pos] += 1;
        setResult(n, {
          emoji: "🏠",
          title: `${t.name} grows!`,
          lines: [`A new house pops up. Rent is now ${fmt(rentOf(p.pos, n.level[p.pos]))}.`],
          tone: "good",
          sound: "buy",
          bubble: "Another house for me!",
        });
      } else setResult(n, { emoji: "😎", title: `Home sweet home`, lines: [`${t.name} is fully built.`], tone: "info", sound: "info" });
      return;
    }
    const rent = Math.min(p.cash, rentOf(p.pos, n.level[p.pos]));
    const before = p.cash;
    p.cash -= rent;
    n.players[own].cash += rent;
    const line = `Rent to ${n.players[own].name}: ${fmt(before)} − ${fmt(rent)} = ${fmt(p.cash)}`;
    if (rent > 0 && r.next() < 0.6) {
      const note = rent < 5000 ? 5000 : 10000;
      const ans = note - rent;
      n.pre.push(line);
      n.q = {
        kind: "change",
        tile: p.pos,
        title: "Bonus: count your change!",
        prompt: `You pay the ${fmt(rent)} rent with a ${fmt(note)} note.`,
        ask: "How much change do you get?",
        topic: "change",
        reward: 500,
        ...options(r, ans, [ans + 100, ans - 100, ans + 10, note - rent - 1000]),
      };
      n.phase = "question";
      return;
    }
    setResult(n, {
      emoji: "💸",
      title: `Pay rent at ${t.name}`,
      lines: [line],
      tone: "bad",
      sound: "pay",
      toast: `−${fmt(rent)}`,
      bubble: "Aww, rent day!",
    });
    return;
  }
  if (t.kind === "chance") {
    const c = pick(r, CHANCE);
    const before = p.cash;
    if (r.next() < 0.7 && before + c.amt > 0) {
      const ans = before + c.amt;
      n.q = {
        kind: "chance",
        tile: p.pos,
        title: "Chance card",
        prompt: `${c.emoji} ${c.text} (${c.amt >= 0 ? "+" : "−"}${fmt(Math.abs(c.amt))})`,
        ask: `You have ${fmt(before)}. What is your new balance? Get it right for a $5.00 bonus!`,
        topic: "new balance",
        reward: 500,
        amt: c.amt,
        ...options(r, ans, [before - c.amt, ans + 1000, ans - 100, ans + 10]),
      };
      n.phase = "question";
      return;
    }
    p.cash = Math.max(0, p.cash + c.amt);
    setResult(n, {
      emoji: c.emoji,
      title: c.text,
      lines: [`${fmt(before)} ${c.amt >= 0 ? "+" : "−"} ${fmt(Math.abs(c.amt))} = ${fmt(p.cash)}`],
      tone: c.amt >= 0 ? "good" : "bad",
      sound: c.amt >= 0 ? "coin" : "pay",
      toast: `${c.amt >= 0 ? "+" : "−"}${fmt(Math.abs(c.amt))}`,
      bubble: c.amt >= 0 ? "Woohoo!" : "Oh no!",
    });
    return;
  }
  if (t.kind === "kopi") {
    const items: [string, number][] = [];
    while (items.length < 3) {
      const it = pick(r, KOPI_MENU);
      if (!items.includes(it)) items.push(it);
    }
    const total = items.reduce((s, it) => s + it[1], 0);
    const ans = 1000 - total;
    n.q = {
      kind: "kopi",
      tile: p.pos,
      title: "Kopi Break!",
      prompt: items.map(([nm, c]) => `${nm} ${fmt(c)}`).join(", "),
      ask: "You pay with $10. How much change?",
      topic: "kopi change",
      reward: 2000,
      ...options(r, ans, [ans + 100, ans - 100, ans - 10, total]),
    };
    n.phase = "question";
    return;
  }
  if (t.kind === "sale") {
    const item = pick(r, SALE_ITEMS);
    const P = pick(r, SALE_PRICES);
    const d = pick(r, [10, 20, 25, 30, 50]);
    const save = Math.round((P * d) / 100);
    n.q = {
      kind: "sale",
      tile: p.pos,
      title: "Great Singapore Sale!",
      prompt: `${fmt(P)} ${item}, now ${d}% off`,
      ask: "How much do you SAVE? (You win it as cashback!)",
      topic: "discount",
      reward: save,
      ...options(r, save, [P - save, Math.round((P * d) / 1000), d * 100]),
    };
    n.phase = "question";
    return;
  }
  // gst tile
  const B = pick(r, BILLS);
  const gst = Math.round((B * 9) / 100);
  n.q = {
    kind: "gst",
    tile: p.pos,
    title: t.name,
    prompt: `Your shopping bill is ${fmt(B)}.`,
    ask: "How much is the 9% GST you must pay?",
    topic: "GST",
    reward: gst,
    ...options(r, gst, [900, B + gst, gst * 10]),
  };
  n.phase = "question";
}

function answerQuestion(n: GState, choice: number, secs: number) {
  const q = n.q!;
  const p = n.players[n.turn];
  const right = choice === q.answer;
  const speed = Math.max(0, Math.min(1, 1 - (secs - 5) / 15));
  p.asked += 1;
  if (right) {
    p.right += 1;
    p.credit += 0.7 + 0.3 * speed;
  }
  n.picked = choice;
  const correct = q.options[q.answer];
  const before = p.cash;
  const t = TILES[q.tile];
  if (q.kind === "buy") {
    if (right) {
      if (p.cash < correct) {
        setResult(n, { emoji: "😅", title: "Correct, but not enough cash!", lines: [`You need ${fmt(correct)}.`], tone: "info", sound: "good" });
        return;
      }
      p.cash -= correct;
      n.owner[q.tile] = n.turn;
      n.level[q.tile] = 1;
      setResult(n, {
        emoji: "🎉",
        title: `You bought ${t.name}!`,
        lines: [`${fmt(before)} − ${fmt(correct)} = ${fmt(p.cash)}`, `Rent here: ${fmt(rentOf(q.tile, 1))}`],
        tone: "good",
        sound: "buy",
        toast: "SOLD!",
        bubble: `Yay, ${t.short} is mine!`,
      });
    } else {
      p.cash = Math.max(0, p.cash - OOPS);
      setResult(n, {
        emoji: "🙈",
        title: "Oops! Not the right price",
        lines: [`It was ${fmt(correct)}. Oops fee: ${fmt(before)} − ${fmt(OOPS)} = ${fmt(p.cash)}`],
        tone: "bad",
        sound: "bad",
        toast: `−${fmt(OOPS)}`,
        bubble: "Oops! Wrong sum!",
      });
    }
    return;
  }
  if (q.kind === "gst") {
    const pay = right ? correct : correct + OOPS;
    p.cash = Math.max(0, p.cash - pay);
    setResult(n, {
      emoji: right ? "✅" : "🙈",
      title: right ? "Correct GST paid" : "Wrong! GST + $5.00 oops fee",
      lines: [`9% GST = ${fmt(correct)}`, `${fmt(before)} − ${fmt(pay)} = ${fmt(p.cash)}`],
      tone: right ? "good" : "bad",
      sound: right ? "good" : "bad",
      toast: `−${fmt(pay)}`,
      bubble: right ? "Paid the right amount!" : "Oops, extra fee!",
    });
    return;
  }
  if (q.kind === "chance") {
    const amt = q.amt ?? 0;
    p.cash = Math.max(0, p.cash + amt + (right ? 500 : 0));
    setResult(n, {
      emoji: right ? "🤑" : "🙈",
      title: right ? "Correct! +$5.00 bonus" : `Not quite, it was ${fmt(correct)}`,
      lines: [`${fmt(before)} ${amt >= 0 ? "+" : "−"} ${fmt(Math.abs(amt))} = ${fmt(before + amt)}`, ...(right ? [`Bonus: + $5.00 = ${fmt(p.cash)}`] : [])],
      tone: right ? "good" : "bad",
      sound: right ? "coin" : "bad",
      toast: `${amt + (right ? 500 : 0) >= 0 ? "+" : "−"}${fmt(Math.abs(amt + (right ? 500 : 0)))}`,
      bubble: right ? "Balance sorted!" : "Oops, my sums!",
    });
    return;
  }
  // bonus questions: change, kopi, sale
  const reward = q.kind === "sale" ? correct : q.reward ?? 0;
  if (right) p.cash += reward;
  setResult(n, {
    emoji: right ? "🤑" : "🙈",
    title: right ? `Correct! +${fmt(reward)} bonus` : `Not quite, it was ${fmt(correct)}`,
    lines: right ? [`${fmt(before)} + ${fmt(reward)} = ${fmt(p.cash)}`] : ["No bonus this time."],
    tone: right ? "good" : "bad",
    sound: right ? "coin" : "bad",
    toast: right ? `+${fmt(reward)}` : undefined,
    bubble: right ? "Maths pays off!" : "Hmm, so close!",
  });
}

function reduce(g: GState, a: Action & { by: number }): GState {
  if (a.by !== g.turn || g.phase === "over") return g;
  const n: GState = JSON.parse(JSON.stringify(g));
  const r = makeRng(n.rng);
  if (a.type === "roll") {
    if (g.phase !== "roll") return g;
    const d1 = 1 + Math.floor(r.next() * 6);
    const d2 = 1 + Math.floor(r.next() * 6);
    const p = n.players[n.turn];
    n.dice = [d1, d2];
    n.rollId += 1;
    n.mover = n.turn;
    n.from = p.pos;
    p.pos = (p.pos + d1 + d2) % NT;
    n.pre = [];
    n.q = null;
    n.picked = null;
    n.res = null;
    if (p.pos < n.from) {
      const before = p.cash;
      p.cash += PAYDAY;
      n.pre.push(`Payday! ${fmt(before)} + ${fmt(PAYDAY)} = ${fmt(p.cash)}`);
    }
    land(n, r);
  } else if (a.type === "answer") {
    if (g.phase !== "question" || !g.q) return g;
    answerQuestion(n, a.choice, a.secs);
  } else if (a.type === "skip") {
    if (g.phase !== "question" || g.q?.kind !== "buy") return g;
    setResult(n, { emoji: "👋", title: `Skipped ${TILES[g.q.tile].name}`, lines: ["Maybe next time!"], tone: "info", sound: "info" });
  } else if (a.type === "next") {
    if (g.phase !== "result") return g;
    n.turn = (n.turn + 1) % n.players.length;
    if (n.turn === 0) n.round += 1;
    n.q = null;
    n.picked = null;
    n.res = null;
    n.pre = [];
    n.phase = n.round > ROUNDS ? "over" : "roll";
    if (n.round > ROUNDS) n.round = ROUNDS;
  }
  n.rng = r.state;
  n.v = g.v + 1;
  return n;
}

function scoreFor(g: GState, i: number) {
  const p = g.players[i];
  const acc = p.asked ? p.credit / p.asked : 0;
  const rank = ranking(g).indexOf(i);
  return Math.max(0, Math.min(100, Math.round(60 * acc + (PLACE_PTS[rank] ?? 6))));
}

// ── 3D helpers ───────────────────────────────────────────

function shade(hex: string, f: number) {
  const m = hex.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return "#" + m.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, "0")).join("");
}

function Box({
  x,
  y,
  z = 0,
  w,
  d,
  h,
  color,
  top,
  bottom,
  children,
  className,
  style,
  topStyle,
  faceClass,
}: {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  color: string;
  top?: string;
  bottom?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  topStyle?: CSSProperties;
  faceClass?: string;
}) {
  const f = (s: CSSProperties): CSSProperties => ({ position: "absolute", left: 0, top: 0, backfaceVisibility: "hidden", ...s });
  return (
    <div
      className={className}
      style={{ position: "absolute", left: x, top: y, width: w, height: d, transformStyle: "preserve-3d", transform: `translateZ(${z}px)`, ...style }}
    >
      {bottom && <div className={faceClass} style={f({ width: w, height: d, background: shade(color, 0.6), transform: "rotateY(180deg)" })} />}
      <div className={faceClass} style={f({ width: w, height: h, top: 0, transformOrigin: "top", transform: "rotateX(90deg)", background: shade(color, 0.7) })} />
      <div className={faceClass} style={f({ width: w, height: h, top: d - h, transformOrigin: "bottom", transform: "rotateX(-90deg)", background: shade(color, 0.78) })} />
      <div className={faceClass} style={f({ width: h, height: d, left: w - h, transformOrigin: "right", transform: "rotateY(90deg)", background: shade(color, 0.64) })} />
      <div className={faceClass} style={f({ width: h, height: d, left: 0, transformOrigin: "left", transform: "rotateY(-90deg)", background: shade(color, 0.86) })} />
      <div className={faceClass} style={f({ width: w, height: d, transform: `translateZ(${h}px)`, background: top ?? color, ...topStyle })}>
        {children}
      </div>
    </div>
  );
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DieFace({ v, s }: { v: number; s: number }) {
  return (
    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3" style={{ padding: s * 0.12 }}>
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className="flex items-center justify-center">
          {PIPS[v].includes(k) && <span className="rounded-full" style={{ width: s * 0.18, height: s * 0.18, background: v === 1 ? "#e11d48" : "#1e293b" }} />}
        </span>
      ))}
    </div>
  );
}

function Die({ x, y, s, v, spin, delay }: { x: number; y: number; s: number; v: number; spin: boolean; delay: number }) {
  const south = v === 1 || v === 6 ? 2 : 1;
  const east = [3, 4, 2, 5, 1, 6].find((k) => k !== v && k !== 7 - v && k !== south && k !== 7 - south)!;
  const face = (extra: CSSProperties, val: number): ReactNode => (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: s,
        height: s,
        background: "linear-gradient(135deg,#ffffff,#e2e8f0)",
        borderRadius: s * 0.16,
        boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.12)",
        backfaceVisibility: "hidden",
        ...extra,
      }}
    >
      <DieFace v={val} s={s} />
    </div>
  );
  return (
    <div style={{ position: "absolute", left: x, top: y, width: s, height: s, transformStyle: "preserve-3d" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: `50% 50% ${s / 2}px`,
          animation: spin ? `sgm-roll 0.8s cubic-bezier(.3,.7,.4,1) ${delay}s both` : undefined,
          ["--hop" as string]: `${s * 2.2}px`,
        }}
      >
        {face({ transform: `translateZ(${s}px)` }, v)}
        {face({ transform: "rotateY(180deg)" }, 7 - v)}
        {face({ transformOrigin: "bottom", transform: "rotateX(-90deg)" }, south)}
        {face({ transformOrigin: "top", transform: "rotateX(90deg)" }, 7 - south)}
        {face({ transformOrigin: "right", transform: "rotateY(90deg)" }, east)}
        {face({ transformOrigin: "left", transform: "rotateY(-90deg)" }, 7 - east)}
      </div>
    </div>
  );
}

const CSS = `
@keyframes sgm-roll {
  0% { transform: translateZ(0) rotateX(0) rotateY(0); }
  35% { transform: translateZ(var(--hop)) rotateX(300deg) rotateY(140deg); }
  70% { transform: translateZ(calc(var(--hop) * 0.4)) rotateX(560deg) rotateY(290deg); }
  100% { transform: translateZ(0) rotateX(720deg) rotateY(360deg); }
}
@keyframes sgm-hop {
  0% { transform: translateY(0) scale(1, 1); }
  40% { transform: translateY(-38%) scale(0.95, 1.05); }
  85% { transform: translateY(0) scale(1.08, 0.92); }
  100% { transform: translateY(0) scale(1, 1); }
}
@keyframes sgm-glow {
  0%, 100% { box-shadow: inset 0 0 0 3px #fde047, 0 0 0 0 rgba(253,224,71,0.8); }
  50% { box-shadow: inset 0 0 0 3px #fde047, 0 0 18px 6px rgba(253,224,71,0.8); }
}
@keyframes sgm-toast {
  0% { transform: translate(-50%, 10px) scale(0.6); opacity: 0; }
  15% { transform: translate(-50%, 0) scale(1.15); opacity: 1; }
  70% { transform: translate(-50%, -20px) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50px) scale(1); opacity: 0; }
}
@keyframes sgm-cloud { from { transform: translateX(-120px); } to { transform: translateX(1100px); } }
.sgm-tile-glow { animation: sgm-glow 1s ease-in-out infinite; }
`;

// ── Component ────────────────────────────────────────────

const BOT_NAMES = ["sophia", "emily", "matthew"] as const;
const TILT = 40;

export function SgMonopoly({ mode, seed, me, live, reportProgress, finish }: GameProps) {
  const engineOwner = mode === "solo" || !!live?.isHost;

  const [g, setG] = useState<GState | null>(() => {
    if (mode === "solo" || !live) {
      return initState(seed, [
        { id: me.id, name: me.name || "You", avatar: me.avatar || STEMBOTS.timothy.avatar, bot: false },
        ...BOT_NAMES.map((b) => ({ id: `bot-${b}`, name: STEMBOTS[b].name, avatar: STEMBOTS[b].avatar, bot: true })),
      ]);
    }
    if (live.isHost) {
      return initState(
        seed,
        live.room.players.slice(0, 4).map((p, i) => ({
          id: p.id,
          name: p.name || `Player ${i + 1}`,
          avatar: p.avatar || STEMBOTS[SEAT_BOTS[i]].avatar,
          bot: false,
        })),
      );
    }
    return null;
  });
  const gRef = useRef(g);
  gRef.current = g;

  const commit = useCallback(
    (next: GState) => {
      gRef.current = next;
      setG(next);
      if (live && live.isHost) live.send({ t: "state", state: next });
    },
    [live],
  );

  const act = useCallback(
    (a: Action, by: number) => {
      const cur = gRef.current;
      if (!cur) return;
      if (mode === "live" && live && !live.isHost) {
        live.send({ t: "action", action: a });
        return;
      }
      const next = reduce(cur, { ...a, by });
      if (next !== cur) commit(next);
    },
    [mode, live, commit],
  );

  // Live networking
  useEffect(() => {
    if (!live) return;
    const off = live.onRelay((from, data) => {
      if (!data || typeof data !== "object") return;
      if (data.t === "state" && !live.isHost) {
        const s = data.state as GState;
        if (!gRef.current || s.v >= gRef.current.v) {
          gRef.current = s;
          setG(s);
        }
      } else if (data.t === "action" && live.isHost) {
        const cur = gRef.current;
        if (!cur) return;
        const idx = cur.players.findIndex((p) => p.id === from);
        if (idx < 0) return;
        const next = reduce(cur, { ...(data.action as Action), by: idx });
        if (next !== cur) commit(next);
      } else if (data.t === "hello" && live.isHost && gRef.current) {
        live.send({ t: "state", state: gRef.current });
      }
    });
    if (live.isHost) {
      if (gRef.current) live.send({ t: "state", state: gRef.current });
    } else live.send({ t: "hello" });
    return off;
  }, [live, commit]);

  // Non-hosts keep asking for state until it arrives.
  useEffect(() => {
    if (!live || live.isHost || g) return;
    const id = setInterval(() => live.send({ t: "hello" }), 2000);
    return () => clearInterval(id);
  }, [live, g]);

  // Wait for the shell's countdown.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 2600);
    return () => clearTimeout(t);
  }, []);

  // ── Token movement + dice animation ──
  const [disp, setDisp] = useState<number[]>(() => (g ? g.players.map((p) => p.pos) : []));
  const [moving, setMoving] = useState(false);
  const [spin, setSpin] = useState(false);
  const movingRef = useRef(false);
  const lastRoll = useRef(-1);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!g) return;
    if (lastRoll.current === -1 || g.rollId === lastRoll.current) {
      lastRoll.current = g.rollId;
      if (!movingRef.current) setDisp(g.players.map((p) => p.pos));
      return;
    }
    lastRoll.current = g.rollId;
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];
    const m = g.mover;
    const start = g.from;
    const steps = (g.players[m].pos - start + NT) % NT;
    const final = g.players.map((p) => p.pos);
    movingRef.current = true;
    setMoving(true);
    setSpin(true);
    setDisp(final.map((p, i) => (i === m ? start : p)));
    sfx.dice();
    const T = animTimers.current;
    T.push(setTimeout(() => setSpin(false), 950));
    for (let k = 1; k <= steps; k++) {
      T.push(
        setTimeout(() => {
          setDisp((d) => {
            const c = [...d];
            c[m] = (start + k) % NT;
            return c;
          });
          if ((start + k) % NT === 0) sfx.coin();
          else sfx.tick();
        }, 950 + k * 200),
      );
    }
    T.push(
      setTimeout(() => {
        movingRef.current = false;
        setMoving(false);
        setDisp(final);
        sfx.place();
      }, 950 + steps * 200 + 250),
    );
  }, [g?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => animTimers.current.forEach(clearTimeout), []);

  const meIdx = g ? g.players.findIndex((p) => p.id === me.id) : -1;
  const cur = g ? g.players[g.turn] : null;
  const myTurn = !!g && g.turn === meIdx;
  const revealed = !!g && !moving;

  // ── Sounds, toasts and question timing on reveal ──
  const [toast, setToast] = useState<{ text: string; good: boolean; key: number } | null>(null);
  const lastRes = useRef(0);
  const qShownAt = useRef(0);
  const lastQ = useRef("");
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (!g || moving) return;
    if (g.phase === "question" && g.q) {
      const key = `${g.v}`;
      if (lastQ.current !== `${g.rollId}-${g.q.kind}`) {
        lastQ.current = `${g.rollId}-${g.q.kind}`;
        qShownAt.current = Date.now();
        if (g.pre.length) sfx.whoosh();
        sfx.pop();
      }
      void key;
    }
    if (g.res && g.res.id !== lastRes.current) {
      lastRes.current = g.res.id;
      const s = g.res.sound;
      if (s === "buy") sfx.levelUp();
      else if (s === "coin") {
        sfx.correct();
        sfx.coin();
      } else if (s === "good") sfx.correct();
      else if (s === "bad") {
        sfx.wrong();
        setShake(true);
        setTimeout(() => setShake(false), 400);
      } else if (s === "pay") sfx.whoosh();
      else sfx.click();
      if (g.res.toast) setToast({ text: g.res.toast, good: g.res.tone !== "bad", key: g.res.id });
    }
    if (g.phase === "over") sfx.fanfare();
  }, [g?.v, moving]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Bot driver (solo) + auto-advance (engine owner) ──
  useEffect(() => {
    if (!g || !started || moving || !engineOwner || g.phase === "over") return;
    const p = g.players[g.turn];
    const by = g.turn;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (p.bot) {
      if (g.phase === "roll") t = setTimeout(() => act({ type: "roll" }, by), 550);
      else if (g.phase === "question" && g.q) {
        const q = g.q;
        t = setTimeout(() => {
          if (q.kind === "buy" && p.cash - q.options[q.answer] < 15000) {
            act({ type: "skip" }, by);
            return;
          }
          const right = Math.random() < 0.75;
          const wrongs = q.options.map((_, i) => i).filter((i) => i !== q.answer);
          act({ type: "answer", choice: right ? q.answer : wrongs[Math.floor(Math.random() * wrongs.length)], secs: 3 + Math.random() * 6 }, by);
        }, 1400);
      } else if (g.phase === "result") t = setTimeout(() => act({ type: "next" }, by), 1300);
    } else {
      // Keep live games moving if someone wanders off; in solo only the result screen auto-advances.
      if (g.phase === "result") t = setTimeout(() => act({ type: "next" }, by), mode === "live" ? 7000 : 9000);
      else if (mode === "live" && g.phase === "roll") t = setTimeout(() => act({ type: "roll" }, by), 15000);
      else if (mode === "live" && g.phase === "question") t = setTimeout(() => act({ type: "answer", choice: -1, secs: 30 }, by), 30000);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [g?.v, started, moving, engineOwner, act, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Score + finish ──
  const score = g && meIdx >= 0 ? scoreFor(g, meIdx) : 0;
  const progress = g ? Math.min(1, ((g.round - 1) * g.players.length + g.turn) / (ROUNDS * g.players.length)) : 0;
  useEffect(() => {
    if (g) reportProgress(score, g.phase === "over" ? 1 : progress);
  }, [score, progress, reportProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const finished = useRef(false);
  useEffect(() => {
    if (!g || g.phase !== "over" || finished.current || meIdx < 0) return;
    finished.current = true;
    const rank = ranking(g).indexOf(meIdx);
    const p = g.players[meIdx];
    const owned = g.owner.filter((o) => o === meIdx).length;
    const t = setTimeout(
      () =>
        finish(scoreFor(g, meIdx), [
          { label: "Place", value: `${["1st", "2nd", "3rd", "4th"][rank]} of ${g.players.length}` },
          { label: "Net worth", value: fmt(netWorth(g, meIdx)) },
          { label: "Maths answers", value: `${p.right}/${p.asked} correct` },
          { label: "Places owned", value: `${owned}` },
        ]),
      2200,
    );
    return () => clearTimeout(t);
  }, [g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layout measurement ──
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [rootW, setRootW] = useState(900);
  const [boardBox, setBoardBox] = useState({ w: 560, h: 500 });
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (rootRef.current) setRootW(rootRef.current.clientWidth);
      if (boardRef.current) setBoardBox({ w: boardRef.current.clientWidth, h: boardRef.current.clientHeight });
    });
    if (rootRef.current) ro.observe(rootRef.current);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [g === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const wide = rootW >= 700;

  if (!g) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-sky-400 to-amber-200 game-checker">
        <img src={STEMBOTS.timothy.avatar} alt="" className="w-24 h-24 object-contain game-float" />
        <p className="game-fun font-bold text-slate-900 bg-white/90 rounded-2xl game-panel px-5 py-3">Waiting for the host to set up the board…</p>
      </div>
    );
  }

  const cell = Math.max(34, Math.floor(Math.min(boardBox.w / (7 * 1.08), (boardBox.h - 12) / (7 * 0.96))));
  const S = cell * 7;
  const th = Math.max(5, cell * 0.14);
  const baseH = Math.max(8, cell * 0.22);
  const rank = ranking(g);
  const landed = g.players[g.mover]?.pos;
  const showLanding = revealed && (g.phase === "question" || g.phase === "result") && g.rollId > 0;
  const colorOf = (i: number) => SEAT_COLORS[i % 4];

  // ── Board ──
  const board = (
    <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: 1500, perspectiveOrigin: "50% 30%" }}>
      <div
        style={{
          width: S,
          height: S,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `translateY(${-cell * 0.12}px) rotateX(${TILT}deg)`,
        }}
      >
        {/* base slab */}
        <Box
          x={-cell * 0.12}
          y={-cell * 0.12}
          z={-baseH}
          w={S + cell * 0.24}
          d={S + cell * 0.24}
          h={baseH}
          color="#16a34a"
          top="#4ade80"
          topStyle={{
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%), linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%)",
            backgroundSize: `${cell / 2}px ${cell / 2}px`,
            backgroundPosition: `0 0, ${cell / 4}px ${cell / 4}px`,
            borderRadius: 6,
          }}
        />
        {/* Marina Bay water in the middle */}
        <div
          style={{
            position: "absolute",
            left: cell * 1.35,
            top: cell * 1.35,
            width: S - cell * 2.7,
            height: cell * 2.2,
            transform: "translateZ(1px)",
            borderRadius: cell * 0.3,
            background: "linear-gradient(180deg,#38bdf8,#0284c7)",
            boxShadow: "inset 0 0 0 4px rgba(255,255,255,0.35)",
          }}
        >
          <span className="absolute left-2 bottom-1 game-pixel text-white/80" style={{ fontSize: Math.max(6, cell * 0.1) }}>
            MARINA BAY
          </span>
        </div>
        {/* Title painted on the grass */}
        <div
          className="absolute flex flex-col items-center justify-center text-center"
          style={{ left: cell * 1.2, top: cell * 3.7, width: S - cell * 2.4, height: cell * 1.0, transform: "translateZ(1px)" }}
        >
          <span className="game-pixel text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]" style={{ fontSize: Math.max(9, cell * 0.24) }}>
            SG MONOPOLY
          </span>
          <span className="game-pixel text-emerald-950/70 mt-1" style={{ fontSize: Math.max(6, cell * 0.11) }}>
            ROUND {g.round}/{ROUNDS}
          </span>
        </div>
        {/* Marina Bay Sands */}
        {[0, 1, 2].map((k) => (
          <Box key={k} x={cell * (2.6 + k * 0.55)} y={cell * 2.55} w={cell * 0.3} d={cell * 0.42} h={cell * 0.8} color="#e2e8f0" top="#f8fafc" />
        ))}
        <Box x={cell * 2.4} y={cell * 2.58} z={cell * 0.8} w={cell * 1.75} d={cell * 0.36} h={cell * 0.09} color="#94a3b8" top="#cbd5e1" />
        {/* Supertrees */}
        {[0, 1, 2].map((k) => (
          <Box key={`st${k}`} x={cell * (4.7 + k * 0.32)} y={cell * (2.55 + (k % 2) * 0.35)} w={cell * 0.08} d={cell * 0.08} h={cell * (0.5 + (k % 2) * 0.18)} color="#7e22ce">
            <div />
          </Box>
        ))}
        {[0, 1, 2].map((k) => (
          <Box
            key={`sc${k}`}
            x={cell * (4.7 + k * 0.32) - cell * 0.12}
            y={cell * (2.55 + (k % 2) * 0.35) - cell * 0.12}
            z={cell * (0.5 + (k % 2) * 0.18)}
            w={cell * 0.32}
            d={cell * 0.32}
            h={cell * 0.06}
            color="#c026d3"
            top="#e879f9"
          />
        ))}
        {/* Merlion */}
        <div
          className="absolute flex items-end justify-center"
          style={{
            left: cell * 1.5,
            top: cell * 2.6,
            width: cell * 0.7,
            height: cell * 0.7,
            transformOrigin: "bottom center",
            transform: `translateZ(2px) rotateX(-${TILT}deg)`,
            fontSize: cell * 0.5,
          }}
        >
          🦁
        </div>

        {/* Dice */}
        <Die x={S / 2 - cell * 0.75} y={cell * 4.75} s={cell * 0.55} v={g.dice[0]} spin={spin} delay={0} />
        <Die x={S / 2 + cell * 0.2} y={cell * 4.85} s={cell * 0.55} v={g.dice[1]} spin={spin} delay={0.08} />

        {/* Tiles */}
        {TILES.map((t, i) => {
          const [cx, cy] = tileXY(i);
          const own = g.owner[i];
          const corner = i % 6 === 0;
          const glow = showLanding && i === landed;
          const special: Record<string, string> = { go: "#fde047", chance: "#c4b5fd", sale: "#f9a8d4", gst: "#fed7aa", kopi: "#d9f99d" };
          const topBg = t.kind === "prop" ? (own >= 0 ? shade(colorOf(own), 1) + "" : "#fffbeb") : special[t.kind];
          return (
            <Box
              key={i}
              x={cx * cell + 2}
              y={cy * cell + 2}
              w={cell - 4}
              d={cell - 4}
              h={glow ? th * 2.2 : th}
              color={t.kind === "prop" ? (own >= 0 ? colorOf(own) : "#fde68a") : special[t.kind]}
              top={topBg}
              style={{ transition: "transform 200ms" }}
              topStyle={{
                borderRadius: 4,
                overflow: "hidden",
                ...(own >= 0 && t.kind === "prop" ? { background: `linear-gradient(${shade(colorOf(own), 1.0)}55, ${colorOf(own)}33), #fffbeb` } : {}),
              }}
            >
              <div className={cn("absolute inset-0 flex flex-col items-center text-center", glow && "sgm-tile-glow")} style={{ borderRadius: 4 }}>
                {t.group && <div className="w-full shrink-0" style={{ height: cell * 0.16, background: t.group, borderBottom: "2px solid rgba(0,0,0,0.15)" }} />}
                <span style={{ fontSize: cell * (corner ? 0.36 : 0.27), lineHeight: 1.1, marginTop: t.group ? 1 : cell * 0.08 }}>{t.emoji}</span>
                <span
                  className="game-fun font-bold text-slate-800 leading-none px-0.5"
                  style={{ fontSize: Math.max(7, cell * (corner ? 0.12 : 0.13)), marginTop: 1 }}
                >
                  {t.short}
                </span>
                {t.price && (
                  <span className="game-pixel text-emerald-800 leading-none" style={{ fontSize: Math.max(5, cell * 0.085), marginTop: 2 }}>
                    ${t.price}
                  </span>
                )}
              </div>
            </Box>
          );
        })}

        {/* Houses on owned places */}
        {TILES.map((_, i) => {
          const own = g.owner[i];
          if (own < 0) return null;
          const [cx, cy] = tileXY(i);
          const hs = cell * 0.2;
          return Array.from({ length: g.level[i] }, (_, k) => (
            <Box
              key={`h${i}-${k}`}
              className="game-bounce-in"
              x={cx * cell + cell * 0.08 + k * cell * 0.28}
              y={cy * cell + cell * 0.72}
              z={th}
              w={hs}
              d={hs}
              h={hs * 0.9}
              color={colorOf(own)}
              top={shade(colorOf(own), 0.75)}
            />
          ));
        })}

        {/* Tokens */}
        {g.players.map((p, i) => {
          const pos = disp[i] ?? p.pos;
          const [cx, cy] = tileXY(pos);
          const same = g.players.map((_, j) => j).filter((j) => (disp[j] ?? g.players[j].pos) === pos);
          const slot = same.indexOf(i);
          const offs = same.length === 1 ? [[0, 0]] : [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.18], [0.2, 0.18]];
          const [ox, oy] = offs[slot] ?? [0, 0];
          const tw = cell * (same.length === 1 ? 0.62 : 0.5);
          const active = g.turn === i && g.phase !== "over";
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: cx * cell + cell / 2 + ox * cell - tw / 2,
                top: cy * cell + cell / 2 + oy * cell - tw,
                width: tw,
                height: tw,
                transformStyle: "preserve-3d",
                transform: `translateZ(${th + 2}px)`,
                transition: "left 170ms ease, top 170ms ease",
              }}
            >
              <div
                className="absolute rounded-full"
                style={{ left: tw * 0.1, top: tw * 0.75, width: tw * 0.8, height: tw * 0.4, background: colorOf(i), opacity: 0.85, boxShadow: "0 0 0 2px white" }}
              />
              <div style={{ position: "absolute", inset: 0, transformOrigin: "bottom center", transform: `rotateX(-${TILT}deg) translateZ(1px)` }}>
                <div key={pos} style={{ width: "100%", height: "100%", animation: moving && i === g.mover ? "sgm-hop 200ms ease-out" : undefined }}>
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className={cn("w-full h-full object-contain", active && !moving && "game-float")}
                    style={{ filter: `drop-shadow(0 3px 0 ${colorOf(i)}) drop-shadow(0 4px 3px rgba(0,0,0,0.35))` }}
                  />
                </div>
                {active && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 game-pixel text-white rounded px-1"
                    style={{ top: -cell * 0.22, fontSize: Math.max(6, cell * 0.09), background: colorOf(i), whiteSpace: "nowrap" }}
                  >
                    ▼
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Speech bubbles ──
  const q = g.q;
  const res = g.res;
  const tileOfQ = q ? TILES[q.tile] : null;
  const curName = cur?.name ?? "";
  let botBubble: string | null = null;
  if (cur?.bot && revealed) {
    if (g.phase === "roll") botBubble = "My turn! Rolling…";
    else if (g.phase === "question" && q)
      botBubble =
        q.kind === "buy"
          ? `Ooh, ${tileOfQ!.name}! I'll buy it!`
          : q.kind === "gst"
            ? "Hmm, 9% GST… let me think."
            : q.kind === "sale"
              ? "A sale! How much do I save?"
              : q.kind === "chance"
                ? "A chance card! My new balance is…"
              : "Let me count my change…";
    else if (g.phase === "result" && res) botBubble = res.bubble ?? "Next!";
  }

  // ── Players panel ──
  const playersPanel = (
    <div className={cn(wide ? "flex flex-col gap-1.5" : "grid grid-cols-4 gap-1")}>
      {g.players.map((p, i) => {
        const r = rank.indexOf(i);
        const active = g.turn === i && g.phase !== "over";
        const nw = netWorth(g, i);
        const owned = g.owner.filter((o) => o === i).length;
        return (
          <div
            key={p.id}
            className={cn(
              "relative bg-white/95 rounded-xl flex items-center gap-2 border-[3px] transition-all",
              wide ? "px-2 py-0.5" : "px-1 py-0.5 flex-col gap-0",
              active ? "scale-[1.03] shadow-lg" : "border-transparent opacity-90",
            )}
            style={{ borderColor: active ? colorOf(i) : "transparent", boxShadow: active ? `0 4px 0 ${colorOf(i)}` : "0 3px 0 rgba(0,0,0,0.15)" }}
          >
            <div className="relative shrink-0">
              <img src={p.avatar} alt="" className={cn("object-contain rounded-lg", wide ? "w-8 h-8" : "w-7 h-7")} style={{ background: colorOf(i) + "33" }} />
              {r === 0 && g.rollId > 0 && <Crown size={14} className="absolute -top-2 -right-1 text-amber-500 fill-amber-300" />}
            </div>
            <div className={cn("min-w-0 flex-1", !wide && "text-center w-full")}>
              <p className="game-fun font-bold text-slate-900 text-xs leading-tight truncate">
                {p.name}
                {i === meIdx && <span className="text-[9px] text-slate-400"> (you)</span>}
              </p>
              <p className={cn("leading-tight", wide && "flex items-center justify-between gap-1")}>
                <span className="game-pixel text-[8px] text-emerald-700">{fmt(p.cash)}</span>
                {wide && (
                  <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                    🏠{owned} · worth ${Math.round(nw / 100)}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  let card: ReactNode;
  if (g.phase === "over") {
    card = (
      <div className="bg-white/95 rounded-2xl game-panel p-3 game-bounce-in">
        <p className="game-pixel text-[10px] text-slate-500 flex items-center gap-1">
          <Trophy size={12} className="text-amber-500" /> FINAL RICH LIST
        </p>
        <div className="mt-2 space-y-1">
          {rank.map((i, k) => (
            <div key={i} className="flex items-center gap-2 text-sm game-fun font-bold">
              <span className="w-5">{["🥇", "🥈", "🥉", "4️⃣"][k]}</span>
              <img src={g.players[i].avatar} alt="" className="w-6 h-6 object-contain" />
              <span className="flex-1 truncate">{g.players[i].name}</span>
              <span className="game-pixel text-[9px] text-emerald-700">{fmt(netWorth(g, i))}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (!started) {
    card = <div className="bg-white/90 rounded-2xl game-panel p-3 text-center game-fun font-bold text-slate-700">Get ready…</div>;
  } else if (moving) {
    card = (
      <div className="bg-white/95 rounded-2xl game-panel p-3 flex items-center gap-3">
        <Dice5 className="text-rose-500 shrink-0" />
        <div>
          <p className="game-pixel text-[9px] text-slate-500">{curName.toUpperCase()} ROLLED</p>
          <p className="game-fun font-bold text-slate-900 text-lg leading-tight">
            {spin ? "Rolling…" : `${g.dice[0]} + ${g.dice[1]} = ${g.dice[0] + g.dice[1]} spaces`}
          </p>
        </div>
      </div>
    );
  } else if (g.phase === "roll") {
    card = myTurn ? (
      <div className="bg-white/95 rounded-2xl game-panel p-3 text-center game-bounce-in">
        <p className="game-pixel text-[10px] text-slate-500">YOUR TURN · ROUND {g.round}/{ROUNDS}</p>
        <button
          onClick={() => {
            sfx.click();
            act({ type: "roll" }, meIdx);
          }}
          className="game-btn bg-yellow-400 text-slate-900 text-xl w-full mt-2 py-3 flex items-center justify-center gap-2 game-pulse"
        >
          🎲 ROLL!
        </button>
        <p className="text-[11px] text-slate-500 mt-2 game-fun">Pass Payday to collect {fmt(PAYDAY)}</p>
      </div>
    ) : (
      <BotCard avatar={cur!.avatar} name={curName} color={colorOf(g.turn)} text={cur!.bot ? (wide ? `${curName}'s turn` : botBubble ?? "") : `${curName} is about to roll…`} />
    );
  } else if (g.phase === "question" && q) {
    if (myTurn) {
      card = (
        <QuestionCard key={`${g.rollId}-${q.kind}`} q={q} pre={g.pre} picked={null} onPick={(i) => act({ type: "answer", choice: i, secs: (Date.now() - qShownAt.current) / 1000 }, meIdx)} onSkip={q.kind === "buy" ? () => act({ type: "skip" }, meIdx) : undefined} cash={cur!.cash} narrow={!wide || g.pre.length > 0} />
      );
    } else if (cur?.bot) {
      card = (
        <div className="space-y-2">
          {!wide && <BotCard avatar={cur.avatar} name={curName} color={colorOf(g.turn)} text={botBubble ?? ""} small />}
          <QuestionCard q={q} pre={g.pre} picked={null} compact />
        </div>
      );
    } else {
      card = <BotCard avatar={cur!.avatar} name={curName} color={colorOf(g.turn)} text={`${curName} is working out the ${q.topic}…`} />;
    }
  } else if (g.phase === "result" && res) {
    const mine = myTurn;
    card = (
      <div className="space-y-2">
        {!mine && !wide && <BotCard avatar={cur!.avatar} name={curName} color={colorOf(g.turn)} text={botBubble ?? res.title} small />}
        {q && g.picked !== null && <QuestionCard q={q} pre={[]} picked={g.picked} compact />}
        <div
          className={cn(
            "rounded-2xl game-panel p-3 game-bounce-in",
            res.tone === "good" ? "bg-emerald-500 text-white" : res.tone === "bad" ? "bg-rose-500 text-white" : "bg-white/95 text-slate-900",
            shake && "game-shake",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{res.emoji}</span>
            <p className="game-fun font-bold leading-tight">{res.title}</p>
          </div>
          {res.lines.map((l) => (
            <p key={l} className={cn("game-fun text-xs mt-1 rounded-lg px-2 py-1", res.tone === "info" ? "bg-slate-100" : "bg-black/15")}>
              {l}
            </p>
          ))}
          {mine && (
            <button
              onClick={() => {
                sfx.click();
                act({ type: "next" }, meIdx);
              }}
              className="game-btn bg-yellow-300 text-slate-900 w-full mt-2 py-2"
            >
              Next turn ▶
            </button>
          )}
        </div>
      </div>
    );
  }

  const meP = meIdx >= 0 ? g.players[meIdx] : null;

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "linear-gradient(180deg,#7dd3fc 0%,#bae6fd 45%,#fef3c7 100%)" }}>
      <style>{CSS}</style>
      {/* drifting clouds */}
      {[0, 1, 2].map((k) => (
        <div
          key={k}
          className="absolute pointer-events-none flex"
          style={{ top: 70 + k * 46, left: 0, animation: `sgm-cloud ${38 + k * 11}s linear ${-k * 13}s infinite`, opacity: 0.85 }}
        >
          {[0, 1, 2].map((j) => (
            <span key={j} className="block bg-white" style={{ width: 24, height: j === 1 ? 24 : 15, marginTop: j === 1 ? 0 : 9, boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.06)" }} />
          ))}
        </div>
      ))}

      {/* HUD */}
      <div className="relative z-10 flex items-stretch gap-2 p-2 sm:p-3">
        <div className="flex-1 min-w-0 bg-white/95 rounded-2xl game-panel px-3 py-1.5 flex items-center gap-2">
          <img src={STEMBOTS.timothy.avatar} alt="" className="w-9 h-9 object-contain shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <p className="game-pixel text-[8px] text-slate-500">
              ROUND {g.round}/{ROUNDS}
            </p>
            <p className="game-fun font-bold text-slate-900 text-sm leading-tight truncate">
              {g.phase === "over" ? "Game over! Who's the richest?" : myTurn ? "Your turn!" : `${curName}'s turn`}
            </p>
            <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden w-full max-w-40">
              <div className="h-full bg-gradient-to-r from-rose-500 to-amber-400 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>
        {meP && (
          <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-2 sm:px-3 py-1.5 flex flex-col items-center justify-center sm:min-w-[92px]">
            <span className="text-[9px] font-bold text-emerald-300 flex items-center gap-1">
              <Coins size={11} /> CASH
            </span>
            <span className="game-pixel text-[10px] text-emerald-300 mt-0.5">{fmt(meP.cash)}</span>
          </div>
        )}
        <div className="bg-slate-900/85 text-white rounded-2xl game-panel px-2 sm:px-3 py-1.5 flex flex-col items-center justify-center sm:min-w-[70px]">
          <span className="text-[9px] font-bold text-amber-300">SCORE</span>
          <span className="game-pixel text-sm text-yellow-300">{score}</span>
        </div>
      </div>

      {/* Body */}
      <div className={cn("relative z-[1] flex-1 min-h-0 flex", wide ? "flex-row" : "flex-col")}>
        {!wide && <div className="px-2 pb-1 relative z-10">{playersPanel}</div>}
        <div ref={boardRef} className="relative flex-1 min-h-0 min-w-0" style={{ isolation: "isolate" }}>
          {board}
          {wide && botBubble && cur && (
            <div
              key={`${g.turn}-${botBubble}`}
              className="absolute right-2 z-30 game-bounce-in pointer-events-none"
              style={{ top: 10 + g.turn * 50, width: 180 }}
            >
              <div
                className="relative bg-white rounded-2xl px-3 py-2 game-fun font-bold text-slate-800 text-[13px] leading-tight"
                style={{ border: `3px solid ${colorOf(g.turn)}`, boxShadow: "0 4px 0 rgba(0,0,0,0.2)" }}
              >
                {botBubble}
                <span
                  className="absolute top-1/2 -right-[9px] -translate-y-1/2 w-3.5 h-3.5 rotate-45 bg-white"
                  style={{ borderTop: `3px solid ${colorOf(g.turn)}`, borderRight: `3px solid ${colorOf(g.turn)}` }}
                />
              </div>
            </div>
          )}
          {toast && (
            <div
              key={toast.key}
              className={cn(
                "absolute left-1/2 top-[38%] z-30 game-pixel text-lg px-4 py-2 rounded-2xl game-panel whitespace-nowrap pointer-events-none",
                toast.good ? "bg-yellow-300 text-slate-900" : "bg-rose-500 text-white",
              )}
              style={{ animation: "sgm-toast 1.6s ease-out both" }}
            >
              {toast.text}
            </div>
          )}
        </div>
        <div className={cn("relative z-10 flex flex-col gap-2", wide ? "w-[268px] shrink-0 p-2 pl-0 overflow-y-auto" : "p-2 pt-0 max-h-[52%] overflow-y-auto")}>
          {wide && playersPanel}
          {card}
        </div>
      </div>
    </div>
  );
}

function BotCard({ avatar, name, color, text, small }: { avatar: string; name: string; color: string; text: string; small?: boolean }) {
  return (
    <div className="flex items-end gap-2 game-bounce-in">
      <img src={avatar} alt="" className={cn("object-contain shrink-0 game-float", small ? "w-10 h-10" : "w-14 h-14")} style={{ filter: `drop-shadow(0 3px 0 ${color})` }} />
      <div className="relative bg-white rounded-2xl game-panel px-3 py-2 flex-1 min-w-0">
        <p className="game-pixel text-[8px]" style={{ color }}>
          {name.toUpperCase()}
        </p>
        <p className="game-fun font-bold text-slate-800 text-sm leading-tight">{text}</p>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  pre,
  picked,
  onPick,
  onSkip,
  compact,
  cash,
  narrow,
}: {
  q: Question;
  pre: string[];
  picked: number | null;
  onPick?: (i: number) => void;
  onSkip?: () => void;
  compact?: boolean;
  cash?: number;
  narrow?: boolean;
}) {
  const t = TILES[q.tile];
  const [mine, setMine] = useState<number | null>(null);
  const show = picked !== null;
  return (
    <div className={cn("bg-indigo-600 text-white rounded-2xl game-panel game-bounce-in", compact ? "p-2" : "p-3")}>
      {pre.map((l) => (
        <p key={l} className="text-[11px] bg-black/20 rounded-lg px-2 py-1 mb-1.5 game-fun">
          {l}
        </p>
      ))}
      <div className="flex items-center gap-2">
        <span className={compact ? "text-lg" : "text-2xl"}>{t.emoji}</span>
        <div className="min-w-0">
          <p className="game-pixel text-[8px] text-indigo-200 truncate">{q.title.toUpperCase()}</p>
          <p className={cn("game-fun font-bold leading-tight", compact ? "text-sm" : "text-base")}>{q.prompt}</p>
        </div>
      </div>
      {!compact && <p className="text-xs text-indigo-100 mt-1 game-fun">{q.ask}</p>}
      <div className={cn("grid gap-1.5 mt-2", compact || narrow ? "grid-cols-3" : "grid-cols-1")}>
        {q.options.map((o, i) => (
          <button
            key={i}
            disabled={!onPick || mine !== null || show}
            onClick={() => {
              setMine(i);
              onPick?.(i);
            }}
            className={cn(
              "game-btn game-pixel",
              compact ? "text-[9px] px-1 py-1.5" : narrow ? "text-[10px] px-1 py-2" : "text-xs py-2.5",
              !show && "bg-white text-indigo-700",
              show && i === q.answer && "bg-emerald-400 text-white !opacity-100",
              show && i === picked && i !== q.answer && "bg-rose-500 text-white game-shake !opacity-100",
              show && i !== q.answer && i !== picked && "bg-white/40 text-indigo-900",
              !onPick && !show && "!opacity-100",
            )}
          >
            {fmt(o)}
          </button>
        ))}
      </div>
      {onSkip && (
        <div className="flex items-center justify-between mt-2 text-[11px] text-indigo-100">
          <span>You have {fmt(cash ?? 0)}</span>
          <button onClick={onSkip} disabled={mine !== null} className="underline font-bold hover:text-white">
            Skip, don't buy
          </button>
        </div>
      )}
    </div>
  );
}
