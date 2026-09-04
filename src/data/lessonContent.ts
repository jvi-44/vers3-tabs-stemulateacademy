// Rich content model for STEM x Games — the only unlocked module for now.
// Each Lesson (flag icon) breaks down vertically into "beats": intro story,
// science video+quiz (x2), math video+quiz (x2), simulation/game, exit card.

export type BeatType = "intro" | "video" | "quiz" | "simulation" | "exit";
export type BeatSubject = "science" | "math" | null;

export interface DialogueLine {
  bot: "sophia" | "timothy" | "emily" | "matthew";
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface LessonBeat {
  id: string;
  type: BeatType;
  subject: BeatSubject;
  title: string;
  topicLabel: string;
  description: string;
  duration?: string;
  completed: boolean;
  dialogue?: DialogueLine[];
  quizQuestions?: QuizQuestion[];
  levelTags: string[];
  subjectTags: string[];
}

export interface GameLesson {
  id: string;
  flagLabel: string;
  title: string;
  blurb: string;
  beats: LessonBeat[];
}

function pointsFor(beat: Pick<LessonBeat, "type">) {
  switch (beat.type) {
    case "intro":      return { xp: 0,   atoms: 50  };
    case "video":      return { xp: 200, atoms: 100 };
    case "quiz":       return { xp: 100, atoms: 25, xpMin: 50 };
    case "simulation": return { xp: 500, atoms: 300 };
    case "exit":       return { xp: 100, atoms: 50  };
  }
}

export const POINTS_LEGEND = [
  { label: "Intro Story",   detail: "50 Atoms" },
  { label: "Video Lesson",  detail: "200 XP + 100 Atoms" },
  { label: "Quiz",          detail: "50–100 XP + 25 Atoms" },
  { label: "Game",          detail: "500 XP + 300 Atoms" },
  { label: "Exit Card",     detail: "100 XP + 50 Atoms" },
];

export { pointsFor };

// ── STEM x Minecraft — Lesson 1 ──────────────────────────────────────────────
const MINECRAFT_INTRO_DIALOGUE: DialogueLine[] = [
  {
    bot: "sophia",
    text: "Welcome, students! I'm Sophia, your Science STEMbot! I study how the natural world works — from tiny atoms to giant ecosystems. And today, we're taking that knowledge into Minecraft!",
  },
  {
    bot: "timothy",
    text: "I'm Timothy, the Technology STEMbot! Technology is all about using tools and systems to solve problems. Minecraft itself is technology — a digital tool that lets you design and build entire worlds!",
  },
  {
    bot: "emily",
    text: "And I'm Emily, the Engineering STEMbot! Engineers plan and build structures that work in the real world. When you craft and build in Minecraft, you're working as an engineer!",
  },
  {
    bot: "matthew",
    text: "I'm Matthew, the Math STEMbot! Math is the language behind everything — including every block you place. Today we'll explore different Minecraft biomes, learn what makes them unique, and figure out how much space each block takes up. Together, the four of us will show you how Minecraft uses STEM. Let's go!",
  },
];

export const GAME_LESSONS: GameLesson[] = [
  {
    id: "minecraft-masterminds",
    flagLabel: "Lesson 1",
    title: "Minecraft Masterminds",
    blurb: "Learning about Matter/Water Cycles and Area/Volume through Minecraft!",
    beats: [
      // ── Intro ──
      {
        id: "mm-intro",
        type: "intro",
        subject: null,
        title: "Intro Story",
        topicLabel: "Intro Story",
        description: "Join the STEMbots as they land in a blocky new world and set out to explore every biome Minecraft has to offer — using STEM to understand what makes each one tick.",
        completed: false,
        dialogue: MINECRAFT_INTRO_DIALOGUE,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },

      // ── Science 1: Cycles in Matter ──
      {
        id: "mm-sci1-video",
        type: "video",
        subject: "science",
        title: "Cycles in Matter",
        topicLabel: "Science Topic 1: Cycles in Matter",
        description: "Discover the three states of matter — solid, liquid, and gas — and how energy causes matter to change between them. From ice in the tundra to lava in the Nether, Minecraft shows all three states in action!",
        duration: "6:00",
        completed: false,
        dialogue: [
          { bot: "sophia",  text: "Have you noticed that water can be solid ice in the tundra, a flowing waterfall in the rainforest, or invisible steam in the air? Today we explore why!" },
          { bot: "emily",   text: "Matter is anything that has mass and takes up space — water, rocks, dirt, even you. These are all things I can use to build!" },
          { bot: "matthew", text: "For water, just remember: solid at 0°C and below, liquid from 0°C to 100°C, and gas above 100°C." },
          { bot: "timothy", text: "And in Minecraft, the weather cycle actually models the real water cycle — rain and snow happen naturally in different biomes!" },
        ],
        levelTags: ["P5"],
        subjectTags: ["Cycles"],
      },
      {
        id: "mm-sci1-quiz",
        type: "quiz",
        subject: "science",
        title: "Cycles in Matter Quiz",
        topicLabel: "Science Topic 1: Cycles in Matter",
        description: "Test your knowledge of the three states of matter and phase changes.",
        completed: false,
        levelTags: ["P5"],
        subjectTags: ["Cycles"],
        quizQuestions: [
          {
            question: "Which state of matter has a fixed shape and fixed volume?",
            options: ["Liquid", "Gas", "Solid", "Plasma"],
            correctAnswer: 2,
            explanation: "Solids have particles tightly packed in a fixed arrangement. They keep their shape unless a force is applied — like chopping a block with an axe!",
          },
          {
            question: "Which state of matter can flow and take the shape of its container?",
            options: ["Solid", "Liquid", "Gas", "Rock"],
            correctAnswer: 1,
            explanation: "Liquids have a fixed volume but no fixed shape. Pour water out of a bucket and it flows everywhere — just like in Minecraft!",
          },
          {
            question: "Water turning into steam is called:",
            options: ["Freezing", "Melting", "Evaporation / Boiling", "Condensation"],
            correctAnswer: 2,
            explanation: "When liquid water is heated above 100°C it boils into steam (water vapour). Evaporation happens at the surface even below 100°C.",
          },
          {
            question: "Gas turning into liquid is called:",
            options: ["Condensation", "Evaporation", "Melting", "Burning"],
            correctAnswer: 0,
            explanation: "Condensation happens when water vapour loses heat and turns back into liquid droplets — like dew on a cold bottle.",
          },
          {
            question: "Ice turning into water is called:",
            options: ["Freezing", "Melting", "Evaporation", "Cooling"],
            correctAnswer: 1,
            explanation: "Melting occurs when a solid gains heat energy. Ice melts at 0°C as particles gain enough energy to move freely as a liquid.",
          },
        ],
      },

      // ── Science 2: Cycles in Water ──
      {
        id: "mm-sci2-video",
        type: "video",
        subject: "science",
        title: "Cycles in Water",
        topicLabel: "Science Topic 2: Cycles in Water",
        description: "Follow a water droplet on its endless journey — evaporating from oceans, condensing into clouds, falling as rain, and collecting in rivers — just like water flows across Minecraft biomes!",
        duration: "5:40",
        completed: false,
        dialogue: [
          { bot: "sophia",  text: "Water is the ultimate traveller! The same water molecules have been cycling through our planet for billions of years. The water we drink today was once dinosaur breath!" },
          { bot: "emily",   text: "This seems so cool! How can we make our own mini ecosystem?" },
          { bot: "sophia",  text: "Great question, Emily! A terrarium works like a miniature water cycle — water evaporates, condenses on the glass walls, and falls back as mini rain. It's totally self-sustaining!" },
          { bot: "timothy", text: "Sorry, I was too busy playing Minecraft to listen. How does the water cycle relate to Minecraft?" },
          { bot: "sophia",  text: "Different biomes show different water patterns. Forests get frequent rain, deserts get almost none, and swamps are super moist. Just like ecosystems in the real world!" },
        ],
        levelTags: ["P5", "P6"],
        subjectTags: ["Cycles", "Systems"],
      },
      {
        id: "mm-sci2-quiz",
        type: "quiz",
        subject: "science",
        title: "Cycles in Water Quiz",
        topicLabel: "Science Topic 2: Cycles in Water",
        description: "Test your knowledge of the water cycle and how it connects to Minecraft biomes.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Cycles", "Systems"],
        quizQuestions: [
          {
            question: "What is evaporation?",
            options: [
              "Water freezing into ice",
              "Liquid water turning into water vapour due to heat",
              "Water vapour turning into liquid droplets",
              "Rain falling from clouds",
            ],
            correctAnswer: 1,
            explanation: "Evaporation is when heat energy causes liquid water to turn into water vapour — an invisible gas that rises into the atmosphere.",
          },
          {
            question: "What is condensation in the water cycle?",
            options: [
              "Water soaking into the ground",
              "Water vapour cooling and turning back into liquid droplets, forming clouds",
              "Rain or snow falling to the ground",
              "Sunlight heating the ocean surface",
            ],
            correctAnswer: 1,
            explanation: "When warm water vapour rises and meets cooler air, it condenses back into tiny liquid droplets — forming the clouds we see in the sky.",
          },
          {
            question: "Which of these is NOT a form of precipitation?",
            options: ["Rain", "Snow", "Evaporation", "Hail"],
            correctAnswer: 2,
            explanation: "Evaporation is water rising from the surface — the first step of the cycle, not precipitation. Precipitation means water falling from clouds.",
          },
          {
            question: "Why does rain occur in Minecraft biomes? What does it model from the real world?",
            options: [
              "It's a random glitch in the game",
              "It models the water cycle — specifically the precipitation stage",
              "It only happens in ocean biomes",
              "It models the matter cycle",
            ],
            correctAnswer: 1,
            explanation: "Minecraft's rain mechanic mirrors the precipitation stage of the real water cycle, where clouds release water back to the surface.",
          },
        ],
      },

      // ── Science Simulation ──
      {
        id: "mm-sci-sim",
        type: "simulation",
        subject: "science",
        title: "Water Cycle Biome Lab",
        topicLabel: "Game",
        description: "Control temperature and rainfall sliders to simulate different Minecraft biomes. Keep a forest biome alive by finding the perfect water cycle balance — just like real climate scientists!",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Cycles", "Systems"],
      },

      // ── Math 1: Area ──
      {
        id: "mm-math1-video",
        type: "video",
        subject: "math",
        title: "Area (Length × Width)",
        topicLabel: "Math Topic 1: Area",
        description: "Learn how to calculate the area of rectangles and irregular shapes by breaking them into smaller rectangles — then use it to plan the perfect Minecraft biome house floor!",
        duration: "5:00",
        completed: false,
        dialogue: [
          { bot: "matthew", text: "Area is the amount of space a 2D shape takes up. For a rectangle: Area = Length × Width. If your biome house floor is 6 blocks long and 4 blocks wide, that's 6 × 4 = 24 blocks!" },
          { bot: "emily",   text: "Wow that's so cool! But… is area only useful in Minecraft?" },
          { bot: "matthew", text: "Of course not! Farmers use area to know how much to plant, painters use it to buy the right amount of paint, and architects use it to plan every room in a building." },
          { bot: "timothy", text: "And for irregular shapes, we break them into smaller rectangles and add the areas together. Divide, calculate, and add!" },
        ],
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
      },
      {
        id: "mm-math1-quiz",
        type: "quiz",
        subject: "math",
        title: "Area Quiz",
        topicLabel: "Math Topic 1: Area",
        description: "Calculate areas of rectangles and composite shapes.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
        quizQuestions: [
          {
            question: "What is the formula for calculating the area of a rectangle?",
            options: ["Length + Width", "Length × Width × Height", "Length × Width", "Length ÷ Width"],
            correctAnswer: 2,
            explanation: "Area = Length × Width. It tells you how many square units cover a flat surface — no height needed for 2D!",
          },
          {
            question: "You want to build a floor in your Minecraft biome house that is 7 blocks long and 5 blocks wide. How many floor blocks do you need?",
            options: ["12 blocks", "35 blocks", "25 blocks", "70 blocks"],
            correctAnswer: 1,
            explanation: "7 × 5 = 35 blocks. You need exactly 35 floor blocks to cover that space.",
          },
          {
            question: "A farmer has an L-shaped field split into two rectangles: one is 4m × 3m and another is 6m × 2m. What is the total area?",
            options: ["24 m²", "30 m²", "20 m²", "15 m²"],
            correctAnswer: 1,
            explanation: "(4 × 3) + (6 × 2) = 12 + 18 = 30 m². Split irregular shapes into rectangles and add the areas.",
          },
          {
            question: "Which real-world job uses area calculations most directly?",
            options: [
              "A chef deciding how long to cook food",
              "An architect planning the floor size of rooms in a building",
              "A pilot calculating flight distance",
              "A doctor measuring a patient's temperature",
            ],
            correctAnswer: 1,
            explanation: "Architects calculate area constantly — how much flooring is needed, how big each room is, and how to fit everything into the available space.",
          },
        ],
      },

      // ── Math 2: Volume ──
      {
        id: "mm-math2-video",
        type: "video",
        subject: "math",
        title: "Volume (L × W × H)",
        topicLabel: "Math Topic 2: Volume",
        description: "Add the third dimension! Learn how to calculate the volume of 3D shapes and use it to design your dream Minecraft storage room.",
        duration: "5:00",
        completed: false,
        dialogue: [
          { bot: "timothy", text: "Wow that was fun! But wait — what if something is 3D, like my arm, or like a house? How much space does that take up?" },
          { bot: "matthew", text: "Then we calculate its volume! Volume = Length × Width × Height. If your storage room is 4 blocks long, 3 blocks wide, and 3 blocks tall — that's 4 × 3 × 3 = 36 cubic blocks!" },
          { bot: "emily",   text: "So area is for flat surfaces, and volume adds the height to get the 3D space inside?" },
          { bot: "matthew", text: "Exactly! Volume is used everywhere — doctors measure medicine doses by volume, chefs measure ingredients, and engineers calculate how much material fits inside a structure." },
        ],
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
      },
      {
        id: "mm-math2-quiz",
        type: "quiz",
        subject: "math",
        title: "Volume Quiz",
        topicLabel: "Math Topic 2: Volume",
        description: "Calculate volumes of rectangular boxes and compare 3D spaces.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
        quizQuestions: [
          {
            question: "What is the formula for calculating the volume of a rectangular box?",
            options: ["Length × Width", "Length + Width + Height", "Length × Width × Height", "Length² × Height"],
            correctAnswer: 2,
            explanation: "Volume = Length × Width × Height. It adds the third dimension — height — to what you already know about area.",
          },
          {
            question: "Your Minecraft storage room is 4 blocks long, 3 blocks wide, and 3 blocks tall. What is its volume?",
            options: ["10 cubic blocks", "24 cubic blocks", "36 cubic blocks", "48 cubic blocks"],
            correctAnswer: 2,
            explanation: "4 × 3 × 3 = 36 cubic blocks. That's how much 3D space is inside your storage room.",
          },
          {
            question: "What is the key difference between area and volume?",
            options: [
              "Area uses multiplication, volume uses addition",
              "Area measures flat (2D) space; volume measures 3D space including height",
              "Volume is always bigger than area",
              "They measure the same thing but in different units",
            ],
            correctAnswer: 1,
            explanation: "Area is 2D (flat surface), while volume is 3D — it adds height into the calculation.",
          },
          {
            question: "Two Minecraft rooms both have a floor area of 12 square blocks. Room A is 2 blocks tall; Room B is 4 blocks tall. Which room has the greater volume?",
            options: ["Room A", "Room B", "They have the same volume", "You can't tell from this information"],
            correctAnswer: 1,
            explanation: "Room A: 12 × 2 = 24 cubic blocks. Room B: 12 × 4 = 48 cubic blocks. Same floor area, but double the height means double the volume!",
          },
        ],
      },

      // ── Math Simulation ──
      {
        id: "mm-math-sim",
        type: "simulation",
        subject: "math",
        title: "Minecraft Room Designer",
        topicLabel: "Game",
        description: "Design your own Minecraft room! Adjust length, width, and height with sliders. The game calculates floor area and total volume in real time. Challenge: build 3 rooms with the same floor area — are their volumes the same?",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: ["Measurement", "Geometry"],
      },

      // ── Exit Card ──
      {
        id: "mm-exit",
        type: "exit",
        subject: null,
        title: "Exit Card",
        topicLabel: "Exit Card",
        description: "Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
    ],
  },

  // ── Lesson 2: Mission Millionaire ─────────────────────────────────────────
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
        description: "Timothy needs help managing a property empire — starting with the family's board game night.",
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
        description: "Track rent, salaries and bills to the cent as you play through a round of Monopoly.",
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
        description: "Work out GST on purchases and calculate the real price after a shop discount.",
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
        description: "Play a Singapore-themed Monopoly round, budgeting for rent, GST and discounts in real time.",
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
        description: "Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
    ],
  },

  // ── Lesson 3: Space Busters ────────────────────────────────────────────────
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
        description: "The crew's spaceship has lost power — can you restore the engines before the impostor strikes?",
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
        description: "Kinetic vs potential energy — how the ship's engines convert fuel into thrust.",
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
        description: "Push, pull, thrust and gravity — the forces at play when a spaceship launches.",
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
        description: "Launch an Among Us spaceship by balancing energy and forces to reach orbit.",
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
        description: "BODMAS explained: solve multi-step calculations in the right order to fix the ship's systems.",
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
        description: "Complete Among Us-style tasks that are really BODMAS questions in disguise.",
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
        description: "Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have.",
        completed: false,
        levelTags: ["P5", "P6"],
        subjectTags: [],
      },
    ],
  },
];

export const PRIMARY_LEVEL_TAGS = ["P1", "P2", "P3", "P4", "P5", "P6"];
export const SCIENCE_TOPIC_TAGS = ["Diversity", "Cycles", "Systems", "Energy", "Interactions"];
export const MATH_TOPIC_TAGS = ["Numbers", "Algebra", "Geometry", "Measurement", "Statistics"];
