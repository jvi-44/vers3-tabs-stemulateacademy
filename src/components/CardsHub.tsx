import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Sparkles, X } from "lucide-react";
import { PHENOMENA_CARDS, FIGURE_CARDS, ALBUM_PACKS, RARITY_STYLE, type CollectibleCard, type Rarity } from "../data/cardData";
import { cn } from "./ui/utils";
import stemulateLogo from "../assets/stemulate_logo.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotRed from "../assets/stembot_red.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotCream from "../assets/stembot_cream.png";

function AtomIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
    </svg>
  );
}

const ALBUMS = {
  phenomena: {
    title: "Phenomena",
    blurb: "Everyday wonders, explained",
    cards: PHENOMENA_CARDS,
    book: "#2f6fe4",
    bookDark: "#1c46a3",
    bot: stembotGreen,
    emoji: "🌈",
  },
  figures: {
    title: "Famous Figures",
    blurb: "The greatest minds in STEM",
    cards: FIGURE_CARDS,
    book: "#e4572e",
    bookDark: "#a3361a",
    bot: stembotCream,
    emoji: "🧪",
  },
} as const;

type AlbumKey = keyof typeof ALBUMS;

// Look of each foil pack.
const PACK_LOOK: Record<string, { a: string; b: string; bot: string; emoji: string }> = {
  "phen-p1": { a: "#4cc9ff", b: "#2563eb", bot: stembotBlue, emoji: "💡" },
  "phen-p2": { a: "#b794ff", b: "#5b21b6", bot: stembotGreen, emoji: "🔮" },
  "fig-p1": { a: "#ffd23f", b: "#f2701d", bot: stembotCream, emoji: "🧪" },
  "fig-p2": { a: "#ff7a95", b: "#b3123b", bot: stembotRed, emoji: "👑" },
};

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];
const RARITY_CHIP: Record<Rarity, string> = {
  common: "bg-slate-200 text-slate-700",
  rare: "bg-sky-300 text-sky-950",
  epic: "bg-purple-300 text-purple-950",
  legendary: "bg-amber-300 text-amber-950",
};

// Zig-zag crimp along the top and bottom of a foil pack.
const PACK_CLIP = (() => {
  const teeth = 16;
  const d = 2.4; // tooth depth, in % of height
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    top.push(`${x}% ${i % 2 ? d : 0}%`);
    bottom.unshift(`${x}% ${100 - (i % 2 ? d : 0)}%`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
})();

/** Pointer-driven 3D tilt. Writes CSS variables straight onto the element so
 *  moving the mouse never re-renders React. */
function useTilt(max = 14) {
  const ref = useRef<HTMLDivElement>(null);
  const onPointerMove = (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    el.style.setProperty("--lift", "18px");
  };
  const onPointerLeave = () => {
    const el = ref.current;
    if (!el) return;
    ["--rx", "--ry", "--mx", "--my", "--lift"].forEach((v) => el.style.removeProperty(v));
  };
  return { ref, onPointerMove, onPointerLeave };
}

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div className="flip-face back card-back">
      <div
        className={cn(
          "rounded-full bg-white border-[3px] border-ink flex items-center justify-center shadow-[0_4px_0_var(--ink-line)]",
          small ? "w-12 h-12" : "w-20 h-20",
        )}
      >
        <img src={stemulateLogo} alt="" className={small ? "w-8 h-8" : "w-14 h-14"} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Album book (cover view)
// ---------------------------------------------------------------------------

function AlbumBook({
  albumKey,
  owned,
  ownedCounts,
  onOpen,
}: {
  albumKey: AlbumKey;
  owned: number;
  ownedCounts: Record<string, number>;
  onOpen: () => void;
}) {
  const album = ALBUMS[albumKey];
  const peek = album.cards.filter((c) => (ownedCounts[c.id] ?? 0) > 0).slice(0, 3);
  return (
    <button
      onClick={onOpen}
      className="book-scene group max-w-[340px] sm:max-w-none mx-auto"
      aria-label={`Open the ${album.title} album`}
      style={{ "--book": album.book, "--book-dark": album.bookDark } as CSSProperties}
    >
      <div className="book">
        <div className="book-shadow" />
        <div className="book-back" />
        <div className="book-spine" />
        <div className="book-edge" />
        <div className="book-edge-bottom" />
        {/* First page, seen when the cover swings open */}
        <div className="book-page p-[8%] pl-[14%]">
          <div className="grid grid-cols-2 gap-2 h-full content-start">
            {[0, 1, 2, 3].map((i) =>
              peek[i] ? (
                <img key={i} src={peek[i].front} alt="" className="w-full rounded-md shadow-md" style={{ rotate: `${i % 2 ? 3 : -3}deg` }} />
              ) : (
                <div key={i} className="aspect-[621/874] rounded-md border-2 border-dashed border-black/15 bg-black/[0.03]" />
              ),
            )}
          </div>
        </div>
        <div className="book-ribbon" />
        <div className="book-cover">
          <div className="book-corner tr" />
          <div className="book-corner br" />
          <div className="absolute inset-0 pl-[17%] pr-[10%] pt-[12%] pb-[10%] flex flex-col text-left">
            <span className="kicker kicker-on self-start !text-[0.62rem]">Card album</span>
            <div className="mt-3 bg-white text-[#1c1a17] rounded-2xl px-4 py-3 rotate-[-2.5deg] border-[2.5px] border-[#1c1a17] shadow-[0_5px_0_#1c1a17] self-start max-w-full">
              <p className="font-display font-bold text-[clamp(1.2rem,0.9rem+1.2vw,1.8rem)] leading-none">{album.title}</p>
              <p className="text-[11px] font-extrabold opacity-70 mt-1">{album.blurb}</p>
            </div>
            <div className="flex-1 relative">
              <img src={album.bot} alt="" className="absolute right-[-4%] bottom-0 h-[92%] max-h-44 die-cut rotate-[8deg] transition-transform group-hover:rotate-[-4deg] group-hover:scale-105" />
              <span className="absolute left-[2%] bottom-[18%] text-5xl drop-shadow-md rotate-[-12deg]">{album.emoji}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="meter flex-1 !h-3 !border-[#1c1a17]">
                <span style={{ width: `${(owned / album.cards.length) * 100}%` }} className="!bg-[#ffe066] !border-[#1c1a17]" />
              </div>
              <span className="font-display font-bold text-sm whitespace-nowrap drop-shadow">
                {owned}/{album.cards.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Foil pack
// ---------------------------------------------------------------------------

function FoilPack({
  packId,
  name,
  description,
  cardsCount,
  cost,
  affordable,
  disabled,
  onOpen,
  className,
}: {
  packId: string;
  name: string;
  description: string;
  cardsCount: number;
  cost: number;
  affordable: boolean;
  disabled: boolean;
  onOpen: () => void;
  className?: string;
}) {
  const look = PACK_LOOK[packId] ?? PACK_LOOK["phen-p1"];
  const tilt = useTilt(12);
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <button
        onClick={onOpen}
        disabled={disabled || !affordable}
        className={cn("pack-scene w-full max-w-[220px] group", !affordable && "grayscale-[0.6] opacity-70")}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        aria-label={`Open ${name} for ${cost} Atoms`}
      >
        <div className={cn(affordable && "pack-float")}>
          <div ref={tilt.ref} className="pack" style={{ "--pa": look.a, "--pb": look.b, "--pack-clip": PACK_CLIP } as CSSProperties}>
            <PackFace name={name} look={look} cardsCount={cardsCount} />
          </div>
        </div>
      </button>
      <div className="text-center">
        <p className="text-sm font-bold text-muted-foreground mb-2">{description}</p>
        <button onClick={onOpen} disabled={disabled || !affordable} className="btn-pop btn-pop-sm btn-primary">
          Open for <AtomIcon size={15} /> {cost}
        </button>
        {!affordable && <p className="text-[11px] font-extrabold text-muted-foreground mt-2">Earn more Atoms in lessons!</p>}
      </div>
    </div>
  );
}

function PackFace({
  name,
  look,
  cardsCount,
}: {
  name: string;
  look: { bot: string; emoji: string };
  cardsCount: number;
}) {
  return (
    <div className="pack-foil">
      <div className="pack-skin" style={{ "--pack-motif": "var(--motif-on)" } as CSSProperties}>
        <div className="pack-crimp top" />
        <div className="pack-crimp bottom" />
        <div className="absolute inset-x-[10%] top-[12%] flex justify-between items-center">
          <img src={stemulateLogo} alt="" className="w-8 h-8 bg-white rounded-full p-0.5 border-2 border-[#1c1a17]" />
          <span className="font-display font-bold text-white text-xs bg-black/25 rounded-full px-2 py-0.5">x{cardsCount}</span>
        </div>
        <img src={look.bot} alt="" className="absolute left-1/2 -translate-x-1/2 top-[24%] h-[42%] die-cut rotate-[-6deg]" />
        <span className="absolute right-[12%] top-[26%] text-3xl rotate-12 drop-shadow">{look.emoji}</span>
        <div className="absolute inset-x-[8%] bottom-[13%] bg-white rounded-xl border-[2.5px] border-[#1c1a17] shadow-[0_4px_0_#1c1a17] px-2 py-2 rotate-[-3deg] text-center">
          <p className="font-display font-bold text-[#1c1a17] leading-none text-[clamp(0.95rem,0.8rem+0.5vw,1.2rem)]">{name}</p>
          <p className="text-[9px] font-black tracking-[0.18em] text-[#1c1a17]/60 mt-1">STEMULATE ACADEMY</p>
        </div>
        <div className="pack-holo" />
        <div className="pack-sheen" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pack opening: shake, rip, cards fly out face-down, tap to flip each one.
// ---------------------------------------------------------------------------

function PackOpening({
  packId,
  name,
  cards,
  onDone,
}: {
  packId: string;
  name: string;
  cards: CollectibleCard[];
  onDone: () => void;
}) {
  const look = PACK_LOOK[packId] ?? PACK_LOOK["phen-p1"];
  const [stage, setStage] = useState<"charge" | "rip" | "cards">("charge");
  const [flipped, setFlipped] = useState<boolean[]>(() => cards.map(() => false));
  const allFlipped = flipped.every(Boolean);
  const best = useMemo(
    () => cards.reduce<Rarity>((b, c) => (RARITY_ORDER.indexOf(c.rarity) > RARITY_ORDER.indexOf(b) ? c.rarity : b), "common"),
    [cards],
  );

  const rip = () => {
    if (stage !== "charge") return;
    setStage("rip");
    confetti({ particleCount: 70, spread: 100, startVelocity: 38, origin: { y: 0.45 }, scalar: 0.9 });
    setTimeout(() => setStage("cards"), 650);
  };

  const flip = (i: number) => {
    if (flipped[i]) return;
    setFlipped((f) => f.map((v, j) => (j === i ? true : v)));
    const r = cards[i].rarity;
    if (r === "legendary") {
      confetti({ particleCount: 160, spread: 110, origin: { y: 0.5 }, colors: ["#fbbf24", "#fde68a", "#f59e0b", "#ffffff"] });
    } else if (r === "epic") {
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 }, colors: ["#a855f7", "#d8b4fe", "#ffffff"] });
    }
  };

  const n = cards.length;
  const ray = { legendary: "rgba(251,191,36,0.16)", epic: "rgba(168,85,247,0.16)", rare: "rgba(56,189,248,0.14)", common: "rgba(255,255,255,0.07)" }[
    allFlipped ? best : "common"
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#120c22]/90 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden px-4"
    >
      <div className="rays" style={{ "--ray": ray } as CSSProperties} />

      <p className="relative font-display font-bold text-white text-2xl sm:text-3xl text-center mb-6 min-h-[2.5rem]">
        {stage === "charge" && "Tap the pack to rip it open!"}
        {stage === "rip" && "Woah!"}
        {stage === "cards" && (allFlipped ? `${name}: ${n} new cards!` : "Tap each card to flip it")}
      </p>

      <div className="relative w-full flex items-center justify-center" style={{ height: "min(62vh, 420px)" }}>
        {/* The pack */}
        <AnimatePresence>
          {stage !== "cards" && (
            <motion.button
              key="pack"
              onClick={rip}
              initial={{ scale: 0.4, y: 120, rotate: -10 }}
              animate={stage === "rip" ? { scale: 1.15, y: 40, opacity: 0 } : { scale: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={stage === "rip" ? { duration: 0.6, ease: "easeIn" } : { type: "spring", stiffness: 160, damping: 14 }}
              className="relative h-full aspect-[5/7] cursor-pointer"
              aria-label="Rip open the pack"
            >
              <div className={cn("w-full h-full", stage === "charge" && "charge")}>
                <div className="pack w-full !h-full" style={{ "--pa": look.a, "--pb": look.b, "--pack-clip": PACK_CLIP } as CSSProperties}>
                  {/* Bottom part of the pack */}
                  <div className="absolute inset-0" style={{ clipPath: "inset(13% 0 0 0)" }}>
                    <PackFace name={name} look={look} cardsCount={n} />
                  </div>
                  {/* Torn-off top strip */}
                  <motion.div
                    className="absolute inset-0"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 12%, 88% 14%, 75% 11%, 62% 14.5%, 50% 11.5%, 37% 14%, 25% 11%, 12% 14%, 0 12%)" }}
                    animate={stage === "rip" ? { x: 120, y: -220, rotate: 35, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                  >
                    <PackFace name={name} look={look} cardsCount={n} />
                  </motion.div>
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* The cards fan out, face down */}
        {stage === "cards" &&
          cards.map((c, i) => {
            const offset = i - (n - 1) / 2;
            return (
              <motion.button
                key={i}
                onClick={() => flip(i)}
                initial={{ x: 0, y: 160, scale: 0.5, rotate: 0, opacity: 0 }}
                animate={{
                  x: `calc(${offset} * (min(27vw, 230px) + 2.2vw))`,
                  y: Math.abs(offset) * 16,
                  scale: 1,
                  rotate: offset * 7,
                  opacity: 1,
                }}
                transition={{ type: "spring", stiffness: 140, damping: 15, delay: i * 0.12 }}
                className="absolute w-[min(27vw,230px)] aspect-[621/874] focus:outline-none"
                style={{ perspective: 1000 }}
                aria-label={flipped[i] ? c.name : "Flip this card"}
              >
                <div className={cn("flip w-full !h-full", !flipped[i] && "face-down")}>
                  <div className={cn("flip-face", flipped[i] && `glow-${c.rarity}`)}>
                    <img src={c.front} alt={c.name} className="w-full h-full object-cover scale-[1.02]" />
                    {c.rarity !== "common" && <div className="holo on" />}
                  </div>
                  <CardBack />
                </div>
                {flipped[i] && (
                  <motion.span
                    initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: -6 }}
                    transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.35 }}
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 font-display font-bold text-xs sm:text-sm px-3 py-1 rounded-full border-2 border-[#1c1a17] shadow-[0_3px_0_#1c1a17] whitespace-nowrap",
                      RARITY_CHIP[c.rarity],
                    )}
                  >
                    {RARITY_STYLE[c.rarity].label}
                    {c.rarity === "legendary" && "!"}
                  </motion.span>
                )}
                {!flipped[i] && (
                  <span className="absolute inset-0 rounded-[14px] ring-4 ring-white/0 hover:ring-white/60 transition" />
                )}
              </motion.button>
            );
          })}
      </div>

      <div className="relative mt-8 flex gap-3 min-h-[3rem]">
        {stage === "cards" && !allFlipped && (
          <button onClick={() => cards.forEach((_, i) => setTimeout(() => flip(i), i * 250))} className="btn-pop">
            <Sparkles size={16} /> Flip them all
          </button>
        )}
        {stage === "cards" && allFlipped && (
          <motion.button initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={onDone} className="btn-pop btn-primary text-lg">
            Add to my album
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Collection: card sleeves in a binder
// ---------------------------------------------------------------------------

function CollectionCard({ card, count, number, onClick }: { card: CollectibleCard; count: number; number: number; onClick: () => void }) {
  const tilt = useTilt(16);
  const owned = count > 0;
  if (!owned) {
    return (
      <div className="sleeve flex flex-col items-center justify-center gap-1.5">
        <span className="sleeve-mark">?</span>
        <span className="chip-ink !text-[10px] !py-0.5 !px-2 !shadow-none">#{String(number).padStart(2, "0")}</span>
      </div>
    );
  }
  return (
    <button onClick={onClick} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} className="relative block w-full" aria-label={card.name}>
      <div ref={tilt.ref} className={cn("tilt relative rounded-[14px] overflow-hidden aspect-[621/874]", `glow-${card.rarity}`, card.rarity === "legendary" && "!animate-none")}>
        <img src={card.front} alt="" className="w-full h-full object-cover" />
        <div className={cn("holo", card.rarity !== "common" && "on !opacity-40")} />
        <div className="glare" />
      </div>
      {count > 1 && (
        <span className="absolute -top-2 -right-2 chip-ink !text-[11px] !px-2 !py-0 bg-pop-2 text-[#1b1b12]">x{count}</span>
      )}
    </button>
  );
}

function CardViewer({ card, count, onClose }: { card: CollectibleCard; count: number; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const tilt = useTilt(10);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#120c22]/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 gap-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.6, rotateY: -90 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
        className="w-[min(78vw,340px)]"
        style={{ perspective: 1200 }}
        onClick={(e) => {
          e.stopPropagation();
          setFlipped((f) => !f);
        }}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
      >
        <div ref={tilt.ref} className="tilt">
          <div className={cn("flip cursor-pointer", flipped && "face-down")}>
            <div className={cn("flip-face", `glow-${card.rarity}`)}>
              <img src={card.front} alt={card.name} className="w-full h-full object-cover" />
              <div className={cn("holo", card.rarity !== "common" && "on")} />
              <div className="glare" />
            </div>
            <div className={cn("flip-face back", `glow-${card.rarity}`)}>
              <img src={card.back} alt={`${card.name}, back`} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </motion.div>
      <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className={cn("chip-ink !text-xs", RARITY_CHIP[card.rarity])}>{RARITY_STYLE[card.rarity].label}</span>
        {count > 1 && <span className="chip-ink !text-xs">You have {count}</span>}
        <button onClick={() => setFlipped((f) => !f)} className="btn-pop btn-pop-sm">
          <RotateCcw size={15} /> Flip
        </button>
        <button onClick={onClose} className="btn-pop btn-pop-sm" aria-label="Close">
          <X size={15} /> Close
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Cards page
// ---------------------------------------------------------------------------

export function CardsHub({
  ownedCounts,
  userAtoms,
  onOpenPack,
}: {
  ownedCounts: Record<string, number>;
  userAtoms: number;
  onOpenPack: (albumKey: AlbumKey, packId: string) => Promise<CollectibleCard[] | null>;
}) {
  const [view, setView] = useState<"covers" | AlbumKey>("covers");
  const [opening, setOpening] = useState<{ packId: string; name: string; cards: CollectibleCard[] } | null>(null);
  const [viewingCard, setViewingCard] = useState<CollectibleCard | null>(null);
  const [rarityFilter, setRarityFilterState] = useState<Rarity | "all">("all");
  const [page, setPage] = useState(0);
  const setRarityFilter = (r: Rarity | "all") => {
    setRarityFilterState(r);
    setPage(0);
  };

  const ownedIn = (key: AlbumKey) => ALBUMS[key].cards.filter((c) => (ownedCounts[c.id] ?? 0) > 0).length;

  // The server pays for and rolls the pack; ignore clicks while one is opening.
  const [buying, setBuying] = useState(false);
  const openPack = async (albumKey: AlbumKey, packId: string, name: string) => {
    if (buying) return;
    setBuying(true);
    const drawn = await onOpenPack(albumKey, packId).catch(() => null);
    setBuying(false);
    if (drawn && drawn.length > 0) setOpening({ packId, name, cards: drawn });
  };

  const atomsChip = (
    <div className="chip-ink bg-soft-3 text-base rotate-[2deg]" title="Your Atoms">
      <AtomIcon size={17} className="text-pop-3" /> {userAtoms.toLocaleString()}
    </div>
  );

  if (view === "covers") {
    const total = PHENOMENA_CARDS.length + FIGURE_CARDS.length;
    const ownedTotal = ownedIn("phenomena") + ownedIn("figures");
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="kicker">Collect them all · {ownedTotal}/{total}</span>
            <h1 className="font-display text-foreground !text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] mt-3 mb-1">Your card albums</h1>
            <p className="text-muted-foreground font-semibold">Spend Atoms on packs, then fill every page of your albums.</p>
          </div>
          <div className="sm:hidden">{atomsChip}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 max-w-4xl mx-auto">
          {(Object.keys(ALBUMS) as AlbumKey[]).map((key) => (
            <AlbumBook key={key} albumKey={key} owned={ownedIn(key)} ownedCounts={ownedCounts} onOpen={() => setView(key)} />
          ))}
        </div>
      </div>
    );
  }

  const album = ALBUMS[view];
  const packs = ALBUM_PACKS[view];
  const owned = ownedIn(view);
  const shown = album.cards.map((c, i) => ({ card: c, number: i + 1 })).filter(({ card }) => rarityFilter === "all" || card.rarity === rarityFilter);
  // The album shows one page of 8 pockets (4 x 2) at a time, like a real binder.
  const PER_PAGE = 8;
  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const pageCards = shown.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <div className="w-full space-y-7">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setView("covers")} className="btn-pop btn-pop-sm">
          <ArrowLeft size={16} /> All albums
        </button>
        {atomsChip}
      </div>

      {/* Album header strip, in the album's own colour */}
      <section
        className="relative overflow-hidden rounded-[2rem] border-[2.5px] border-ink shadow-[0_6px_0_var(--ink-line)] px-6 py-6 sm:px-8 text-white"
        style={{ backgroundColor: album.book, backgroundImage: "var(--motif-on)", backgroundSize: "200px 200px" }}
      >
        <img src={album.bot} alt="" className="absolute right-4 sm:right-10 -bottom-6 h-36 die-cut rotate-[8deg] hidden sm:block bob" />
        <span className="kicker kicker-on">Card album</span>
        <h1 className="font-display !text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] mt-3 mb-1">{album.title}</h1>
        <p className="font-bold opacity-90 mb-3">
          {owned}/{album.cards.length} cards collected
        </p>
        <div className="meter max-w-sm !border-[#1c1a17]">
          <span style={{ width: `${(owned / album.cards.length) * 100}%` }} className="!bg-[#ffe066] !border-[#1c1a17]" />
        </div>
      </section>

      {/* Packs */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="font-display text-foreground !text-xl">Card packs</h2>
          <span className="kicker kicker-3">Tap a pack</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:gap-8 py-4 max-w-2xl mx-auto">
          {packs.map((pack) => (
            <FoilPack
              key={pack.id}
              packId={pack.id}
              name={pack.name}
              description={pack.description}
              cardsCount={pack.cardsCount}
              cost={pack.cost}
              affordable={userAtoms >= pack.cost}
              disabled={!!opening}
              onOpen={() => openPack(view, pack.id, pack.name)}
            />
          ))}
        </div>
      </section>

      {/* The album pages */}
      <section className="sticker binder p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="font-display text-foreground !text-xl">Album pages</h2>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...RARITY_ORDER] as const).map((r) => {
              const count = r === "all" ? owned : album.cards.filter((c) => c.rarity === r && (ownedCounts[c.id] ?? 0) > 0).length;
              const of = r === "all" ? album.cards.length : album.cards.filter((c) => c.rarity === r).length;
              if (of === 0) return null;
              return (
                <button
                  key={r}
                  onClick={() => setRarityFilter(r)}
                  className={cn(
                    "text-xs font-extrabold px-3 py-1.5 rounded-full border-2 transition-all",
                    rarityFilter === r ? "border-ink shadow-[0_3px_0_var(--ink-line)] -translate-y-0.5" : "border-transparent",
                    r === "all" ? "bg-soft-1 text-foreground" : RARITY_CHIP[r],
                  )}
                >
                  {r === "all" ? "All" : RARITY_STYLE[r].label} {count}/{of}
                </button>
              );
            })}
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${rarityFilter}-${page}`}
            initial={{ rotateY: -14, opacity: 0, x: 24 }}
            animate={{ rotateY: 0, opacity: 1, x: 0 }}
            exit={{ rotateY: 14, opacity: 0, x: -24 }}
            transition={{ duration: 0.28 }}
            className="album-page"
          >
            {pageCards.map(({ card, number }) => (
              <div key={card.id} className="album-slot">
                <CollectionCard card={card} number={number} count={ownedCounts[card.id] ?? 0} onClick={() => setViewingCard(card)} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-pop btn-pop-sm !px-3" aria-label="Previous page">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  aria-label={`Page ${i + 1}`}
                  className={cn("h-3.5 rounded-full border-2 border-ink transition-all", i === page ? "w-8 bg-primary" : "w-3.5 bg-card")}
                />
              ))}
            </div>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="btn-pop btn-pop-sm !px-3" aria-label="Next page">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {opening && <PackOpening key="opening" {...opening} onDone={() => setOpening(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewingCard && (
          <CardViewer key="viewer" card={viewingCard} count={ownedCounts[viewingCard.id] ?? 0} onClose={() => setViewingCard(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
