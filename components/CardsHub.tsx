import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Package, Sparkles, X, BookOpen } from "lucide-react";
import { PHENOMENA_CARDS, FIGURE_CARDS, ALBUM_PACKS, RARITY_STYLE, type CollectibleCard } from "../data/cardData";
import { cn } from "./ui/utils";

function AtomIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
    </svg>
  );
}

const ALBUMS = {
  phenomena: { title: "Phenomena Album", cards: PHENOMENA_CARDS, cover: "from-sky-400 via-blue-500 to-indigo-500" },
  figures: { title: "Figures Album", cards: FIGURE_CARDS, cover: "from-amber-400 via-orange-500 to-rose-500" },
} as const;

type AlbumKey = keyof typeof ALBUMS;

function CardTile({
  card,
  count,
  onClick,
}: {
  card: CollectibleCard;
  count: number;
  onClick: () => void;
}) {
  const owned = count > 0;
  const style = RARITY_STYLE[card.rarity];
  return (
    <button
      onClick={onClick}
      disabled={!owned}
      className={cn(
        "relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all",
        owned ? `border-transparent shadow-lg ${style.glow} hover:scale-[1.03]` : "border-dashed border-border bg-muted",
      )}
    >
      {owned ? (
        <>
          <img src={card.front} alt={card.name} className="w-full h-full object-cover" />
          <span className={cn("absolute top-1.5 left-1.5 text-[9px] font-black text-white px-2 py-0.5 rounded-full", style.badge)}>
            {style.label}
          </span>
          {count > 1 && (
            <span className="absolute bottom-1.5 right-1.5 text-[10px] font-black text-white bg-black/60 px-1.5 py-0.5 rounded-full">
              x{count}
            </span>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
          <Package size={22} />
        </div>
      )}
    </button>
  );
}

export function CardsHub({
  ownedCounts,
  userAtoms,
  onOpenPack,
}: {
  ownedCounts: Record<string, number>;
  userAtoms: number;
  onOpenPack: (albumKey: AlbumKey, packId: string) => CollectibleCard[] | null;
}) {
  const [view, setView] = useState<"covers" | AlbumKey>("covers");
  const [unlockingPack, setUnlockingPack] = useState<{ albumKey: AlbumKey; packId: string } | null>(null);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [revealCards, setRevealCards] = useState<CollectibleCard[] | null>(null);
  const [viewingCard, setViewingCard] = useState<CollectibleCard | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);

  const startUnlock = (albumKey: AlbumKey, packId: string, cost: number) => {
    if (userAtoms < cost) return;
    setUnlockingPack({ albumKey, packId });
    setUnlockProgress(0);
    const interval = setInterval(() => {
      setUnlockProgress((p) => (p >= 100 ? p : p + 4));
    }, 40);
    setTimeout(() => {
      clearInterval(interval);
      setUnlockProgress(100);
      const drawn = onOpenPack(albumKey, packId);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      setTimeout(() => {
        setUnlockingPack(null);
        setRevealCards(drawn);
      }, 400);
    }, 1300);
  };

  if (view === "covers") {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-card border border-border rounded-3xl p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-foreground">Card Albums</h2>
            <p className="text-sm text-muted-foreground">Collect phenomena and famous figures with your Atoms.</p>
          </div>
          <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 px-3.5 py-2 rounded-full font-black text-sm shrink-0">
            <AtomIcon size={15} /> {userAtoms.toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {(Object.keys(ALBUMS) as AlbumKey[]).map((key) => {
            const album = ALBUMS[key];
            const owned = album.cards.filter((c) => (ownedCounts[c.id] ?? 0) > 0).length;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn(
                  "relative rounded-[2rem] p-8 text-white shadow-xl overflow-hidden text-left hover:scale-[1.02] transition-transform bg-gradient-to-br",
                  album.cover,
                )}
                style={{ aspectRatio: "4/3" }}
              >
                <BookOpen className="absolute -right-4 -bottom-4 opacity-20" size={140} />
                <Sparkles className="absolute top-4 right-4 opacity-60" size={20} />
                <p className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-2">Album</p>
                <h3 className="text-2xl font-black mb-1">{album.title}</h3>
                <p className="text-sm opacity-90 font-medium">
                  {owned}/{album.cards.length} collected
                </p>
                <div className="w-full h-1.5 bg-white/30 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{ width: `${(owned / album.cards.length) * 100}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const album = ALBUMS[view];
  const packs = ALBUM_PACKS[view];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={() => setView("covers")} className="text-sm font-bold text-primary hover:underline">
        ← Back to Albums
      </button>

      <div className={cn("rounded-3xl p-6 text-white shadow-md bg-gradient-to-r", album.cover)}>
        <h2 className="text-xl font-black">{album.title}</h2>
        <p className="text-sm opacity-90">
          {album.cards.filter((c) => (ownedCounts[c.id] ?? 0) > 0).length}/{album.cards.length} cards collected
        </p>
      </div>

      {/* Packs — tap to unlock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {packs.map((pack) => {
          const isUnlocking = unlockingPack?.packId === pack.id;
          return (
            <button
              key={pack.id}
              onClick={() => startUnlock(view, pack.id, pack.cost)}
              disabled={!!unlockingPack || userAtoms < pack.cost}
              className={cn(
                "relative rounded-3xl p-6 text-white shadow-sm overflow-hidden text-left bg-gradient-to-br transition-transform",
                pack.coverGradient,
                !unlockingPack && userAtoms >= pack.cost && "hover:scale-[1.02]",
                userAtoms < pack.cost && "opacity-50",
              )}
            >
              <Package className="absolute -right-2 -bottom-2 opacity-25" size={80} />
              <h3 className="text-lg font-black">{pack.name}</h3>
              <p className="text-xs opacity-90 mb-2">{pack.description}</p>
              <p className="text-xs font-bold opacity-90">{pack.cardsCount} cards · {pack.cost} Atoms</p>
              {isUnlocking && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                  <Sparkles className="animate-pulse" size={28} />
                  <div className="w-2/3 h-2 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${unlockProgress}%` }} />
                  </div>
                  <p className="text-xs font-bold">Unlocking...</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Collected cards grid */}
      <div className="bg-card rounded-3xl border border-border shadow-sm p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Your Collection</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {album.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              count={ownedCounts[card.id] ?? 0}
              onClick={() => {
                setViewingCard(card);
                setCardFlipped(false);
              }}
            />
          ))}
        </div>
      </div>

      {/* Pack reveal modal */}
      <AnimatePresence>
        {revealCards && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setRevealCards(null)}>
            <div className="max-w-2xl w-full">
              <p className="text-white text-center font-black text-lg mb-4">You got {revealCards.length} cards!</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {revealCards.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, rotateY: 180, scale: 0.7 }}
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    transition={{ delay: i * 0.18, duration: 0.5 }}
                    className={cn("rounded-2xl overflow-hidden shadow-2xl", RARITY_STYLE[c.rarity].glow)}
                  >
                    <img src={c.front} alt={c.name} className="w-full h-full object-cover" />
                  </motion.div>
                ))}
              </div>
              <p className="text-white/70 text-center text-sm mt-4">Tap anywhere to close</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Single card flip viewer */}
      <AnimatePresence>
        {viewingCard && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setViewingCard(null)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                setCardFlipped((f) => !f);
              }}
              className="relative max-w-xs w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl cursor-pointer"
            >
              <img src={cardFlipped ? viewingCard.back : viewingCard.front} alt={viewingCard.name} className="w-full h-full object-cover" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingCard(null);
                }}
                className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 text-slate-600"
              >
                <X size={16} />
              </button>
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full">
                Tap to flip
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
