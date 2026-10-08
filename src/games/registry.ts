// Every lesson game, keyed by its lesson beat id.

import { TerrariumBuilder } from "./TerrariumBuilder";
import { RoomDesigner } from "./RoomDesigner";
import { SgMonopoly } from "./SgMonopoly";
import { RocketLaunch } from "./RocketLaunch";
import { BodmasTasks } from "./BodmasTasks";
import type { GameDef } from "./kit/types";

export const GAMES: GameDef[] = [
  {
    id: "mm-sci-sim",
    lessonTitle: "Minecraft Masterminds",
    title: "Minecraft Terrarium Builder",
    tagline: "Build a mini ecosystem in a jar and watch the water cycle.",
    bot: "sophia",
    intro: "I love terrariums! Let's build three tiny worlds in jars: a forest, a desert and a swamp. Then we'll seal them and watch the water cycle keep them alive!",
    howTo: [
      "Fill each jar from the bottom up: rocks, then perlite, then the right soil.",
      "Pick the 3 things that belong in that biome.",
      "Put the lid on, then name each stage of the water cycle as it happens.",
      "Right first time = more points. Build all 3 jars for a top score!",
    ],
    music: "minecraft",
    gradient: "bg-gradient-to-br from-emerald-500 via-lime-500 to-sky-500",
    icon: "🫙",
    Component: TerrariumBuilder,
  },
  {
    id: "mm-math-sim",
    lessonTitle: "Minecraft Masterminds",
    title: "Minecraft Room Designer",
    tagline: "Build rooms to order using area and volume.",
    bot: "matthew",
    intro: "Villagers need new rooms! Each order gives an area or volume to hit. Use length × width × height to build it just right.",
    howTo: [
      "Read each villager's order: a floor area, a volume, or both.",
      "Change the length, width and height to build the room in 3D.",
      "Press BUILD when your numbers match the order.",
      "Fast, correct builds keep your combo going for more points.",
      "Special order: build 3 rooms with the same floor area. Are their volumes the same?",
    ],
    music: "builder",
    gradient: "bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-500",
    icon: "🏗️",
    Component: RoomDesigner,
  },
  {
    id: "mi-math-sim",
    lessonTitle: "Mission Millionaire",
    title: "Singapore-themed Monopoly",
    tagline: "Roll, buy landmarks, and work out GST and discounts.",
    bot: "timothy",
    intro: "Welcome to Singapore Monopoly! Buy famous places, collect rent and use your maths on GST and discounts to become the richest player.",
    howTo: [
      "Roll the dice and move around the board.",
      "To buy a place, work out the real price with 9% GST or a sale discount.",
      "Wrong answers cost a $5 oops fee, but bonus questions earn cash!",
      "After 8 rounds, the richest player wins.",
    ],
    music: "gameshow",
    gradient: "bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400",
    icon: "🎲",
    ownBots: true,
    Component: SgMonopoly,
  },
  {
    id: "sb-sci-sim",
    lessonTitle: "Space Busters",
    title: "Launching a Spaceship",
    tagline: "Build a rocket, beat gravity, and dodge asteroids to reach Mars.",
    bot: "emily",
    intro: "Our crew needs to get to space! Build a rocket strong enough to beat gravity, with enough fuel to get there. Then fly it past the asteroids!",
    howTo: [
      "Add ENGINES until the green thrust bar is bigger than the red weight bar.",
      "Add FUEL TANKS until there's enough fuel to reach the planet.",
      "Press LAUNCH, then tap LEFT and RIGHT to dodge asteroids and grab stars.",
      "Answer the space question at the end. Three missions: Earth orbit, the Moon and Mars!",
    ],
    music: "space",
    gradient: "bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500",
    icon: "🚀",
    Component: RocketLaunch,
  },
  {
    id: "sb-math-sim",
    lessonTitle: "Space Busters",
    title: "Among Us Tasks as BODMAS",
    tagline: "Fix the ship with BODMAS before the impostor wins.",
    bot: "matthew",
    intro: "Emergency! The impostor broke our ship. Each repair is a BODMAS puzzle. Fix all the systems before the sabotage meter fills up!",
    howTo: [
      "Tap a room (or use the arrow keys) to walk there. The task opens when you arrive.",
      "Solve the BODMAS question: Brackets, Orders, Divide and Multiply, then Add and Subtract.",
      "Wrong answers fill the sabotage meter. Fix everything before it's full!",
      "At the end, spot the impostor whose working breaks BODMAS for a big bonus.",
    ],
    music: "spaceship",
    gradient: "bg-gradient-to-br from-slate-700 via-red-600 to-rose-500",
    icon: "🛠️",
    Component: BodmasTasks,
  },
];

export const GAMES_BY_ID: Record<string, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g]));
