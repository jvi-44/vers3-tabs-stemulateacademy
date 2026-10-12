import type { Episode } from "../types";
import { MINECRAFT_EPISODE } from "./minecraft";
import { MILLIONAIRE_EPISODE } from "./millionaire";
import { SPACE_EPISODE } from "./space";

export const EPISODES: Episode[] = [MINECRAFT_EPISODE, MILLIONAIRE_EPISODE, SPACE_EPISODE];

/** The episode that tells a lesson's Intro Story, keyed by the intro beat id. */
export const EPISODE_BY_BEAT: Record<string, Episode> = Object.fromEntries(EPISODES.map((e) => [e.beatId, e]));
