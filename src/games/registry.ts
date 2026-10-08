// Every lesson game, keyed by its lesson beat id.

import { WaterCycleLab } from "./WaterCycleLab";
import { RoomDesigner } from "./RoomDesigner";
import { SgMonopoly } from "./SgMonopoly";
import { RocketLaunch } from "./RocketLaunch";
import { BodmasTasks } from "./BodmasTasks";
import type { GameDef } from "./kit/types";

export const GAMES: GameDef[] = [
  {
    id: "mm-sci-sim",
    lessonTitle: "Minecraft Masterminds",
    title: "Water Cycle Biome Lab",
    tagline: "Control the weather, build biomes, save the forest.",
    bot: "sophia",
    intro: "Welcome to my lab! You control the temperature, rain and sunshine over this island. Watch the water cycle change the whole biome!",
    howTo: [
      "Drag the sliders to change temperature, rainfall and sunlight.",
      "Clear 6 missions: make biomes, survive wild weather and balance the lake.",
      "Answer the bonus water-cycle questions fast for extra points.",
      "Finish quickly for a higher score out of 100!",
    ],
    music: "minecraft",
    gradient: "bg-gradient-to-br from-emerald-500 via-lime-500 to-sky-500",
    icon: "🌦️",
    Component: WaterCycleLab,
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
    tagline: "Balance thrust, weight and fuel to reach orbit.",
    bot: "emily",
    intro: "Our ship needs to reach orbit! Pick the right fuel and cargo, then control the thrust to balance the forces and stop in the orbit zone.",
    howTo: [
      "Choose fuel and cargo before launch. More mass needs more force!",
      "Hold THRUST (or Space) to push up against gravity. Let go and gravity slows you down.",
      "Stop inside the green orbit zone and hold steady there for 2 seconds, without running out of fuel.",
      "Each planet has different gravity. Land all missions for top marks.",
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
