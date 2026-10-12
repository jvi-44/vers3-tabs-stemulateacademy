// Interactive intro episodes: a first-person animated story where the player
// talks with the STEMbots, makes choices that change what happens, and plays
// mini-games along the way. Each lesson's Intro Story beat is one episode.

import type { MusicTheme } from "../games/kit/audio";

export type BotId = "sophia" | "timothy" | "emily" | "matthew";

/** Who says a line. "you" is the player (shown, never voiced); "narrator" is a caption. */
export type Speaker = BotId | "all" | "host" | "system" | "mission" | "impostor" | "you" | "narrator";

export type FlagValue = string | number | boolean;
export type Flags = Record<string, FlagValue>;

/** Every key must match. A value of `null` means "this flag is not set yet". */
export type Cond = Record<string, FlagValue | null>;

export interface Line {
  speaker: Speaker;
  text: string;
  /** Only said when these flags match (lets lines react to earlier choices). */
  when?: Cond;
}

/** First-person stage spots, from the player's point of view. */
export type Spot = "farleft" | "left" | "center" | "right" | "farright";

export interface CastMember {
  bot: BotId;
  at: Spot;
  /** How they arrive the first time they appear in a node. */
  enter?: "left" | "right" | "pop" | "drop";
  when?: Cond;
}

export type SceneId =
  | "mc-plains"
  | "mc-forest"
  | "mc-build"
  | "mc-desert"
  | "mc-biomes"
  | "mc-tundra"
  | "mc-dry"
  | "gs-stage"
  | "gs-question"
  | "gs-confetti"
  | "gs-atm"
  | "gs-city"
  | "gs-calculator"
  | "gs-dream"
  | "gs-bank"
  | "gs-board"
  | "space-calm"
  | "space-alarm"
  | "space-sun"
  | "space-cockpit"
  | "space-asteroids"
  | "space-cryo";

export type Camera = "still" | "pushIn" | "pullOut" | "panLeft" | "panRight" | "shake" | "tiltUp" | "wake";
export type Fx = "alarm" | "rain" | "snow" | "heat" | "sparkle" | "confetti" | "dim";
/** What the player is holding at the bottom of the screen. */
export type Hands = "tablet" | "pickaxe" | "buzzer" | "wrench" | "none";

export interface Shot {
  scene: SceneId;
  /** Text on in-scene screens (ATM, question board, cockpit). */
  screen?: string;
  cast?: CastMember[];
  camera?: Camera;
  fx?: Fx[];
  hands?: Hands;
}

/** Go to the first route whose `when` matches; a plain string always matches. */
export type Next = string | Array<{ when?: Cond; to: string }>;

export interface ChoiceOption {
  text: string;
  /** What the player says out loud after picking (shown as your line). */
  say?: string;
  set?: Flags;
  next: Next;
  /** Shown as a little label, Episode-style. */
  tag?: string;
  when?: Cond;
}

export type GameId = "matterSorter" | "shelterBuilder" | "buzzerRound" | "budgetCatch" | "asteroidMiner" | "thrustEscape";

export interface GameResult {
  won: boolean;
  /** 0-100 */
  score: number;
}

export type StoryNode =
  | ({ type: "talk"; lines: Line[]; next: Next } & Shot)
  | ({ type: "choice"; prompt?: Line; options: ChoiceOption[] } & Shot)
  | ({ type: "game"; game: GameId; intro?: Line[]; win: Line[]; lose: Line[]; setOnWin?: Flags; next: Next } & Shot)
  | ({ type: "end"; lines: Line[] } & Shot);

export interface Episode {
  /** The lesson's Intro Story beat id. */
  beatId: string;
  number: number;
  title: string;
  tagline: string;
  music: MusicTheme;
  start: string;
  nodes: Record<string, StoryNode>;
  /** One line per choice that mattered, for the end-of-episode recap. */
  recap: Array<{ when: Cond; text: string }>;
  /** Flags this episode writes that later episodes read (e.g. who your buddy is). */
  carries?: string[];
}
