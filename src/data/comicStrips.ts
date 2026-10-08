// Comic-strip versions of each lesson's introductory mini story.
// Scripts follow the "Introductory Story" section at the top of each
// curriculum plan; stage directions become caption boxes and sound effects.
// Keyed by the intro beat id in lessonContent.ts.

export type ComicBotId = "sophia" | "timothy" | "emily" | "matthew";

/** Anyone who can talk in a bubble: the four STEMbots plus off-panel voices. */
export type ComicSpeaker = ComicBotId | "host" | "system" | "mission" | "impostor" | "all";

export type BubbleKind = "speech" | "shout" | "thought";

export interface ComicBubble {
  speaker: ComicSpeaker;
  text: string;
  kind?: BubbleKind;
}

export type ComicScene =
  // Lesson 1 — Minecraft
  | "mc-plains"
  | "mc-forest"
  | "mc-build"
  | "mc-desert"
  | "mc-biomes"
  // Lesson 2 — game show + money
  | "gs-stage"
  | "gs-question"
  | "gs-confetti"
  | "gs-atm"
  | "gs-city"
  | "gs-calculator"
  | "gs-dream"
  | "gs-bank"
  | "gs-board"
  // Lesson 3 — space
  | "space-calm"
  | "space-alarm"
  | "space-sun"
  | "space-cockpit"
  | "space-asteroids";

export type ComicPose = "idle" | "bounce" | "shake" | "jump" | "tilt";

export interface ComicCastMember {
  bot: ComicBotId;
  pose?: ComicPose;
  /** Face the other way (mirror the drawing). */
  flip?: boolean;
  /** "lg" for close-ups of whoever is talking. */
  size?: "sm" | "md" | "lg";
}

export interface ComicPanel {
  scene: ComicScene;
  /** Narration box in the top corner (stage directions). */
  caption?: string;
  /** Big sound-effect lettering, e.g. "WHOOSH!". */
  sfx?: string;
  /** Text shown on in-scene screens (ATM, question board, cockpit). */
  screen?: string;
  cast: ComicCastMember[];
  bubbles: ComicBubble[];
}

export interface ComicStrip {
  title: string;
  panels: ComicPanel[];
}

const ALL_BOTS: ComicCastMember[] = [
  { bot: "sophia" },
  { bot: "timothy" },
  { bot: "emily" },
  { bot: "matthew" },
];

// ── Lesson 1: Minecraft Masterminds ──────────────────────────────────────────
const MINECRAFT_STRIP: ComicStrip = {
  title: "Minecraft Masterminds",
  panels: [
    {
      scene: "mc-plains",
      caption: "The four STEMbots land in a brand-new blocky world…",
      sfx: "WHOOSH!",
      cast: ALL_BOTS.map((c) => ({ ...c, pose: "jump" as const, size: "sm" as const })),
      bubbles: [{ speaker: "all", text: "Whoa… everything is made of blocks!", kind: "shout" }],
    },
    {
      scene: "mc-forest",
      cast: [{ bot: "sophia", size: "lg", pose: "bounce" }],
      bubbles: [
        { speaker: "sophia", text: "Welcome, students! I'm Sophia, your Science STEMbot! I study how the natural world works, from tiny atoms to giant ecosystems." },
        { speaker: "sophia", text: "And today, we're taking that knowledge into Minecraft!", kind: "shout" },
      ],
    },
    {
      scene: "mc-build",
      screen: "CRAFTING…",
      cast: [{ bot: "timothy", size: "lg", pose: "tilt" }],
      bubbles: [
        { speaker: "timothy", text: "I'm Timothy, the Technology STEMbot! Technology is all about using tools and systems to solve problems." },
        { speaker: "timothy", text: "Minecraft itself is technology: a digital tool that lets you design and build entire worlds!" },
      ],
    },
    {
      scene: "mc-build",
      sfx: "CLUNK! CLUNK!",
      cast: [{ bot: "emily", size: "lg", pose: "bounce", flip: true }],
      bubbles: [
        { speaker: "emily", text: "And I'm Emily, the Engineering STEMbot! Engineers plan and build structures that work in the real world." },
        { speaker: "emily", text: "When you craft and build in Minecraft, you're working as an engineer!" },
      ],
    },
    {
      scene: "mc-desert",
      sfx: "X:12  Y:64  Z:-7",
      cast: [{ bot: "matthew", size: "lg" }],
      bubbles: [
        { speaker: "matthew", text: "I'm Matthew, the Math STEMbot! Math is the language behind everything, including every block you place." },
        { speaker: "matthew", text: "Everywhere you go, I'm tracking your coordinates. I do everything from counting blocks to measuring space!" },
      ],
    },
    {
      scene: "mc-biomes",
      caption: "Forest, desert, tundra, swamp… every biome is different!",
      cast: [{ bot: "matthew", size: "md" }, { bot: "sophia", size: "md", flip: true }],
      bubbles: [
        { speaker: "matthew", text: "Today, we're going to explore the different Minecraft biomes and what makes them unique." },
        { speaker: "sophia", text: "We'll also learn how much space each block takes up, so that we can build better!" },
      ],
    },
    {
      scene: "mc-plains",
      cast: ALL_BOTS.map((c) => ({ ...c, pose: "bounce" as const })),
      bubbles: [
        { speaker: "matthew", text: "Together, the four of us will help you understand how Minecraft uses STEM to make the game work." },
        { speaker: "all", text: "Let's go!", kind: "shout" },
      ],
    },
  ],
};

// ── Lesson 2: Mission Millionaire ────────────────────────────────────────────
const MILLIONAIRE_STRIP: ComicStrip = {
  title: "Mission Millionaire",
  panels: [
    {
      scene: "gs-stage",
      caption: "Dramatic game-show music. Flashing lights!",
      sfx: "*AUDIENCE CHEERS*",
      cast: ALL_BOTS.map((c) => ({ ...c, size: "sm" as const })),
      bubbles: [{ speaker: "host", text: "Welcome back to… WHO WANTS TO BE A STEMILLIONAIRE?!", kind: "shout" }],
    },
    {
      scene: "gs-stage",
      caption: "Spotlights swing dramatically toward the STEMbots.",
      cast: ALL_BOTS.map((c) => ({ ...c, size: "sm" as const, pose: "tilt" as const })),
      bubbles: [
        { speaker: "host", text: "Our contestants have made it to the FINAL QUESTION… worth ONE MILLION DOLLARS!" },
        { speaker: "host", text: "But first, let's hear why each contestant thinks they should win!" },
      ],
    },
    {
      scene: "gs-stage",
      cast: [{ bot: "timothy", size: "md" }, { bot: "matthew", size: "md", flip: true }],
      bubbles: [
        { speaker: "timothy", text: "I deserve it because I always stay connected to success!" },
        { speaker: "matthew", text: "I should win because I always calculate the right answer!" },
      ],
    },
    {
      scene: "gs-stage",
      caption: "…Awkward silence.",
      cast: [{ bot: "sophia", size: "md" }, { bot: "emily", size: "md", flip: true, pose: "bounce" }],
      bubbles: [
        { speaker: "sophia", text: "I should win because I always react well under pressure!" },
        { speaker: "emily", text: "I should win because I'm built different!" },
      ],
    },
    {
      scene: "gs-question",
      sfx: "TICK… TOCK…",
      screen: "A. Respiration\nB. Photosynthesis\nC. Condensation\nD. Evaporation",
      cast: [],
      bubbles: [
        { speaker: "host", text: "Here is your final question… What is the process by which plants convert sunlight into energy?" },
      ],
    },
    {
      scene: "gs-stage",
      cast: [{ bot: "emily", size: "md", pose: "tilt" }, { bot: "matthew", size: "md", flip: true, pose: "tilt" }],
      bubbles: [
        { speaker: "emily", text: "Hmmm… I'm engineering a solution…", kind: "thought" },
        { speaker: "matthew", text: "Let me try calculating my chances of getting this right…", kind: "thought" },
      ],
    },
    {
      scene: "gs-stage",
      sfx: "BZZZZZT!",
      cast: [{ bot: "sophia", size: "lg", pose: "jump" }],
      bubbles: [{ speaker: "sophia", text: "IT'S PHOTOSYNTHESIS!", kind: "shout" }],
    },
    {
      scene: "gs-confetti",
      caption: "Confetti explodes everywhere. The audience screams!",
      cast: [{ bot: "sophia", size: "md", pose: "jump" }],
      bubbles: [
        { speaker: "host", text: "CORRECT!!! SOPHIA HAS WON ONE MILLION DOLLARS!!!", kind: "shout" },
      ],
    },
    {
      scene: "gs-confetti",
      cast: [{ bot: "sophia", size: "lg", pose: "bounce" }],
      bubbles: [
        { speaker: "sophia", text: "I'm rich! I am going to buy all the microscopes and test tubes in the world!", kind: "shout" },
      ],
    },
    {
      scene: "gs-atm",
      caption: "Timothy wheels in a giant futuristic ATM machine.",
      sfx: "BEEP BOOP WHIRR",
      screen: "PROCESSING…",
      cast: [{ bot: "timothy", size: "md" }],
      bubbles: [
        { speaker: "timothy", text: "Initiating secure millionaire money transfer sequence." },
        { speaker: "timothy", text: "Transferring money to Sophia's bank account…" },
      ],
    },
    {
      scene: "gs-atm",
      screen: "$1,000,000",
      cast: [{ bot: "sophia", size: "md", pose: "bounce" }],
      bubbles: [{ speaker: "sophia", text: "Ooooh! Look at all those zeroes!" }],
    },
    {
      scene: "gs-atm",
      caption: "Suddenly the amount drops… and drops… and DROPS.",
      screen: "$910,000\n$870,000\n$845,392.17",
      cast: [{ bot: "sophia", size: "md", pose: "shake" }],
      bubbles: [
        { speaker: "sophia", text: "…Wait. WAIT. MY MONEY IS EVAPORATING!", kind: "shout" },
      ],
    },
    {
      scene: "gs-stage",
      cast: [{ bot: "timothy", size: "md" }, { bot: "sophia", size: "md", flip: true, pose: "shake" }],
      bubbles: [
        { speaker: "timothy", text: "Stop being so dramatic. You didn't think you'd win the FULL 1 million dollars, right? Some of your winnings must go to taxes!" },
        { speaker: "sophia", text: "Taxes? What's that? Why are they eating all my winnings?" },
      ],
    },
    {
      scene: "gs-city",
      caption: "A hologram shows roads, MRT lines and hospitals appearing.",
      cast: [{ bot: "emily", size: "md" }],
      bubbles: [
        { speaker: "emily", text: "Governments collect money through something called taxes! The tax money pays for roads, schools, hospitals, transport systems and public services." },
      ],
    },
    {
      scene: "gs-city",
      cast: [{ bot: "sophia", size: "md", pose: "tilt" }, { bot: "timothy", size: "md", flip: true }],
      bubbles: [
        { speaker: "sophia", text: "So taxes are… a good thing?" },
        { speaker: "timothy", text: "Yes! You didn't keep the full million dollars, but you definitely made STEMcity a better place." },
      ],
    },
    {
      scene: "gs-calculator",
      caption: "Mathbot dramatically appears beside a giant calculator.",
      cast: [{ bot: "sophia", size: "md", pose: "bounce" }, { bot: "matthew", size: "md", flip: true }],
      bubbles: [
        { speaker: "sophia", text: "Yay! So, what should I do with the rest of my money to make the most of it?" },
        { speaker: "matthew", text: "Well, we can try to budget it by making smart spending and saving choices!" },
      ],
    },
    {
      scene: "gs-dream",
      caption: "Fantasy time: Sophia in sunglasses buys yachts, gold toilets and a rocket-shaped bungalow.",
      cast: [{ bot: "matthew", size: "md" }],
      bubbles: [
        { speaker: "matthew", text: "Many people think becoming rich means spending money immediately." },
        { speaker: "matthew", text: "If you don't budget properly, even a millionaire can run out of money." },
      ],
    },
    {
      scene: "gs-bank",
      cast: [{ bot: "timothy", size: "md" }, { bot: "emily", size: "md", flip: true }],
      bubbles: [
        { speaker: "timothy", text: "That's why banks have savings accounts, where you keep extra money in a virtual piggy bank for rainy days!" },
        { speaker: "emily", text: "And why adults compare prices, calculate discounts and think carefully before buying things." },
      ],
    },
    {
      scene: "gs-calculator",
      cast: [{ bot: "sophia", size: "md", pose: "tilt" }, { bot: "matthew", size: "md", flip: true }],
      bubbles: [
        { speaker: "sophia", text: "So if I want to KEEP my money…" },
        { speaker: "matthew", text: "You'll need to learn about taxes, discounts, saving money and smart spending." },
      ],
    },
    {
      scene: "gs-stage",
      cast: [{ bot: "sophia", size: "md" }, { bot: "matthew", size: "md", flip: true, pose: "bounce" }],
      bubbles: [
        { speaker: "sophia", text: "…Fine. I guess I won't spend ALL my money on microscopes and test tubes." },
        { speaker: "matthew", text: "Excellent financial decision." },
      ],
    },
    {
      scene: "gs-board",
      caption: "The game-show stage transforms into a giant Singapore-themed Monopoly city!",
      cast: [{ bot: "timothy", size: "md" }, { bot: "emily", size: "md", flip: true }],
      bubbles: [
        { speaker: "timothy", text: "Today, students, YOU will help us become smarter with money." },
        { speaker: "emily", text: "You'll learn how banks and budgeting work in real life." },
      ],
    },
    {
      scene: "gs-board",
      cast: ALL_BOTS.map((c) => ({ ...c, pose: "jump" as const })),
      bubbles: [
        { speaker: "matthew", text: "And you'll use math to calculate prices, taxes, discounts and savings." },
        { speaker: "sophia", text: "So let's begin…" },
        { speaker: "all", text: "MISSION MILLIONAIRE!", kind: "shout" },
      ],
    },
  ],
};

// ── Lesson 3: Space Busters (Operation Solar Escape) ─────────────────────────
const SPACE_STRIP: ComicStrip = {
  title: "Operation Solar Escape",
  panels: [
    {
      scene: "space-calm",
      caption: "Dark space. The SKELD spaceship floats calmly. Soft hum…",
      cast: [],
      bubbles: [{ speaker: "system", text: "All systems are stable." }],
    },
    {
      scene: "space-alarm",
      caption: "Suddenly, the alarm blares! Red lights flash.",
      sfx: "WEE-OOO! WEE-OOO!",
      cast: ALL_BOTS.map((c) => ({ ...c, pose: "shake" as const })),
      bubbles: [{ speaker: "system", text: "WARNING! TRAJECTORY ERROR DETECTED!", kind: "shout" }],
    },
    {
      scene: "space-sun",
      caption: "The camera zooms out. The Sun appears, large and glowing.",
      cast: [],
      bubbles: [{ speaker: "mission", text: "Crew! The SKELD is heading straight toward the Sun!", kind: "shout" }],
    },
    {
      scene: "space-cockpit",
      screen: "TEMP 72°C ▲",
      cast: [{ bot: "sophia", size: "md" }, { bot: "matthew", size: "md", flip: true, pose: "shake" }],
      bubbles: [
        { speaker: "sophia", text: "The Sun is giving off huge amounts of light energy and heat energy. As we get closer, more of that energy is entering the ship!" },
        { speaker: "matthew", text: "No wonder the control panels are getting so hot!" },
      ],
    },
    {
      scene: "space-sun",
      cast: [{ bot: "emily", size: "md", pose: "tilt" }, { bot: "sophia", size: "md", flip: true }],
      bubbles: [
        { speaker: "emily", text: "Wait, what exactly are light energy and heat energy?" },
        { speaker: "sophia", text: "Light energy travels in waves from the Sun to us. It's the energy that allows us to see objects and colours around us." },
      ],
    },
    {
      scene: "space-cockpit",
      screen: "TEMP 85°C ▲",
      cast: [{ bot: "sophia", size: "md" }, { bot: "timothy", size: "md", flip: true, pose: "tilt" }],
      bubbles: [
        { speaker: "sophia", text: "Heat energy, also called thermal energy, comes from moving particles. It flows from hotter objects to cooler ones." },
        { speaker: "timothy", text: "So because the Sun is much hotter than our spaceship, heat energy is flowing into the ship?" },
      ],
    },
    {
      scene: "space-cockpit",
      screen: "TEMP 98°C ▲▲",
      sfx: "SIZZLE!",
      cast: [{ bot: "sophia", size: "md" }, { bot: "emily", size: "md", flip: true, pose: "shake" }],
      bubbles: [
        { speaker: "sophia", text: "That's right. The closer we get, the more heat energy is transferred to our spacecraft." },
        { speaker: "emily", text: "And that's causing our systems to overheat!", kind: "shout" },
      ],
    },
    {
      scene: "space-sun",
      cast: [{ bot: "matthew", size: "md", pose: "shake" }, { bot: "emily", size: "md", flip: true }],
      bubbles: [
        { speaker: "matthew", text: "If we don't change direction, we will crash into the Sun!", kind: "shout" },
        { speaker: "emily", text: "Then we move the ship. Simple." },
      ],
    },
    {
      scene: "space-cockpit",
      screen: "FUEL 3% ▼",
      cast: ALL_BOTS.map((c) => ({ ...c, size: "sm" as const, pose: "tilt" as const })),
      bubbles: [
        { speaker: "mission", text: "But there is one problem…" },
        { speaker: "mission", text: "The SKELD does NOT have enough fuel.", kind: "shout" },
      ],
    },
    {
      scene: "space-cockpit",
      screen: "FUEL 3% ▼",
      cast: [{ bot: "sophia", size: "md" }, { bot: "timothy", size: "md", flip: true }],
      bubbles: [
        { speaker: "sophia", text: "Our fuel stores chemical potential energy, in the bonds of its atoms and molecules. Think of it as energy waiting to be released!" },
        { speaker: "timothy", text: "So when the fuel burns inside the engines, that stored energy is released?" },
      ],
    },
    {
      scene: "space-calm",
      sfx: "VROOOM!",
      cast: [{ bot: "emily", size: "lg", pose: "bounce" }],
      bubbles: [
        { speaker: "emily", text: "Exactly! It's converted into kinetic energy, the energy that makes objects move. That powers the engines and pushes the ship in a new direction!" },
      ],
    },
    {
      scene: "space-asteroids",
      cast: [{ bot: "emily", size: "md" }, { bot: "matthew", size: "md", flip: true }],
      bubbles: [
        { speaker: "system", text: "OBJECTIVE: COLLECT FUEL FROM ASTEROIDS." },
        { speaker: "emily", text: "We will mine asteroids to get fuel!" },
        { speaker: "matthew", text: "But each asteroid is locked with math problems!" },
      ],
    },
    {
      scene: "space-asteroids",
      cast: ALL_BOTS.map((c) => ({ ...c, pose: "jump" as const })),
      bubbles: [
        { speaker: "timothy", text: "Answer correctly to break open the asteroids. That releases the fuel stored inside the rocks!" },
        { speaker: "system", text: "BEGIN MINING TASKS.", kind: "shout" },
      ],
    },
  ],
};

export const COMIC_STRIPS: Record<string, ComicStrip> = {
  "mm-intro": MINECRAFT_STRIP,
  "mi-intro": MILLIONAIRE_STRIP,
  "sb-intro": SPACE_STRIP,
};
