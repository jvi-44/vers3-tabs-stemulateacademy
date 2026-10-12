import type { ComponentType } from "react";
import type { BotId, GameId } from "../types";
import type { MiniGameProps } from "./kit";
import { AsteroidMiner } from "./AsteroidMiner";
import { BudgetCatch } from "./BudgetCatch";
import { BuzzerRound } from "./BuzzerRound";
import { MatterSorter } from "./MatterSorter";
import { ShelterBuilder } from "./ShelterBuilder";
import { ThrustEscape } from "./ThrustEscape";

export const MINI_GAMES: Record<GameId, ComponentType<MiniGameProps>> = {
  matterSorter: MatterSorter,
  shelterBuilder: ShelterBuilder,
  buzzerRound: BuzzerRound,
  budgetCatch: BudgetCatch,
  asteroidMiner: AsteroidMiner,
  thrustEscape: ThrustEscape,
};

/** Who helps in each game when the story hasn't paired you with anyone. */
export const DEFAULT_HELPER: Record<GameId, BotId> = {
  matterSorter: "sophia",
  shelterBuilder: "emily",
  buzzerRound: "matthew",
  budgetCatch: "matthew",
  asteroidMiner: "matthew",
  thrustEscape: "emily",
};
