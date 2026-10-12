import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowRight, Play, RotateCcw } from "lucide-react";
import { STEMBOTS } from "../data/mock";
import { useGamePlayer } from "../games/kit/player";
import { carriedFlags } from "./engine";
import { EpisodePlayer } from "./EpisodePlayer";
import { SceneArt } from "./SceneArt";
import { EPISODES } from "./stories";
import { loadChoices, rememberChoices } from "./storyChoices";
import type { Episode, Flags } from "./types";

/** Full-screen episode with the player's earlier choices loaded and new ones saved. */
export function EpisodeOverlay({
  episode,
  onFinish,
  onClose,
  finishLabel,
}: {
  episode: Episode;
  onFinish: () => void;
  onClose: () => void;
  finishLabel?: string;
}) {
  const player = useGamePlayer();
  const [carried, setCarried] = useState<Flags | null>(null);

  useEffect(() => {
    let alive = true;
    loadChoices(player.userId).then((saved) => alive && setCarried(carriedFlags(EPISODES, saved, episode)));
    return () => {
      alive = false;
    };
  }, [player.userId, episode]);

  // Stop the page behind from scrolling while the episode is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!carried) return null;
  return createPortal(
    <EpisodePlayer
      episode={episode}
      carried={carried}
      playerName={player.userId === undefined ? undefined : player.name}
      onClose={onClose}
      finishLabel={finishLabel}
      onFinish={(flags) => {
        rememberChoices(player.userId, episode.beatId, flags);
        onFinish();
      }}
    />,
    document.body,
  );
}

/** The Intro Story checkpoint in a lesson: a poster that launches the episode. */
export function IntroEpisodeCard({ episode, done, onFinish }: { episode: Episode; done: boolean; onFinish: () => void }) {
  const [open, setOpen] = useState(false);
  const first = episode.nodes[episode.start];
  return (
    <div className="space-y-4">
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        className="group relative block w-full overflow-hidden rounded-[1.75rem] border-[3px] border-ink shadow-[0_6px_0_var(--ink-line)] aspect-[16/10] sm:aspect-[16/8] text-left"
      >
        <SceneArt scene={first.scene} screen={first.screen} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute left-0 right-0 bottom-0 p-4 sm:p-6 text-white">
          <span className="inline-block rounded-full border-2 border-[#1f1a17] bg-[#facc15] px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-[#1f1a17]">
            Episode {episode.number}
          </span>
          <h2 className="mt-2 font-display font-bold text-2xl sm:text-4xl leading-tight drop-shadow-[2px_2px_0_#1f1a17]">{episode.title}</h2>
          <p className="mt-1 max-w-lg font-semibold text-sm sm:text-base text-white/95">{episode.tagline}</p>
        </div>
        <div className="absolute right-3 top-3 sm:right-5 sm:top-5 flex -space-x-3">
          {(["sophia", "timothy", "emily", "matthew"] as const).map((b) => (
            <img key={b} src={STEMBOTS[b].avatar} alt="" className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow-md" />
          ))}
        </div>
        <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 grid place-items-center w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] border-[#1f1a17] bg-white shadow-[0_5px_0_#1f1a17] transition-transform group-hover:scale-110">
          {done ? <RotateCcw size={34} className="text-[#1f1a17]" /> : <Play size={38} className="ml-1.5 fill-[#1f1a17] text-[#1f1a17]" />}
        </span>
      </motion.button>

      <p className="text-center text-sm font-bold text-muted-foreground">
        A choose-your-own adventure with mini-games. Your choices change the story!
      </p>

      {done ? (
        <button onClick={onFinish} className="btn-pop btn-primary w-full !py-4 text-lg">
          Continue <ArrowRight size={18} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-pop btn-primary w-full !py-4 text-lg">
          <Play size={18} className="fill-current" /> Play Episode {episode.number}
        </button>
      )}

      {open && (
        <EpisodeOverlay
          episode={episode}
          onClose={() => setOpen(false)}
          onFinish={() => {
            setOpen(false);
            onFinish();
          }}
        />
      )}
    </div>
  );
}
