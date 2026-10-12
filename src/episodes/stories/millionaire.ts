import type { Episode, Line } from "../types";

// Episode 2 — Lesson 2: Mission Millionaire (money, taxes, budgeting, discounts).
// The player is the contestant on a game show and wins a million dollars.

const BOTS = ["sophia", "timothy", "emily", "matthew"] as const;

/** One line per possible lifeline bot, said by that bot. */
function byLifeline(text: string): Line[] {
  return BOTS.map((b) => ({ speaker: b, text, when: { lifeline: b } }));
}

const AUDIENCE = [
  { bot: "emily" as const, at: "farleft" as const },
  { bot: "sophia" as const, at: "left" as const },
  { bot: "timothy" as const, at: "right" as const },
  { bot: "matthew" as const, at: "farright" as const },
];

export const MILLIONAIRE_EPISODE: Episode = {
  beatId: "mi-intro",
  number: 2,
  title: "Who Wants to Be a STEMillionaire?",
  tagline: "The spotlight is on you. One million dollars is on the line.",
  music: "gameshow",
  start: "open",
  nodes: {
    open: {
      type: "talk",
      scene: "gs-stage",
      camera: "pushIn",
      fx: ["sparkle"],
      hands: "buzzer",
      lines: [
        { speaker: "narrator", text: "Lights. Music. A roaring crowd. You're standing behind a glowing buzzer." },
        { speaker: "host", text: "Welcome back to... Who Wants to Be a STEMillionaire!" },
        { speaker: "host", text: "Tonight's contestant is a brand-new STEMcadet! Give it up, everybody!" },
        { speaker: "narrator", text: "The spotlight swings across the stage... and lands right on you." },
      ],
      next: "ready",
    },
    ready: {
      type: "choice",
      scene: "gs-stage",
      hands: "buzzer",
      prompt: { speaker: "host", text: "So, Cadet. Are you ready to play for ONE MILLION DOLLARS?" },
      options: [
        { text: "Born ready. Let's do this!", say: "Born ready. Let's do this!", set: { style: "bold" }, next: "lifelineIntro", tag: "Bold" },
        { text: "Um... can I bring a friend?", say: "Um... can I bring a friend?", set: { style: "nervous" }, next: "lifelineIntro", tag: "Honest" },
      ],
    },
    lifelineIntro: {
      type: "talk",
      scene: "gs-stage",
      hands: "buzzer",
      cast: AUDIENCE.map((c) => ({ ...c, enter: "pop" as const })),
      lines: [
        { speaker: "host", text: "Ha! Confidence! The crowd loves it!", when: { style: "bold" } },
        { speaker: "host", text: "Of course you can! That's what lifelines are for.", when: { style: "nervous" } },
        { speaker: "host", text: "Every contestant gets one lifeline: Phone a STEMbot! And look who's in the front row!" },
      ],
      next: "lifeline",
    },
    lifeline: {
      type: "choice",
      scene: "gs-stage",
      hands: "buzzer",
      cast: AUDIENCE,
      prompt: { speaker: "host", text: "Who will be your lifeline tonight?" },
      options: BOTS.map((b) => ({
        text: { sophia: "Sophia, the science whizz", timothy: "Timothy, the tech genius", emily: "Emily, the problem solver", matthew: "Matthew, the number cruncher" }[b],
        say: `${b[0].toUpperCase()}${b.slice(1)}, you're my lifeline!`,
        set: { lifeline: b },
        next: "lifelinePicked",
      })),
    },
    lifelinePicked: {
      type: "talk",
      scene: "gs-stage",
      hands: "buzzer",
      cast: AUDIENCE,
      lines: [
        ...byLifeline("Me? Yes! Let's win this thing together!"),
        // Bonus line when the lifeline is the buddy from Episode 1.
        ...BOTS.map((b) => ({ speaker: b, text: "Partners again, just like in the biome!", when: { lifeline: b, buddy: b } })),
        { speaker: "host", text: "Three questions stand between you and a million dollars. Hit that buzzer when you know it!" },
      ],
      next: "quiz",
    },
    quiz: {
      type: "game",
      game: "buzzerRound",
      scene: "gs-question",
      hands: "buzzer",
      win: [
        { speaker: "host", text: "CORRECT! Cadet, you have just won... ONE MILLION DOLLARS!" },
      ],
      lose: [
        { speaker: "host", text: "Ooh, so close! But tonight we're feeling generous. You STILL win ONE MILLION DOLLARS!" },
      ],
      setOnWin: { quizWon: true },
      next: "confetti",
    },
    confetti: {
      type: "talk",
      scene: "gs-confetti",
      fx: ["confetti"],
      camera: "shake",
      cast: AUDIENCE.map((c) => ({ ...c, enter: "drop" as const })),
      lines: [
        { speaker: "narrator", text: "Confetti explodes everywhere. The crowd goes wild!" },
        { speaker: "sophia", text: "You're a millionaire! I'm so proud I could cry. Robots can't cry. But still!" },
      ],
      next: "atm",
    },
    atm: {
      type: "talk",
      scene: "gs-atm",
      screen: "$1,000,000",
      cast: [{ bot: "timothy", at: "left", enter: "left" }],
      lines: [
        { speaker: "timothy", text: "Initiating secure millionaire money transfer! Sending your winnings to your bank account now." },
        { speaker: "narrator", text: "The screen beeps. One million dollars. All yours. Then... the number starts to shrink." },
      ],
      next: "shrink",
    },
    shrink: {
      type: "choice",
      scene: "gs-atm",
      screen: "$910,000\n$870,000\n$845,392.17",
      camera: "shake",
      cast: [{ bot: "timothy", at: "left" }],
      prompt: { speaker: "narrator", text: "$845,392.17?!" },
      options: [
        { text: "HEY! Where did my money go?!", say: "HEY! Where did my money go?!", set: { reaction: "shock" }, next: "taxes", tag: "Dramatic" },
        { text: "Wait... is that tax?", say: "Wait... is that tax?", set: { reaction: "smart" }, next: "taxes", tag: "Sharp" },
      ],
    },
    taxes: {
      type: "talk",
      scene: "gs-city",
      camera: "pullOut",
      cast: [
        { bot: "emily", at: "left", enter: "pop" },
        { bot: "timothy", at: "right" },
      ],
      lines: [
        { speaker: "timothy", text: "Don't panic! Some of your winnings go to taxes.", when: { reaction: "shock" } },
        { speaker: "timothy", text: "Sharp eyes! Yep, that's tax.", when: { reaction: "smart" } },
        { speaker: "emily", text: "The government collects taxes to pay for roads, schools, hospitals and MRT lines." },
        { speaker: "emily", text: "So your money just helped build STEMcity. Pretty cool, right?" },
      ],
      next: "plan",
    },
    plan: {
      type: "choice",
      scene: "gs-calculator",
      cast: [{ bot: "matthew", at: "center", enter: "drop" }],
      prompt: { speaker: "matthew", text: "So, millionaire. What's your plan for the rest of the money?" },
      options: [
        { text: "Yacht! Gold toilet! Rocket house!", say: "A yacht! A gold toilet! A rocket-shaped house!", set: { plan: "splurge" }, next: "splurge", tag: "Splurge" },
        { text: "Save some, spend some", say: "Save some, spend some on fun stuff.", set: { plan: "balance" }, next: "balance", tag: "Balanced" },
        { text: "Save every single cent!", say: "I'm saving every single cent!", set: { plan: "save" }, next: "save", tag: "Saver" },
      ],
    },
    splurge: {
      type: "talk",
      scene: "gs-dream",
      fx: ["sparkle"],
      cast: [{ bot: "matthew", at: "right" }],
      lines: [
        { speaker: "narrator", text: "You imagine it: sunglasses on, sailing your yacht to your rocket-shaped house." },
        { speaker: "matthew", text: "Hmm. That's eight hundred thousand dollars gone in one afternoon." },
        { speaker: "matthew", text: "Without a budget, even a millionaire can run out of money. Let me show you." },
      ],
      next: "catch",
    },
    balance: {
      type: "talk",
      scene: "gs-bank",
      cast: [{ bot: "matthew", at: "left" }, { bot: "timothy", at: "right", enter: "right" }],
      lines: [
        { speaker: "matthew", text: "Ooh, a budget! That's exactly what smart money managers do." },
        { speaker: "timothy", text: "Savings in the bank for later, a little treat for now. Nice!" },
      ],
      next: "catch",
    },
    save: {
      type: "talk",
      scene: "gs-bank",
      cast: [{ bot: "timothy", at: "center", enter: "pop" }],
      lines: [
        { speaker: "timothy", text: "Savings account activated! Your money's safe in the bank, like a giant piggy bank." },
        { speaker: "timothy", text: "But it's okay to spend a little on things you really need. Let's practise!" },
      ],
      next: "catch",
    },
    catch: {
      type: "game",
      game: "budgetCatch",
      scene: "gs-board",
      intro: [
        { speaker: "matthew", text: "Catch the things you need and the coins for your savings. Dodge the splurges!" },
      ],
      win: [{ speaker: "matthew", text: "Budget complete! Needs covered, savings growing. Excellent financial decisions!" }],
      lose: [{ speaker: "matthew", text: "A few splurges slipped in, but you're learning fast. That's how budgets work!" }],
      setOnWin: { budgetWon: true },
      next: "finale",
    },
    finale: {
      type: "talk",
      scene: "gs-board",
      fx: ["sparkle"],
      camera: "pullOut",
      cast: AUDIENCE,
      lines: [
        { speaker: "narrator", text: "The stage spins and unfolds into a giant Singapore-themed Monopoly city!" },
        { speaker: "matthew", text: "You started with a million dollars and ended with a plan. Love it.", when: { plan: "balance" } },
        { speaker: "matthew", text: "You saved every cent! Just remember, money is also for living.", when: { plan: "save" } },
        { speaker: "sophia", text: "Okay, I'll admit it. I really wanted that gold toilet too.", when: { plan: "splurge" } },
        { speaker: "timothy", text: "Today, YOU will help us become smarter with money." },
        { speaker: "emily", text: "We'll count money, work out taxes and discounts, and buy properties!" },
      ],
      next: "end",
    },
    end: {
      type: "end",
      scene: "gs-board",
      fx: ["confetti"],
      cast: AUDIENCE,
      lines: [{ speaker: "all", text: "Mission Millionaire!" }],
    },
  },
  recap: [
    { when: { style: "bold" }, text: "You walked on stage born ready." },
    { when: { style: "nervous" }, text: "You asked to bring a friend. Teamwork!" },
    ...BOTS.map((b) => ({ when: { lifeline: b }, text: `${b[0].toUpperCase()}${b.slice(1)} was your lifeline.` })),
    { when: { quizWon: true }, text: "You answered the final questions like a champion." },
    { when: { reaction: "smart" }, text: "You spotted the tax before anyone explained it." },
    { when: { plan: "splurge" }, text: "You dreamed big: yacht, gold toilet, rocket house!" },
    { when: { plan: "balance" }, text: "You chose to save some and spend some." },
    { when: { plan: "save" }, text: "You saved every single cent." },
  ],
};
