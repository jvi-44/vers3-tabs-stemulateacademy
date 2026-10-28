// P1–2 and P3–4 versions of every lesson quiz in src/data/lessonContent.ts, which
// keeps the original questions as the P5–6 set. Each band has the same number of
// questions as the original quiz, and every question has an explanation.
import type { Banded, QuizBeatId, QuizQuestion } from "./types";

export const QUIZ_BANDS: Record<QuizBeatId, Banded<QuizQuestion[]>> = {
  // ── Minecraft Masterminds · Science 1: Cycles in Matter ──
  "mm-sci1-quiz": {
    p12: [
      {
        question: "Which one is hard and keeps its shape?",
        options: ["A stone block", "Water", "Milk", "Orange juice"],
        correctAnswer: 0,
        explanation: "A stone block is hard and stays the same shape, just like in Minecraft.",
      },
      {
        question: "Which one can you pour from a bucket?",
        options: ["A stone block", "Water", "A wooden plank", "An ice block"],
        correctAnswer: 1,
        explanation: "Water flows, so you can pour it out of a bucket.",
      },
      {
        question: "An ice block sits in the hot sun. What happens?",
        options: ["It gets bigger", "It turns into a rock", "It melts into water", "It stays the same"],
        correctAnswer: 2,
        explanation: "The Sun's heat melts the ice into water.",
      },
      {
        question: "You put water in the freezer. What does it become?",
        options: ["Ice", "Steam", "Sand", "Mud"],
        correctAnswer: 0,
        explanation: "When water gets very cold, it freezes into ice.",
      },
      {
        question: "Wet clothes hang in the hot sun. What happens to them?",
        options: ["They get wetter", "They get heavier", "They turn into ice", "They dry"],
        correctAnswer: 3,
        explanation: "The Sun's heat dries the clothes, and the water goes into the air.",
      },
    ],
    p34: [
      {
        question: "Which of these has a fixed shape and a fixed volume?",
        options: ["Water in a bucket", "Air in a balloon", "A stone block", "Juice in a cup"],
        correctAnswer: 2,
        explanation: "A stone block is a solid, so its shape and volume stay the same.",
      },
      {
        question: "All the water in a bucket is poured into a bowl. What changes?",
        options: ["Its shape", "Its volume", "Its mass", "Its colour"],
        correctAnswer: 0,
        explanation: "A liquid takes the shape of its container, but its volume stays the same.",
      },
      {
        question: "Ice gains heat and turns into water. What is this change called?",
        options: ["Freezing", "Melting", "Boiling", "Condensation"],
        correctAnswer: 1,
        explanation: "When a solid gains enough heat and turns into a liquid, it melts.",
      },
      {
        question: "Water loses heat in a freezer and turns into ice. What is this called?",
        options: ["Melting", "Evaporation", "Freezing", "Boiling"],
        correctAnswer: 2,
        explanation: "When water loses enough heat, it freezes into solid ice.",
      },
      {
        question: "Wet clothes dry in the sun. Where does the water go?",
        options: ["It vanishes forever", "It evaporates into the air", "It turns into ice", "It stays in the clothes"],
        correctAnswer: 1,
        explanation: "The Sun's heat turns the water into water vapour, which goes into the air.",
      },
    ],
  },

  // ── Minecraft Masterminds · Science 2: Cycles in Water ──
  "mm-sci2-quiz": {
    p12: [
      {
        question: "After the rain, the Sun comes out. What happens to puddles?",
        options: ["They get bigger", "They dry up", "They turn into ice", "They turn into sand"],
        correctAnswer: 1,
        explanation: "The Sun's heat dries up puddles, and the water rises into the air.",
      },
      {
        question: "In Minecraft and in real life, where does rain fall from?",
        options: ["The Sun", "The ground", "Clouds", "Mountains"],
        correctAnswer: 2,
        explanation: "Rain falls from clouds, just like in a Minecraft rainstorm.",
      },
      {
        question: "Rain falls on a hill. Which way does the water flow?",
        options: ["Up the hill", "Down the hill", "It stays at the top"],
        correctAnswer: 1,
        explanation: "Water always flows downhill, into drains, rivers and the sea.",
      },
      {
        question: "What are clouds made of?",
        options: ["Cotton wool", "Smoke", "Tiny drops of water", "White paper"],
        correctAnswer: 2,
        explanation: "Clouds are made of lots of tiny water drops floating in the sky.",
      },
    ],
    p34: [
      {
        question: "On a sunny day, a puddle slowly disappears. What is this called?",
        options: ["Condensation", "Evaporation", "Freezing", "Melting"],
        correctAnswer: 1,
        explanation: "The Sun's heat turns the puddle water into water vapour, and that is evaporation.",
      },
      {
        question: "High in the sky, water vapour cools into tiny droplets. What do the droplets form?",
        options: ["Clouds", "Rivers", "Puddles", "Ice cubes"],
        correctAnswer: 0,
        explanation: "Cooling turns water vapour into droplets, which gather into clouds.",
      },
      {
        question: "Rain, snow and hail all fall from clouds. What are they called?",
        options: ["Evaporation", "Condensation", "Collection", "Precipitation"],
        correctAnswer: 3,
        explanation: "Any water that falls from clouds is called precipitation.",
      },
      {
        question: "Rain fills a pond in a Minecraft swamp. In real life, what would the Sun do next?",
        options: ["Turn it into stone", "Heat it so some evaporates", "Make it flow uphill", "Freeze it into ice"],
        correctAnswer: 1,
        explanation: "The Sun heats the pond, so some water evaporates and the cycle starts again.",
      },
    ],
  },

  // ── Minecraft Masterminds · Maths 1: Area ──
  "mm-math1-quiz": {
    p12: [
      {
        question: "A Minecraft floor has 2 rows of 3 blocks. How many blocks?",
        options: ["5", "6", "3", "9"],
        correctAnswer: 1,
        explanation: "Count them: 3 + 3 = 6 blocks cover the floor.",
      },
      {
        question: "Sophia's floor has 9 blocks. Timothy's has 4. Whose floor is bigger?",
        options: ["Sophia's", "Timothy's", "They are the same size"],
        correctAnswer: 0,
        explanation: "9 is more than 4, so Sophia's floor covers more space.",
      },
      {
        question: "A square floor has 3 rows of 3 blocks. How many blocks?",
        options: ["6", "12", "9", "3"],
        correctAnswer: 2,
        explanation: "3 + 3 + 3 = 9 blocks fill the square floor.",
      },
      {
        question: "Who counts floor space to buy the right number of tiles?",
        options: ["A singer", "A bus driver", "A baker", "A builder"],
        correctAnswer: 3,
        explanation: "Builders measure floors so they buy just enough tiles.",
      },
    ],
    p34: [
      {
        question: "How do you find the area of a rectangle?",
        options: ["Length + width", "Length × width", "Length - width", "Length ÷ width"],
        correctAnswer: 1,
        explanation: "Multiply the length by the width to find how many square units cover it.",
      },
      {
        question: "A Minecraft floor is 6 blocks long and 4 blocks wide. How many blocks cover it?",
        options: ["10", "20", "24", "28"],
        correctAnswer: 2,
        explanation: "6 × 4 = 24, so 24 blocks cover the floor.",
      },
      {
        question: "A garden is 8 m long and 5 m wide. What is its area?",
        options: ["40 m²", "13 m²", "26 m²", "45 m²"],
        correctAnswer: 0,
        explanation: "8 m × 5 m = 40 m², the space inside the garden.",
      },
      {
        question: "Floor A is 5 blocks by 4 blocks. Floor B is 3 blocks by 7 blocks. Which floor is bigger?",
        options: ["Floor A", "Floor B", "They are the same size"],
        correctAnswer: 1,
        explanation: "Floor A is 5 × 4 = 20 blocks and Floor B is 3 × 7 = 21 blocks, so B is bigger.",
      },
    ],
  },

  // ── Minecraft Masterminds · Maths 2: Volume ──
  "mm-math2-quiz": {
    p12: [
      {
        question: "A tower has 5 cubes. You add 3 more. How many now?",
        options: ["7", "8", "2", "9"],
        correctAnswer: 1,
        explanation: "5 + 3 = 8 cubes in the tower.",
      },
      {
        question: "A box has 2 layers of 4 cubes. How many cubes?",
        options: ["6", "4", "10", "8"],
        correctAnswer: 3,
        explanation: "Each layer has 4 cubes, so 4 + 4 = 8 cubes.",
      },
      {
        question: "Box A holds 10 cubes. Box B holds 7. Which holds more?",
        options: ["Box A", "Box B", "They hold the same"],
        correctAnswer: 0,
        explanation: "10 is more than 7, so Box A holds more cubes.",
      },
      {
        question: "Which one takes up the most space?",
        options: ["A coin", "A pencil", "A big toy box", "A button"],
        correctAnswer: 2,
        explanation: "A big toy box takes up much more space than the small things.",
      },
    ],
    p34: [
      {
        question: "A Minecraft storage box has 3 layers of cubes. Each layer has 6 cubes. How many cubes fill the box?",
        options: ["9", "18", "15", "24"],
        correctAnswer: 1,
        explanation: "3 layers × 6 cubes = 18 cubes.",
      },
      {
        question: "Area measures flat space. What does volume measure?",
        options: ["How heavy an object is", "How long a line is", "The space a 3D object takes up", "How hot an object is"],
        correctAnswer: 2,
        explanation: "Volume is the amount of space a 3D object takes up.",
      },
      {
        question: "Two towers have 6 cubes in every layer. Tower A has 2 layers and Tower B has 4 layers. Which has more cubes?",
        options: ["Tower B", "Tower A", "They have the same"],
        correctAnswer: 0,
        explanation: "Tower A has 2 × 6 = 12 cubes and Tower B has 4 × 6 = 24 cubes.",
      },
      {
        question: "A fish tank is filled with 4 buckets of water. Each bucket holds 5 litres. How much water is in the tank?",
        options: ["9 litres", "20 litres", "15 litres", "25 litres"],
        correctAnswer: 1,
        explanation: "4 buckets × 5 litres = 20 litres of water in the tank.",
      },
    ],
  },

  // ── Mission Millionaire · Maths 1: Adding and taking away money ──
  "mi-math1-quiz": {
    p12: [
      {
        question: "You have $15 and pay $6 rent. How much is left?",
        options: ["$21", "$9", "$11", "$6"],
        correctAnswer: 1,
        explanation: "$15 - $6 = $9, so you still have $9 to spend.",
      },
    ],
    p34: [
      {
        question: "You have $10.50 and pay $3.20 rent in Monopoly. How much is left?",
        options: ["$13.70", "$7.70", "$7.30", "$6.30"],
        correctAnswer: 2,
        explanation: "$10.50 - $3.20 = $7.30: take away the dollars, then the cents.",
      },
    ],
  },

  // ── Mission Millionaire · Maths 2: Discounts ──
  "mi-math2-quiz": {
    p12: [
      {
        question: "A $10 toy is $2 cheaper today. What does it cost now?",
        options: ["$8", "$12", "$2", "$10"],
        correctAnswer: 0,
        explanation: "$10 - $2 = $8, so the toy costs less today.",
      },
    ],
    p34: [
      {
        question: "A board game costs $24.50. The shop gives $5 off. How much do you pay?",
        options: ["$29.50", "$20.50", "$19.00", "$19.50"],
        correctAnswer: 3,
        explanation: "$5 off means you pay $5 less: $24.50 - $5 = $19.50.",
      },
    ],
  },

  // ── Space Busters · Science 1: Energy ──
  "sb-sci1-quiz": {
    p12: [
      {
        question: "The SKELD flies near the Sun. What does the Sun give out?",
        options: ["Snow and ice", "Light and heat", "Cold wind", "Rain"],
        correctAnswer: 1,
        explanation: "The Sun gives out light and heat, which is why it is bright and warm.",
      },
    ],
    p34: [
      {
        question: "Which of these gives off its own light?",
        options: ["The Moon", "A mirror", "The Sun", "A shiny spoon"],
        correctAnswer: 2,
        explanation: "The Sun makes its own light, while the Moon and mirrors only reflect light.",
      },
    ],
  },

  // ── Space Busters · Science 2: Forces ──
  "sb-sci2-quiz": {
    p12: [
      {
        question: "Which one is a pull?",
        options: ["Kicking a ball", "Opening a drawer towards you", "Pressing a button", "Pushing a trolley"],
        correctAnswer: 1,
        explanation: "When you move something towards you, that is a pull.",
      },
    ],
    p34: [
      {
        question: "A crewmate drops something on the SKELD. Which one can a magnet pick up?",
        options: ["A plastic cup", "A wooden spoon", "A rubber band", "An iron nail"],
        correctAnswer: 3,
        explanation: "Magnets attract things made of iron, but not plastic, wood or rubber.",
      },
    ],
  },

  // ── Space Busters · Maths 1: Order of operations ──
  "sb-math1-quiz": {
    p12: [
      {
        question: "Fix the ship! What is 7 + 5 - 2?",
        options: ["14", "10", "12", "4"],
        correctAnswer: 1,
        explanation: "First 7 + 5 = 12, then 12 - 2 = 10.",
      },
    ],
    p34: [
      {
        question: "Fix the ship's engine! What is (8 + 4) × 3?",
        options: ["20", "15", "36", "32"],
        correctAnswer: 2,
        explanation: "Brackets first: 8 + 4 = 12, then 12 × 3 = 36.",
      },
    ],
  },
};
