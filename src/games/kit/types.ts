import type { ComponentType } from "react";
import type { MusicTheme } from "./audio";
import type { LiveRoom, PlayerIdentity, RelayHandler } from "./live";

export type BotId = "sophia" | "timothy" | "emily" | "matthew";

export interface GameSummaryItem {
  label: string;
  value: string;
}

/** What the shell hands to every game while it is being played. */
export interface GameProps {
  mode: "solo" | "live";
  /** Same seed for every player in a live match, so puzzles match. */
  seed: number;
  me: PlayerIdentity;
  /** Only in live mode. */
  live?: {
    room: LiveRoom;
    isHost: boolean;
    /** Broadcast any JSON to everyone in the room (including yourself). */
    send: (data: unknown) => void;
    onRelay: (h: RelayHandler) => () => void;
  };
  /** Call as the run goes so rivals/other players see your score (0–100) and progress (0–1). */
  reportProgress: (score: number, progress: number) => void;
  /** Call once when the run ends. `score` is normalised 0–100. */
  finish: (score: number, summary?: GameSummaryItem[]) => void;
}

export interface GameDef {
  /** Lesson beat id, also the high-score key. */
  id: string;
  lessonTitle: string;
  title: string;
  tagline: string;
  bot: BotId;
  /** What the host STEMbot says on the start screen. */
  intro: string;
  howTo: string[];
  music: MusicTheme;
  /** Tailwind gradient classes for the header band. */
  gradient: string;
  /** Emoji shown on cards. */
  icon: string;
  /** The game brings its own computer opponents, so the shell adds no rival bots. */
  ownBots?: boolean;
  Component: ComponentType<GameProps>;
}
