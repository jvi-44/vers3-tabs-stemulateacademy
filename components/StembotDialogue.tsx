import { Star } from "lucide-react";
import { STEMBOTS } from "../data/mock";

function AtomIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.6" transform="rotate(120 12 12)" />
    </svg>
  );
}

/** Picks a STEMbot to "host" a beat, based on subject — Sophia for science,
 * Matthew for math, otherwise whichever bot fits the vibe (Timothy for
 * intros/tech-flavoured beats, Emily for hands-on builds/games). */
export function botFor(subject: "science" | "math" | null, type?: string) {
  if (subject === "science") return STEMBOTS.sophia;
  if (subject === "math") return STEMBOTS.matthew;
  if (type === "simulation") return STEMBOTS.emily;
  return STEMBOTS.timothy;
}

export function StembotDialogue({
  bot,
  children,
  xp,
  atoms,
}: {
  bot: { name: string; avatar: string; color: string };
  children: React.ReactNode;
  xp?: number;
  atoms?: number;
}) {
  return (
    <div className="flex items-start gap-3 bg-card border border-border rounded-3xl p-4 shadow-sm">
      <div className="w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-border shrink-0">
        <img src={bot.avatar} alt={bot.name} className="w-full h-full object-contain p-0.5" />
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black mb-0.5 ${bot.color}`}>{bot.name} says:</p>
        <p className="text-sm text-foreground leading-snug">{children}</p>
        {(xp || atoms) && (
          <div className="flex items-center gap-2 mt-2">
            {!!xp && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 px-2 py-0.5 rounded-full">
                <Star size={11} className="fill-amber-500 text-amber-500" /> +{xp} XP
              </span>
            )}
            {!!atoms && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-300 px-2 py-0.5 rounded-full">
                <AtomIcon size={11} /> +{atoms} Atoms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
