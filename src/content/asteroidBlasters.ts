// P1–2 and P3–4 questions for Asteroid Blasters (src/games/AsteroidBlasters.tsx): 7 on
// forces and 7 on energy per band. The P5–6 set stays in that file. Answers ride on the
// asteroids, so `a` and `wrong` stay a word or two long.
import type { Banded, BlasterQuestion } from "./types";

export const BLASTER_BANKS: Banded<{ forces: BlasterQuestion[]; energy: BlasterQuestion[] }> = {
  p12: {
    forces: [
      { q: "Kicking a ball away from you is a…", a: "Push", wrong: ["Pull", "Twist"], why: "Moving something away from you is a push." },
      { q: "A crewmate drags a box towards them. That is a…", a: "Pull", wrong: ["Push", "Twist"], why: "Moving something towards you is a pull." },
      { q: "A magnet picks up a paper clip. That is a…", a: "Pull", wrong: ["Push", "Twist"], why: "Magnets pull some metal things towards them." },
      { q: "Blast the thing that floats on water!", a: "Leaf", wrong: ["Stone", "Coin"], why: "A leaf floats on top of the water." },
      { q: "Blast the thing that sinks in water!", a: "Stone", wrong: ["Leaf", "Feather"], why: "A stone sinks to the bottom of the water." },
      { q: "You drop a ball. Which way does it fall?", a: "Down", wrong: ["Up", "Sideways"], why: "The Earth pulls everything down, and that pull is called gravity." },
      { q: "Squashing play dough flat is a…", a: "Push", wrong: ["Pull", "Twist"], why: "You press down on the dough, and that is a push." },
    ],
    energy: [
      { q: "Blast the thing that lights up the sky in the day!", a: "Sun", wrong: ["Moon", "Rock"], why: "The Sun gives us light in the day." },
      { q: "Blast the thing that warms the ground!", a: "Sunshine", wrong: ["Ice", "Snow"], why: "Sunshine warms the ground, the sea and us." },
      { q: "Blast the hottest thing!", a: "Campfire", wrong: ["Ice cream", "Snowball"], why: "A campfire gives out lots of heat, so we keep a safe distance." },
      { q: "Blast the thing that makes a loud sound!", a: "Drum", wrong: ["Pillow", "Sponge"], why: "Banging a drum makes a loud sound." },
      { q: "The SKELD's lights go out! What helps you see?", a: "Torch", wrong: ["Blanket", "Pillow"], why: "A torch gives out light, so you can see in the dark." },
      { q: "What does food give you to run and play?", a: "Energy", wrong: ["Shadows", "Sand"], why: "Food gives your body energy to move, grow and play." },
      { q: "Ice cream sits in the hot sun. It will…", a: "Melt", wrong: ["Freeze", "Grow"], why: "The Sun's heat makes ice cream melt." },
    ],
  },
  p34: {
    forces: [
      { q: "Blast the material a magnet attracts!", a: "Iron", wrong: ["Wood", "Glass"], why: "Magnets attract iron, steel, nickel and cobalt." },
      { q: "Blast the object a magnet can pick up!", a: "Paper clip", wrong: ["Rubber band", "Plastic ruler"], why: "Steel paper clips are magnetic, but rubber and plastic are not." },
      { q: "Two north poles face each other. What do they do?", a: "Repel", wrong: ["Attract", "Glow"], why: "Like poles repel, so they push each other away." },
      { q: "A north pole faces a south pole. What do they do?", a: "Attract", wrong: ["Repel", "Glow"], why: "Unlike poles attract, so they pull towards each other." },
      { q: "A crewmate's magnet pulls an iron nail. That pull is a…", a: "Force", wrong: ["Light", "Sound"], why: "Every push or pull is a force." },
      { q: "Where is a bar magnet's pull strongest?", a: "At the poles", wrong: ["In the middle", "All the same"], why: "A magnet's pull is strongest at its poles, near the ends." },
      { q: "A compass needle is a tiny magnet. It points…", a: "North", wrong: ["East", "West"], why: "A compass needle lines up to point north and south." },
    ],
    energy: [
      { q: "Blast the thing that gives off its own light!", a: "Sun", wrong: ["Moon", "Mirror"], why: "The Sun makes its own light, while the Moon and mirrors reflect it." },
      { q: "An object blocks the light and makes a…", a: "Shadow", wrong: ["Rainbow", "Mirror"], why: "A shadow forms where an object blocks the light." },
      { q: "Blast the best heat conductor for a cooking pot!", a: "Metal", wrong: ["Wood", "Plastic"], why: "Metal is a good conductor, so heat passes quickly to the food." },
      { q: "Blast a good heat insulator for a pot handle!", a: "Plastic", wrong: ["Steel", "Copper"], why: "Plastic is a poor conductor of heat, so the handle stays cool." },
      { q: "Heat flows from a hotter object to a…", a: "Colder object", wrong: ["Hotter object", "Heavier object"], why: "Heat always flows from a hotter place to a colder one." },
      { q: "A metal spoon sits in hot soup. The spoon…", a: "Gains heat", wrong: ["Loses heat", "Melts"], why: "Heat flows from the hot soup into the cooler spoon." },
      { q: "We see an object when light from it enters our…", a: "Eyes", wrong: ["Ears", "Hands"], why: "Light bounces off things and travels into our eyes." },
    ],
  },
};
