// P1–2 and P3–4 gate questions for Drippy's Water Cycle Dash (src/games/DropDash.tsx),
// three or more per stage. The P5–6 set stays in that file. In each question `a[0]` is
// the right answer (the game shuffles the three lanes), and answers are kept short so
// they fit a lane.
import type { Banded, DropQuestion, DropZoneKey } from "./types";

export const DROP_DASH_BANKS: Banded<Record<DropZoneKey, DropQuestion[]>> = {
  p12: {
    evaporation: [
      { q: "The Sun shines on a puddle. What happens to it?", a: ["It dries up", "It gets bigger", "It turns to ice"], why: "The Sun's heat dries the puddle, and the water rises into the air." },
      { q: "What warms the sea on a sunny day?", a: ["The Sun", "The Moon", "A cloud"], why: "The Sun's heat warms the sea, and some water rises into the air." },
      { q: "Wet clothes dry fastest on a…", a: ["Sunny day", "Rainy day", "Cold night"], why: "Sunshine warms the clothes, so the water dries up faster." },
    ],
    transpiration: [
      { q: "Which part of a plant drinks water from the soil?", a: ["The roots", "The flowers", "The fruit"], why: "Roots soak up water from the soil, like a straw." },
      { q: "Water travels up a plant from the roots to the…", a: ["Leaves", "Soil", "Rocks"], why: "Water moves up the stem all the way to the leaves." },
      { q: "Leaves let tiny bits of water out into the…", a: ["Air", "Soil", "Roots"], why: "Leaves let water out into the air, in bits too tiny to see." },
    ],
    condensation: [
      { q: "What is a cloud made of?", a: ["Tiny water drops", "Cotton wool", "Smoke"], why: "A cloud is made of lots and lots of tiny water drops." },
      { q: "You breathe on a cold mirror. What appears on it?", a: ["Tiny water drops", "Sand", "Paint"], why: "The cold mirror turns the water in your warm breath into tiny drops." },
      { q: "It is very cold high in the sky. What forms there?", a: ["Clouds", "Puddles", "Rivers"], why: "Cold air turns water in the air into tiny drops that make clouds." },
    ],
    precipitation: [
      { q: "What falls from grey clouds on a rainy day?", a: ["Rain", "Sand", "Leaves"], why: "Rain is water falling from the clouds." },
      { q: "On a very cold mountain, what falls from the clouds?", a: ["Snow", "Steam", "Sand"], why: "When it is very cold, water falls from clouds as snow." },
      { q: "Water drops in a cloud get big and heavy. Then what?", a: ["They fall down", "They fly up", "They turn to sand"], why: "Heavy drops fall from the cloud as rain." },
    ],
    collection: [
      { q: "Rain falls on a hill. Which way does the water flow?", a: ["Down the hill", "Up the hill", "Up to the Sun"], why: "Water always flows downhill, into drains, rivers and the sea." },
      { q: "Where can you find lots and lots of water?", a: ["In the sea", "In a desert", "In a sandpit"], why: "Rain flows into rivers, lakes and the sea." },
      { q: "Sea water gets warm in the sun. Then what?", a: ["Some rises into the air", "It turns to sand", "It turns to stone"], why: "Some of the warm water rises into the air in bits too tiny to see." },
    ],
  },
  p34: {
    evaporation: [
      { q: "Heat from the Sun turns liquid water into a gas called…", a: ["Water vapour", "Smoke", "Ice"], why: "Liquid water turning into water vapour is called evaporation." },
      { q: "Wet clothes dry fastest on which kind of day?", a: ["Hot and sunny", "Cold and cloudy", "Rainy"], why: "Water evaporates faster when it is warmer." },
      { q: "Water evaporates when it…", a: ["Gains heat", "Loses heat", "Freezes"], why: "Water gains heat from the Sun and turns into water vapour." },
    ],
    transpiration: [
      { q: "Which part of a plant takes in water from the soil?", a: ["The roots", "The leaves", "The flowers"], why: "Roots take in water, and the stem carries it up the plant." },
      { q: "Which part of a plant carries water up to the leaves?", a: ["The stem", "The roots", "The flowers"], why: "The stem carries water from the roots up to the leaves." },
      { q: "Plants give off water vapour through tiny holes in their…", a: ["Leaves", "Roots", "Seeds"], why: "Water vapour escapes through tiny holes in the leaves, and this is transpiration." },
    ],
    condensation: [
      { q: "Water vapour high in the sky cools down. It turns into…", a: ["Tiny water droplets", "Hot steam", "Sand"], why: "Cooling turns water vapour into droplets, and this is condensation." },
      { q: "Water droplets form on the outside of a cold glass. This is…", a: ["Condensation", "Evaporation", "Melting"], why: "Water vapour in the air cools on the cold glass and condenses into droplets." },
      { q: "Condensation happens when water vapour…", a: ["Cools down", "Heats up", "Gets saltier"], why: "Water vapour that loses heat turns back into liquid droplets." },
    ],
    precipitation: [
      { q: "Rain, snow and hail falling from clouds is called…", a: ["Precipitation", "Evaporation", "Condensation"], why: "Any water falling from clouds is called precipitation." },
      { q: "Droplets in a cloud join up and get heavy. Then they…", a: ["Fall as rain", "Rise higher", "Turn into vapour"], why: "Heavy droplets are pulled down and fall as rain." },
      { q: "Which of these falls from very cold clouds?", a: ["Snow", "Water vapour", "Smoke"], why: "Snow is frozen water that falls from very cold clouds." },
    ],
    collection: [
      { q: "In Singapore, rainwater is stored in big lakes called…", a: ["Reservoirs", "Puddles", "Clouds"], why: "Drains and canals carry rainwater into Singapore's reservoirs." },
      { q: "Rainwater flows downhill and collects in…", a: ["Rivers and lakes", "Clouds", "Mountain tops"], why: "Water flows down into rivers, lakes and the sea." },
      { q: "What happens to collected water on a sunny day?", a: ["It evaporates again", "It turns into rock", "It is gone forever"], why: "The Sun heats the water again, so the water cycle starts over." },
    ],
  },
};
