import { useEffect, useRef, useState } from "react";
import { sfx } from "../../games/kit/audio";
import { Art, type ArtName } from "../../games/kit/Art";
import type { GameResult } from "../types";
import { HelperTip, Hud, Meter, MiniGameFrame, Pill, useFrame, type MiniGameProps } from "./kit";

// Needs vs wants: move the piggy-bank basket to catch coins and things you NEED,
// and dodge the splurges that drain your savings.

interface Kind {
  art: ArtName;
  label: string;
  value: number;
  good: boolean;
}

const KINDS: Kind[] = [
  { art: "coin", label: "+$10", value: 10, good: true },
  { art: "coin", label: "+$10", value: 10, good: true },
  { art: "food", label: "Food", value: 6, good: true },
  { art: "bus", label: "Bus fare", value: 6, good: true },
  { art: "house", label: "Rent", value: 6, good: true },
  { art: "boat", label: "Yacht", value: -15, good: false },
  { art: "gem", label: "Diamonds", value: -15, good: false },
  { art: "party", label: "Mega party", value: -12, good: false },
  { art: "plane", label: "Private jet", value: -15, good: false },
];

const SECONDS = 30;
const GOAL = 100;
const BASKET_W = 0.2; // fraction of width

interface Drop {
  id: number;
  kind: Kind;
  x: number; // 0..1
  y: number; // 0..1
  speed: number;
}

export function BudgetCatch({ onDone, helper }: MiniGameProps) {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [basket, setBasket] = useState(0.5);
  const [savings, setSavings] = useState(20);
  const [time, setTime] = useState(SECONDS);
  const [flash, setFlash] = useState<{ text: string; good: boolean; x: number; id: number } | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const st = useRef({ drops: [] as Drop[], basket: 0.5, savings: 20, spawn: 0, id: 0, time: SECONDS, keys: { l: false, r: false } });

  useFrame((dt) => {
    const s = st.current;
    s.time = Math.max(0, s.time - dt);
    // Keyboard steering.
    if (s.keys.l) s.basket = Math.max(BASKET_W / 2, s.basket - dt * 1.3);
    if (s.keys.r) s.basket = Math.min(1 - BASKET_W / 2, s.basket + dt * 1.3);

    s.spawn -= dt;
    if (s.spawn <= 0) {
      const elapsed = SECONDS - s.time;
      s.spawn = Math.max(0.45, 0.9 - elapsed * 0.015);
      const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
      s.drops.push({ id: s.id++, kind, x: 0.08 + Math.random() * 0.84, y: -0.08, speed: 0.32 + Math.random() * 0.12 + elapsed * 0.006 });
    }

    const kept: Drop[] = [];
    for (const d of s.drops) {
      d.y += d.speed * dt;
      if (d.y >= 0.84 && d.y <= 0.94 && Math.abs(d.x - s.basket) < BASKET_W / 2 + 0.04) {
        s.savings = Math.max(0, Math.min(GOAL, s.savings + d.kind.value));
        if (d.kind.good) sfx.coin();
        else sfx.wrong();
        setFlash({ text: d.kind.good ? `${d.kind.label} ✓` : `${d.kind.label} −$${-d.kind.value}`, good: d.kind.good, x: d.x, id: d.id });
        if (!d.kind.good) setTip(`A ${d.kind.label.toLowerCase()} is a WANT, not a need. Dodge it!`);
        continue;
      }
      if (d.y < 1.1) kept.push(d);
    }
    s.drops = kept;

    setDrops([...kept]);
    setBasket(s.basket);
    setSavings(s.savings);
    setTime(s.time);

    if (s.time <= 0 || s.savings >= GOAL) {
      const won = s.savings >= 70;
      setResult({ won, score: Math.round(s.savings) });
    }
  }, playing && !result);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") st.current.keys.l = true;
      if (e.key === "ArrowRight" || e.key === "d") st.current.keys.r = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") st.current.keys.l = false;
      if (e.key === "ArrowRight" || e.key === "d") st.current.keys.r = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const steer = (clientX: number) => {
    const el = area.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    st.current.basket = Math.max(BASKET_W / 2, Math.min(1 - BASKET_W / 2, x));
  };

  return (
    <MiniGameFrame
      title="Budget Catch"
      result={result}
      onDone={onDone}
      onPlaying={setPlaying}
      howTo={
        <>
          <p>Money is raining down! Fill your savings jar.</p>
          <p>
            Drag (or use ← →) to catch <b>coins</b> and <b>needs</b> like food, bus fare and rent. Dodge the <b>wants</b> like yachts and
            diamonds! Reach $70 in savings to win.
          </p>
        </>
      }
    >
      <div
        ref={area}
        className="absolute inset-0 touch-none select-none overflow-hidden"
        onPointerMove={(e) => steer(e.clientX)}
        onPointerDown={(e) => steer(e.clientX)}
      >
        <Hud>
          <Pill>{Math.ceil(time)}s</Pill>
          <div className="flex-1 min-w-0">
            <Meter value={savings} max={GOAL} color="linear-gradient(90deg,#22c55e,#facc15)" label="Savings" />
          </div>
          <Pill className="bg-[#bbf7d0]">${Math.round(savings)}</Pill>
        </Hud>

        {drops.map((d) => (
          <div
            key={d.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
          >
            <div
              className={`rounded-xl border-[3px] p-1 shadow-[2px_2px_0_#1f1a17] ${d.kind.good ? "border-[#1f1a17] bg-white" : "border-[#b91c1c] bg-[#fee2e2]"}`}
            >
              <Art name={d.kind.art} size={34} />
            </div>
            <span
              className={`mt-0.5 rounded-md px-1 text-[10px] sm:text-xs font-black ${d.kind.good ? "bg-[#bbf7d0] text-[#14532d]" : "bg-[#fecaca] text-[#7f1d1d]"}`}
            >
              {d.kind.label}
            </span>
          </div>
        ))}

        {/* Piggy-bank basket */}
        <div className="absolute -translate-x-1/2" style={{ left: `${basket * 100}%`, top: "86%", width: `${BASKET_W * 100}%` }}>
          <div className="mx-auto h-12 sm:h-14 rounded-b-[40%] rounded-t-lg border-[3px] border-[#1f1a17] bg-[linear-gradient(#f9a8d4,#ec4899)] shadow-[3px_3px_0_#1f1a17] grid place-items-center">
            <span className="font-display font-bold text-white text-sm sm:text-base drop-shadow-[1px_1px_0_#1f1a17]">SAVINGS</span>
          </div>
        </div>

        {flash && (
          <span
            key={flash.id}
            className={`ep-float absolute -translate-x-1/2 rounded-lg border-2 border-[#1f1a17] px-2 py-0.5 text-sm font-black ${flash.good ? "bg-[#bbf7d0]" : "bg-[#fecaca]"}`}
            style={{ left: `${flash.x * 100}%`, top: "76%" }}
          >
            {flash.text}
          </span>
        )}

        <HelperTip bot={helper} text={tip} className="left-2 top-12" />
      </div>
    </MiniGameFrame>
  );
}
