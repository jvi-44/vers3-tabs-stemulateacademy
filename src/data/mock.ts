import {
  Course,
  User,
  GalleryPost,
  LeaderboardEntry,
  STEMbot,
  TopicTag,
  Card,
  CardPack,
} from "./types";

import avatarBoyTeal from "../assets/avatar_boy_teal.png";
import avatarBoyBlue from "../assets/avatar_boy_blue.png";
import avatarGirlPurpleBob from "../assets/avatar_girl_purple_bob.png";
import avatarGirlTealBuns from "../assets/avatar_girl_teal_buns.png";
import avatarBoyPurpleSpiky from "../assets/avatar_boy_purple_spiky.png";
import avatarGirlPinkPonytail from "../assets/avatar_girl_pink_ponytail.png";
import avatarBoyTealCap from "../assets/avatar_boy_teal_cap.png";
import avatarGirlTealPigtails from "../assets/avatar_girl_teal_pigtails.png";
import avatarBoyYellowCurly from "../assets/avatar_boy_yellow_curly.png";
import avatarGirlYellowFlower from "../assets/avatar_girl_yellow_flower.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotCream from "../assets/stembot_cream.png";
import stembotRed from "../assets/stembot_red.png";

export const AVATAR_OPTIONS: string[] = [
  avatarBoyTeal,
  avatarBoyBlue,
  avatarGirlPurpleBob,
  avatarGirlTealBuns,
  avatarBoyPurpleSpiky,
  avatarGirlPinkPonytail,
  avatarBoyTealCap,
  avatarGirlTealPigtails,
  avatarBoyYellowCurly,
  avatarGirlYellowFlower,
];

export const STEMBOTS: Record<string, STEMbot> = {
  sophia: {
    name: "Sophia",
    role: "The Scientist",
    discipline: "Science",
    avatar: stembotGreen,
    color: "text-green-600",
    hobbies: ["Growing tiny terrariums", "Bug-spotting on nature walks", "Mixing (safe!) kitchen experiments"],
    funFact: "Sophia can name every layer of the Earth in under 5 seconds!",
    interests: ["Ecosystems", "Water cycles", "Plants & biology"],
  },
  timothy: {
    name: "Timothy",
    role: "The Techie",
    discipline: "Technology",
    avatar: stembotBlue,
    color: "text-blue-600",
    hobbies: ["Tinkering with old gadgets", "Photography", "Building blanket-fort Wi-Fi routers"],
    funFact: "Timothy built his first circuit out of a potato battery!",
    interests: ["Coding", "Robots", "How things connect"],
  },
  emily: {
    name: "Emily",
    role: "The Engineer",
    discipline: "Engineering",
    avatar: stembotCream,
    color: "text-amber-700",
    hobbies: ["Fixing squeaky hinges", "Designing treehouses", "Marble-run architecture"],
    funFact: "Emily once redesigned her own bicycle gears for a steeper hill!",
    interests: ["Building things", "Machines", "Problem-solving"],
  },
  matthew: {
    name: "Matthew",
    role: "The Mathematician",
    discipline: "Mathematics",
    avatar: stembotRed,
    color: "text-red-600",
    hobbies: ["Speed-solving puzzles", "Rose gardening (counting petals!)", "Board games with tricky odds"],
    funFact: "Matthew can do square roots faster than a calculator (he says).",
    interests: ["Numbers", "Patterns", "Logic puzzles"],
  },
};

export const MOCK_USER: User = {
  username: "StemExplorer",
  avatar: avatarBoyTeal,
  xp: 1250,
  level: 2,
  atoms: 150,
  badges: [
    {
      id: "1",
      name: "First Lesson",
      icon: "🎯",
      earnedAt: "2024-01-15",
    },
    {
      id: "2",
      name: "Quiz Master",
      icon: "🧠",
      earnedAt: "2024-01-20",
    },
  ],
};

const TOPICS: Record<string, TopicTag> = {
  geology: {
    id: "geology",
    label: "Geology",
    subject: "Science",
  },
  circuits: {
    id: "circuits",
    label: "Circuits",
    subject: "Technology",
  },
  logic: {
    id: "logic",
    label: "Logic",
    subject: "Mathematics",
  },
  probability: {
    id: "prob",
    label: "Probability",
    subject: "Mathematics",
  },
  biology: { id: "bio", label: "Biology", subject: "Science" },
  physics: { id: "phys", label: "Physics", subject: "Science" },
  coding: {
    id: "code",
    label: "Coding",
    subject: "Technology",
  },
  art: {
    id: "art",
    label: "Digital Art",
    subject: "Technology",
  },
};

export const MOCK_COURSES: Course[] = [
  {
    id: "games",
    title: "STEM x Games",
    icon: "Gamepad2",
    color: "bg-purple-600",
    locked: false,
    modules: [
      {
        id: "minecraft",
        title: "Minecraft",
        description:
          "Explore geology and engineering through cubic worlds.",
        thumbnail:
          "https://images.unsplash.com/photo-1615485500704-8e990f3900f1?w=400&q=80",
        progress: 45,
        tags: [TOPICS.geology, TOPICS.circuits, TOPICS.logic],
        contents: [
          {
            id: "m1v",
            type: "video",
            title: "Minecraft Geology",
            duration: "6:00",
            xp: 50,
            completed: true,
          },
          {
            id: "m1q",
            type: "quiz",
            title: "Layers of the Earth",
            xp: 100,
            completed: false,
            quizQuestions: [
              {
                question: "Which layer is the hottest?",
                options: ["Crust", "Mantle", "Core"],
                correctAnswer: 2,
              },
            ],
          },
          {
            id: "m1su",
            type: "summary",
            title: "Geology Summary",
            xp: 20,
            completed: false,
            summaryText:
              "The Earth has 4 main layers: Crust, Mantle, Outer Core, and Inner Core.",
          },
          {
            id: "m1sim",
            type: "simulation",
            title: "Core Explorer",
            xp: 150,
            completed: false,
          },
          {
            id: "m1a",
            type: "activity",
            title: "Clay Model Earth",
            xp: 200,
            completed: false,
          },
        ],
      },
      {
        id: "monopoly",
        title: "Monopoly",
        description: "Probability and financial math.",
        thumbnail:
          "https://images.unsplash.com/photo-1591485423007-765bde4139ef?w=400&q=80",
        progress: 0,
        tags: [TOPICS.probability, TOPICS.logic],
        contents: [],
      },
      {
        id: "amongus",
        title: "Among Us",
        description: "Deductive reasoning and task management.",
        thumbnail:
          "https://images.unsplash.com/photo-1614680376593-902f74cc0d41?w=400&q=80",
        progress: 0,
        tags: [TOPICS.logic, TOPICS.coding],
        contents: [],
      },
    ],
  },
  {
    id: "sports",
    title: "STEM x Sports",
    icon: "Trophy",
    color: "bg-emerald-600",
    locked: true,
    modules: [
      {
        id: "running",
        title: "Running",
        description: "Biology of movement and pace.",
        thumbnail:
          "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80",
        progress: 0,
        tags: [TOPICS.biology, TOPICS.physics],
        contents: [],
      },
      {
        id: "football",
        title: "Football",
        description: "Projectile motion and trajectory.",
        thumbnail:
          "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80",
        progress: 0,
        tags: [TOPICS.physics, TOPICS.logic],
        contents: [],
      },
      {
        id: "bowling",
        title: "Bowling",
        description: "Friction and angular momentum.",
        thumbnail:
          "https://images.unsplash.com/photo-1544126592-807daa2b565b?w=400&q=80",
        progress: 0,
        tags: [TOPICS.physics],
        contents: [],
      },
    ],
  },
  {
    id: "magic",
    title: "STEM x Magic",
    icon: "Wand2",
    color: "bg-blue-600",
    locked: true,
    modules: [
      {
        id: "water",
        title: "Water",
        description: "Surface tension and states of matter.",
        thumbnail:
          "https://images.unsplash.com/photo-1527067829737-402993088e6b?w=400&q=80",
        progress: 0,
        tags: [TOPICS.biology, TOPICS.physics],
        contents: [],
      },
      {
        id: "magnets",
        title: "Magnets",
        description: "Magnetic fields and attraction.",
        thumbnail:
          "https://images.unsplash.com/photo-1582231243734-7546654e83c7?w=400&q=80",
        progress: 0,
        tags: [TOPICS.physics, TOPICS.circuits],
        contents: [],
      },
      {
        id: "real-life",
        title: "Real Life",
        description: "Psychology of magic and perception.",
        thumbnail:
          "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=400&q=80",
        progress: 0,
        tags: [TOPICS.biology, TOPICS.logic],
        contents: [],
      },
    ],
  },
  {
    id: "content",
    title: "STEM x Content Creation",
    icon: "Camera",
    color: "bg-rose-600",
    locked: true,
    modules: [
      {
        id: "scratch",
        title: "Stories with Scratch",
        description: "Sequence, loops, and logic.",
        thumbnail:
          "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=400&q=80",
        progress: 0,
        tags: [TOPICS.coding, TOPICS.logic],
        contents: [],
      },
      {
        id: "digital-art",
        title: "Google Slides, Digital Art, Augmented Reality",
        description: "Color theory and 3D modeling.",
        thumbnail:
          "https://images.unsplash.com/photo-1558655146-d09347e92766?w=400&q=80",
        progress: 0,
        tags: [TOPICS.art, TOPICS.coding],
        contents: [],
      },
      {
        id: "imovie",
        title: "iMovie & video-editing",
        description: "Sound waves and video compression.",
        thumbnail:
          "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&q=80",
        progress: 0,
        tags: [TOPICS.art, TOPICS.physics],
        contents: [],
      },
    ],
  },
];

export const MOCK_GALLERY: GalleryPost[] = [
  {
    id: "g1",
    username: "AlexScience",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    imageUrl:
      "https://images.unsplash.com/photo-1564325724739-bae0bd08bc62?w=500&q=80",
    caption: "My volcano project erupted! 🌋",
    likes: 24,
    tags: ["Science", "Volcano"],
  },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = Array.from(
  { length: 15 },
  (_, i) => ({
    id: `l${i}`,
    username: i === 2 ? "StemExplorer" : `Explorer_${i + 1}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i === 2 ? "StemExplorer" : "User" + i}`,
    xp: 5000 - i * 300,
    rank: i + 1,
  }),
);

export const MOCK_CARDS: Card[] = [
  { id: "c1", name: "Marie Curie", rarity: "legendary", category: "scientist", imageUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&q=80", description: "Pioneer in radioactivity research", fact: "First woman to win a Nobel Prize and the only person to win in two different sciences!" },
  { id: "c2", name: "Albert Einstein", rarity: "legendary", category: "scientist", imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80", description: "Father of modern physics", fact: "His brain was preserved for science after his death!" },
  { id: "c3", name: "Gravity", rarity: "epic", category: "phenomenon", imageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=80", description: "The force that keeps us grounded", fact: "Without gravity, you'd weigh nothing!" },
  { id: "c4", name: "Lightning", rarity: "rare", category: "phenomenon", imageUrl: "https://images.unsplash.com/photo-1431440869543-efaf3388c585?w=400&q=80", description: "Nature's electric spectacular", fact: "Lightning is 5 times hotter than the sun!" },
  { id: "c5", name: "DNA Double Helix", rarity: "epic", category: "funfact", imageUrl: "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400&q=80", description: "The blueprint of life", fact: "If uncoiled, DNA from one cell would be 6 feet long!" },
  { id: "c6", name: "Nikola Tesla", rarity: "legendary", category: "scientist", imageUrl: "https://images.unsplash.com/photo-1509869175650-a1d97972541a?w=400&q=80", description: "Master of electricity", fact: "Tesla could speak 8 languages!" },
];

export const MOCK_CARD_PACKS: CardPack[] = [
  { id: "p1", name: "Starter Pack", cost: 50, cardsCount: 3, description: "Perfect for beginners!" },
  { id: "p2", name: "Science Pack", cost: 100, cardsCount: 5, description: "Discover amazing scientists!" },
  { id: "p3", name: "Mega Pack", cost: 200, cardsCount: 10, description: "The ultimate collection!" },
];