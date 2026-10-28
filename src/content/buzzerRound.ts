// P1–2 and P3–4 questions for the game-show Buzzer Round in Mission Millionaire
// (src/episodes/minigames/BuzzerRound.tsx). Three questions with four options each,
// like the P5–6 set in that file; `answer` is the index of the right option.
import type { Banded, BuzzerQuestion } from "./types";

export const BUZZER_BANKS: Banded<BuzzerQuestion[]> = {
  p12: [
    {
      q: "What helps a plant grow big and strong?",
      options: ["Sweets and chips", "Water and sunlight", "A dark cupboard", "Lots of ice"],
      answer: 1,
      why: "Plants need water and sunlight to grow well.",
    },
    {
      q: "A drink is $2. A sandwich is $3. How much altogether?",
      options: ["$5", "$6", "$1", "$4"],
      answer: 0,
      why: "$2 + $3 = $5 altogether.",
    },
    {
      q: "You have two $5 notes. How much money is that?",
      options: ["$5", "$7", "$10", "$15"],
      answer: 2,
      why: "$5 + $5 = $10.",
    },
  ],
  p34: [
    {
      q: "Which part of a plant makes food for the plant?",
      options: ["Roots", "Leaves", "Stem", "Flowers"],
      answer: 1,
      why: "Leaves use sunlight to make food for the whole plant.",
    },
    {
      q: "A drink costs $1.50 and a bun costs $2.30. How much altogether?",
      options: ["$3.08", "$4.80", "$3.80", "$3.70"],
      answer: 2,
      why: "$1.50 + $2.30 = $3.80: add the dollars, then the cents.",
    },
    {
      q: "How many 20-cent coins make $1?",
      options: ["5", "4", "10", "20"],
      answer: 0,
      why: "5 × 20 cents = 100 cents, which is $1.",
    },
  ],
};
