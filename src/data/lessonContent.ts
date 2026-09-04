// Rich content model for STEM x Games — the only unlocked module for now.
// Each Lesson (flag icon) breaks down vertically into "beats": intro story
// (icon #1), science video+quiz (icon #2 / #3), math video+quiz (icon #4),
// an interactive simulation (icon #5), and an exit card (icon #6).
//
// Point values follow the spec exactly:
//   Intro story          -> 50 atoms
//   Video lesson          -> 200 xp + 100 atoms
//   Quiz                  -> 50-100 xp (scaled by correctness) + 25 atoms
//   Interactive game/sim  -> 500 xp + 300 atoms
//   Exit card              -> 100 xp + 50 atoms

export type BeatType =
  | "intro"
  | "video"
  | "quiz"
  | "simulation"
  | "exit";

export type BeatSubject = "science" | "math" | null;

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface LessonBeat {
  id: string;
  type: BeatType;
  subject: BeatSubject;
  title: string;
  topicLabel: string; // e.g. "Science Topic 1: Cycles in Matter"
  description: string;
  duration?: string;
  completed: boolean;
  quizQuestions?: QuizQuestion[];
  // Tags used by the filter/search feature
  levelTags: string[]; // e.g. ["P5", "P6"]
  subjectTags: string[]; // Science: Diversity/Cycles/Systems/Energy/Interactions
                          // Math: Numbers/Algebra/Geometry/Measurement/Statistics
}

export interface GameLesson {
  id: string;
  flagLabel: string; // "Lesson 1"
  title: string;
  blurb: string;
  beats: LessonBeat[];
}

function pointsFor(beat: Pick<LessonBeat, "type">) {
  switch (beat.type) {
    case "intro":
      return { xp: 0, atoms: 50 };
    case "video":
      return { xp: 200, atoms: 100 };
    case "quiz":
      return { xp: 100, atoms: 25, xpMin: 50 }; // scaled 50-100 by correctness
    case "simulation":
      return { xp: 500, atoms: 300 };
    case "exit":
      return { xp: 100, atoms: 50 };
  }
}

export const POINTS_LEGEND = [
  { label: "Intro Story", detail: "50 Atoms" },
  { label: "Video Lesson", detail: "200 XP + 100 Atoms" },
  { label: "Quiz", detail: "50-100 XP (by accuracy) + 25 Atoms" },
  { label: "Game", detail: "500 XP + 300 Atoms" },
  { label: "Exit Card", detail: "100 XP + 50 Atoms" },
];

export { pointsFor };

export const GAME_LESSONS: GameLesson[] = [
  {
    id: "minecraft-masterminds",
    flagLabel: "Lesson 1",
    title: "Minecraft Masterminds",
    blurb:
      "Learning about Matter/Water Cycles and Area/Volume through Minecraft!",
    beats: [
      {
        id: "mm-intro",
        type: "intro",
        subject: null,
        title: "Intro Story",
        topicLabel: "Intro Story",
        description:
          "Join the STEMbots as they land in a blocky new world and set out to build a base that can survive anything Minecraft throws at it.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
      {
        id: "mm-sci1-video",
        type: "video",
        subject: "science",
        title: "Cycles in Matter",
        topicLabel: "Science Topic 1: Cycles in Matter",
        description:
          "How blocks change state — solid ore, liquid lava, and gaseous smoke — and what that teaches us about matter cycles.",
        duration: "6:00",
        completed: false,
        levelTags: ["P5"],
        subjectTags: ["Cycles"],
      },
      {
        id: "mm-sci1-quiz",
        type: "quiz",
        subject: "science",
        title: "Cycles in Matter Quiz",
        topicLabel: "Science Topic 1: Cycles in Matter",
        description: "Check what you remember about states of matter.",
        completed: false,
        levelTags: ["P5"],
        subjectTags: ["Cycles"],
        quizQuestions: [
          {
            question: "When lava cools into obsidian, matter changes from:",
            options: [
              "Gas to liquid",
              "Liquid to solid",
              "Solid to gas",
              "It doesn't change",
            ],
            correctAnswer: 1,
          },
          {
            question: "Which of these is a gas at room temperature?",
            options: ["Water", "Ice", "Steam", "Stone"],
            correctAnswer: 2,
          },
        ],
      },
      {
        id: "mm-sci2-video",
        type: "video",
        subject: "science",
        title: "Cycles in Water",
        topicLabel: "Science Topic 2: Cycles in Water",
        description:
          "Follow a droplet through evaporation, condensation and precipitation across a Minecraft biome.",
        duration: "5:40",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Cycles", "Systems"],
      },
      {
        id: "mm-sci2-quiz",
        type: "quiz",
        subject: "science",
        title: "Cycles in Water Quiz",
        topicLabel: "Science Topic 2: Cycles in Water",
        description: "Quick check on the water cycle stages.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Cycles", "Systems"],
        quizQuestions: [
          {
            question: "What is it called when water vapour turns into clouds?",
            options: ["Evaporation", "Condensation", "Precipitation", "Collection"],
            correctAnswer: 1,
          },
        ],
      },
      {
        id: "mm-sci-sim",
        type: "simulation",
        subject: "science",
        title: "Building an Ecosystem",
        topicLabel: "Game",
        description:
          "Build an ecosystem in a Minecraft biome — balance producers, consumers and the water cycle to keep it alive.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Systems", "Interactions"],
      },
      {
        id: "mm-math1-video",
        type: "video",
        subject: "math",
        title: "Area (Length x Width)",
        topicLabel: "Math Topic 1: Area",
        description:
          "Count blocks to work out floor area, then calculate it directly with length × width.",
        duration: "4:50",
        completed: false,
        levelTags: ["P5"],
        subjectTags: ["Measurement", "Geometry"],
      },
      {
        id: "mm-math1-quiz",
        type: "quiz",
        subject: "math",
        title: "Area Quiz",
        topicLabel: "Math Topic 1: Area",
        description: "Practice calculating area from a floor plan.",
        completed: false,
        levelTags: ["P5"],
        subjectTags: ["Measurement", "Geometry"],
        quizQuestions: [
          {
            question: "A room is 8 blocks long and 5 blocks wide. What's the area?",
            options: ["13", "35", "40", "45"],
            correctAnswer: 2,
          },
        ],
      },
      {
        id: "mm-math2-video",
        type: "video",
        subject: "math",
        title: "Volume",
        topicLabel: "Math Topic 2: Volume",
        description:
          "Stack up the third dimension: length × width × height to find how many blocks fill a room.",
        duration: "5:10",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
      },
      {
        id: "mm-math2-quiz",
        type: "quiz",
        subject: "math",
        title: "Volume Quiz",
        topicLabel: "Math Topic 2: Volume",
        description: "Check your understanding of volume.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
        quizQuestions: [
          {
            question: "A box is 2 x 3 x 4 blocks. What's its volume?",
            options: ["9", "24", "20", "12"],
            correctAnswer: 1,
          },
        ],
      },
      {
        id: "mm-math-sim",
        type: "simulation",
        subject: "math",
        title: "Designing a Minecraft Home",
        topicLabel: "Game",
        description:
          "Use area and volume to design a Minecraft home that fits a materials budget.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
      },
      {
        id: "mm-exit",
        type: "exit",
        subject: null,
        title: "Exit Card",
        topicLabel: "Exit Card",
        description:
          "Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
    ],
  },
  {
    id: "mission-millionaire",
    flagLabel: "Lesson 2",
    title: "Mission Millionaire",
    blurb: "Learning about Budgeting, GST & Discounts through Monopoly!",
    beats: [
      {
        id: "mi-intro",
        type: "intro",
        subject: null,
        title: "Intro Story",
        topicLabel: "Intro Story",
        description:
          "Timothy needs help managing a property empire — starting with the family's board game night.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
      {
        id: "mi-math1-video",
        type: "video",
        subject: "math",
        title: "Addition & Subtraction with Decimals",
        topicLabel: "Math Topic 1: Addition & Subtraction with Decimals",
        description:
          "Track rent, salaries and bills to the cent as you play through a round of Monopoly.",
        duration: "5:20",
        completed: false,
        levelTags: ["P4", "P5"],
        subjectTags: ["Numbers"],
      },
      {
        id: "mi-math1-quiz",
        type: "quiz",
        subject: "math",
        title: "Decimals Quiz",
        topicLabel: "Math Topic 1: Addition & Subtraction with Decimals",
        description: "Add and subtract money amounts.",
        completed: false,
        levelTags: ["P4", "P5"],
        subjectTags: ["Numbers"],
        quizQuestions: [
          {
            question: "You have $128.50 and pay $45.75 rent. How much is left?",
            options: ["$82.75", "$83.75", "$92.75", "$82.25"],
            correctAnswer: 0,
          },
        ],
      },
      {
        id: "mi-math2-video",
        type: "video",
        subject: "math",
        title: "Percentages, Taxes & Discounts",
        topicLabel: "Math Topic 2: Percentages, Taxes & Discounts",
        description:
          "Work out GST on purchases and calculate the real price after a shop discount.",
        duration: "6:10",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Numbers", "Statistics"],
      },
      {
        id: "mi-math2-quiz",
        type: "quiz",
        subject: "math",
        title: "Percentages Quiz",
        topicLabel: "Math Topic 2: Percentages, Taxes & Discounts",
        description: "Practice GST and discount calculations.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Numbers", "Statistics"],
        quizQuestions: [
          {
            question: "An item costs $50 with 20% discount. What's the sale price?",
            options: ["$30", "$40", "$45", "$35"],
            correctAnswer: 1,
          },
        ],
      },
      {
        id: "mi-math-sim",
        type: "simulation",
        subject: "math",
        title: "Singapore-themed Monopoly",
        topicLabel: "Game",
        description:
          "Play a Singapore-themed Monopoly round, budgeting for rent, GST and discounts in real time.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Numbers", "Statistics"],
      },
      {
        id: "mi-exit",
        type: "exit",
        subject: null,
        title: "Exit Card",
        topicLabel: "Exit Card",
        description:
          "Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
    ],
  },
  {
    id: "space-busters",
    flagLabel: "Lesson 3",
    title: "Space Busters",
    blurb: "Learning Forces & BODMAS through Among Us!",
    beats: [
      {
        id: "sb-intro",
        type: "intro",
        subject: null,
        title: "Intro Story",
        topicLabel: "Intro Story",
        description:
          "The crew's spaceship has lost power — can you restore the engines before the impostor strikes?",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
      {
        id: "sb-sci1-video",
        type: "video",
        subject: "science",
        title: "Energy",
        topicLabel: "Science Topic 1: Energy",
        description:
          "Kinetic vs potential energy — how the ship's engines convert fuel into thrust.",
        duration: "5:30",
        completed: false,
        levelTags: ["P6"],
        subjectTags: ["Energy"],
      },
      {
        id: "sb-sci1-quiz",
        type: "quiz",
        subject: "science",
        title: "Energy Quiz",
        topicLabel: "Science Topic 1: Energy",
        description: "Test your understanding of energy transfer.",
        completed: false,
        levelTags: ["P6"],
        subjectTags: ["Energy"],
        quizQuestions: [
          {
            question: "A stretched slingshot has what kind of energy?",
            options: ["Kinetic", "Potential", "Thermal", "Sound"],
            correctAnswer: 1,
          },
        ],
      },
      {
        id: "sb-sci2-video",
        type: "video",
        subject: "science",
        title: "Forces",
        topicLabel: "Science Topic 2: Forces",
        description:
          "Push, pull, thrust and gravity — the forces at play when a spaceship launches.",
        duration: "5:45",
        completed: false,
        levelTags: ["P6"],
        subjectTags: ["Energy", "Interactions"],
      },
      {
        id: "sb-sci2-quiz",
        type: "quiz",
        subject: "science",
        title: "Forces Quiz",
        topicLabel: "Science Topic 2: Forces",
        description: "Check your knowledge of forces.",
        completed: false,
        levelTags: ["P6"],
        subjectTags: ["Energy", "Interactions"],
        quizQuestions: [
          {
            question: "What force pulls the spaceship back to a planet?",
            options: ["Friction", "Gravity", "Magnetism", "Thrust"],
            correctAnswer: 1,
          },
        ],
      },
      {
        id: "sb-sci-sim",
        type: "simulation",
        subject: "science",
        title: "Launching a Spaceship",
        topicLabel: "Game",
        description:
          "Launch an Among Us spaceship by balancing energy and forces to reach orbit.",
        completed: false,
        levelTags: ["P6"],
        subjectTags: ["Energy", "Interactions"],
      },
      {
        id: "sb-math1-video",
        type: "video",
        subject: "math",
        title: "Order of Operations",
        topicLabel: "Math Topic 1: Order of Operations",
        description:
          "BODMAS explained: solve multi-step calculations in the right order to fix the ship's systems.",
        duration: "5:00",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Numbers", "Algebra"],
      },
      {
        id: "sb-math1-quiz",
        type: "quiz",
        subject: "math",
        title: "BODMAS Quiz",
        topicLabel: "Math Topic 1: Order of Operations",
        description: "Practice BODMAS calculations.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Numbers", "Algebra"],
        quizQuestions: [
          {
            question: "What is 4 + 2 × (6 - 3)?",
            options: ["18", "10", "9", "12"],
            correctAnswer: 1,
          },
        ],
      },
      {
        id: "sb-math-sim",
        type: "simulation",
        subject: "math",
        title: "Among Us Tasks as BODMAS",
        topicLabel: "Game",
        description:
          "Complete Among Us-style tasks that are really BODMAS questions in disguise.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Numbers", "Algebra"],
      },
      {
        id: "sb-exit",
        type: "exit",
        subject: null,
        title: "Exit Card",
        topicLabel: "Exit Card",
        description:
          "Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
    ],
  },
];

export const PRIMARY_LEVEL_TAGS = ["P1", "P2", "P3", "P4", "P5", "P6"];
export const SCIENCE_TOPIC_TAGS = [
  "Diversity",
  "Cycles",
  "Systems",
  "Energy",
  "Interactions",
];
export const MATH_TOPIC_TAGS = [
  "Numbers",
  "Algebra",
  "Geometry",
  "Measurement",
  "Statistics",
];
