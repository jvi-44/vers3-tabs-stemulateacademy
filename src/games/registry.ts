// Every lesson game, keyed by its lesson beat id.

import { DropDash } from "./DropDash";
import { RoomDesigner } from "./RoomDesigner";
import { SgMonopoly } from "./SgMonopoly";
import { AsteroidBlasters } from "./AsteroidBlasters";
import { BodmasTasks } from "./BodmasTasks";
import type { GameDef } from "./kit/types";

export const GAMES: GameDef[] = [
  {
    id: "mm-sci-sim",
    lessonTitle: "Minecraft Masterminds",
    title: "Drippy's Water Cycle Dash",
    tagline: "Fly a water drop through a blocky world and around the water cycle.",
    bot: "sophia",
    intro:
      "Meet Drippy, our water drop! Fly Drippy through the ocean, forest, sky, snowy peaks and rivers. At the end of each stage, fly through the right answer to move on around the water cycle!",
    howTo: [
      "Tap, click or press SPACE to flap up. Let go to fall.",
      "Dodge the blocks and grab the little water droplets.",
      "At each question gate, fly through the lane with the right answer.",
      "Timothy, Emily and Matthew fly with you. Beat their scores!",
    ],
    music: "minecraft",
    gradient: "bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-500",
    icon: "💧",
    ownBots: true,
    Component: DropDash,
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
    introByBand: {
      p12: "Villagers need new rooms! Each order says how many floor squares to build. Count the squares as you go.",
      p34: "Villagers need new rooms! Each order gives a floor area to hit. Use length × width to build it just right.",
    },
    howToByBand: {
      p12: [
        "Read each villager's order: how many squares the floor needs.",
        "Change the length and width to make the floor. Height makes the room taller.",
        "Press BUILD when your floor has the right number of squares.",
        "Special order: build 3 rooms with the same number of squares, each a different height.",
      ],
      p34: [
        "Read each villager's order: a floor area, and sometimes a height.",
        "Change the length, width and height to build the room in 3D.",
        "Press BUILD when length × width matches the order.",
        "Special order: build 3 rooms with the same floor area, each a different height.",
      ],
    },
    botSeconds: 170,
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
    introByBand: {
      p12: "Welcome to Singapore Monopoly! Buy famous places, collect rent and add up your money to become the richest player.",
      p34: "Welcome to Singapore Monopoly! Buy famous places, collect rent and use your maths on money and sales to become the richest player.",
    },
    howToByBand: {
      p12: [
        "Roll the dice and move around the board.",
        "To buy a place, add the extra dollars to its price.",
        "Wrong answers cost a $5 oops fee, but bonus questions earn cash!",
        "After 8 rounds, the richest player wins.",
      ],
      p34: [
        "Roll the dice and move around the board.",
        "To buy a place, work out the price with dollars and cents, or with dollars off in a sale.",
        "Wrong answers cost a $5 oops fee, but bonus questions earn cash!",
        "After 8 rounds, the richest player wins.",
      ],
    },
    music: "gameshow",
    gradient: "bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400",
    icon: "🎲",
    ownBots: true,
    Component: SgMonopoly,
  },
  {
    id: "sb-sci-sim",
    lessonTitle: "Space Busters",
    title: "Asteroid Blasters",
    tagline: "Guard the ship with your crew by blasting the asteroids that carry the right answer.",
    bot: "emily",
    intro:
      "Asteroids are heading for our ship, and each one carries an answer! Blast the rocks that answer the forces and energy question. Careful, hitting a wrong answer shakes the ship!",
    howTo: [
      "Read the question at the top of the screen.",
      "Tap an asteroid to walk under it and fire. Arrow keys walk, SPACE fires.",
      "Blast the asteroid with the RIGHT answer. Wrong ones lose points.",
      "Sophia, Timothy and Matthew guard the deck with you. Beat their scores!",
    ],
    music: "space",
    gradient: "bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500",
    icon: "☄️",
    ownBots: true,
    Component: AsteroidBlasters,
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
    introByBand: {
      p12: "Emergency! The impostor broke our ship. Each repair is a sum. Fix all the systems before the sabotage meter fills up!",
    },
    howToByBand: {
      p12: [
        "Tap a room (or use the arrow keys) to walk there. The task opens when you arrive.",
        "Solve the sum. Do brackets first; otherwise go from left to right.",
        "Wrong answers fill the sabotage meter. Fix everything before it's full!",
        "At the end, spot the impostor whose working goes the wrong way for a big bonus.",
      ],
      p34: [
        "Tap a room (or use the arrow keys) to walk there. The task opens when you arrive.",
        "Solve the sum: brackets first, then × and ÷, then + and −.",
        "Wrong answers fill the sabotage meter. Fix everything before it's full!",
        "At the end, spot the impostor whose working breaks the rules for a big bonus.",
      ],
    },
    botSeconds: 200,
    Component: BodmasTasks,
  },
];

export const GAMES_BY_ID: Record<string, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g]));
