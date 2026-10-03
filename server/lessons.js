// Server-side copy of the lesson "beats" from src/data/lessonContent.ts.
// The server uses it to look up what a beat is about (for the STEMbot chat)
// instead of trusting text sent by the browser.
// Keep in sync with src/data/lessonContent.ts — src/__tests__/server-mirror.test.ts
// fails if the two drift apart.

export const LESSONS = {
  "minecraft-masterminds": { title: "Minecraft Masterminds" },
  "mission-millionaire": { title: "Mission Millionaire" },
  "space-busters": { title: "Space Busters" },
};

export const BEATS = [
  // Minecraft Masterminds
  {"id":"mm-intro","lessonId":"minecraft-masterminds","type":"intro","subject":null,"title":"Intro Story","description":"Join the STEMbots as they land in a blocky new world and set out to explore every biome Minecraft has to offer — using STEM to understand what makes each one tick."},
  {"id":"mm-sci1-video","lessonId":"minecraft-masterminds","type":"video","subject":"science","title":"Cycles in Matter","description":"Discover the three states of matter — solid, liquid, and gas — and how energy causes matter to change between them. From ice in the tundra to lava in the Nether, Minecraft shows all three states in action!"},
  {"id":"mm-sci1-quiz","lessonId":"minecraft-masterminds","type":"quiz","subject":"science","title":"Cycles in Matter Quiz","description":"Test your knowledge of the three states of matter and phase changes."},
  {"id":"mm-sci2-video","lessonId":"minecraft-masterminds","type":"video","subject":"science","title":"Cycles in Water","description":"Follow a water droplet on its endless journey — evaporating from oceans, condensing into clouds, falling as rain, and collecting in rivers — just like water flows across Minecraft biomes!"},
  {"id":"mm-sci2-quiz","lessonId":"minecraft-masterminds","type":"quiz","subject":"science","title":"Cycles in Water Quiz","description":"Test your knowledge of the water cycle and how it connects to Minecraft biomes."},
  {"id":"mm-sci-sim","lessonId":"minecraft-masterminds","type":"simulation","subject":"science","title":"Water Cycle Biome Lab","description":"Control temperature and rainfall sliders to simulate different Minecraft biomes. Keep a forest biome alive by finding the perfect water cycle balance — just like real climate scientists!"},
  {"id":"mm-math1-video","lessonId":"minecraft-masterminds","type":"video","subject":"math","title":"Area (Length × Width)","description":"Learn how to calculate the area of rectangles and irregular shapes by breaking them into smaller rectangles — then use it to plan the perfect Minecraft biome house floor!"},
  {"id":"mm-math1-quiz","lessonId":"minecraft-masterminds","type":"quiz","subject":"math","title":"Area Quiz","description":"Calculate areas of rectangles and composite shapes."},
  {"id":"mm-math2-video","lessonId":"minecraft-masterminds","type":"video","subject":"math","title":"Volume (L × W × H)","description":"Add the third dimension! Learn how to calculate the volume of 3D shapes and use it to design your dream Minecraft storage room."},
  {"id":"mm-math2-quiz","lessonId":"minecraft-masterminds","type":"quiz","subject":"math","title":"Volume Quiz","description":"Calculate volumes of rectangular boxes and compare 3D spaces."},
  {"id":"mm-math-sim","lessonId":"minecraft-masterminds","type":"simulation","subject":"math","title":"Minecraft Room Designer","description":"Design your own Minecraft room! Adjust length, width, and height with sliders. The game calculates floor area and total volume in real time. Challenge: build 3 rooms with the same floor area — are their volumes the same?"},
  {"id":"mm-exit","lessonId":"minecraft-masterminds","type":"exit","subject":null,"title":"Exit Card","description":"Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have."},
  // Mission Millionaire
  {"id":"mi-intro","lessonId":"mission-millionaire","type":"intro","subject":null,"title":"Intro Story","description":"Timothy needs help managing a property empire — starting with the family's board game night."},
  {"id":"mi-math1-video","lessonId":"mission-millionaire","type":"video","subject":"math","title":"Addition & Subtraction with Decimals","description":"Track rent, salaries and bills to the cent as you play through a round of Monopoly."},
  {"id":"mi-math1-quiz","lessonId":"mission-millionaire","type":"quiz","subject":"math","title":"Decimals Quiz","description":"Add and subtract money amounts."},
  {"id":"mi-math2-video","lessonId":"mission-millionaire","type":"video","subject":"math","title":"Percentages, Taxes & Discounts","description":"Work out GST on purchases and calculate the real price after a shop discount."},
  {"id":"mi-math2-quiz","lessonId":"mission-millionaire","type":"quiz","subject":"math","title":"Percentages Quiz","description":"Practice GST and discount calculations."},
  {"id":"mi-math-sim","lessonId":"mission-millionaire","type":"simulation","subject":"math","title":"Singapore-themed Monopoly","description":"Play a Singapore-themed Monopoly round, budgeting for rent, GST and discounts in real time."},
  {"id":"mi-exit","lessonId":"mission-millionaire","type":"exit","subject":null,"title":"Exit Card","description":"Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have."},
  // Space Busters
  {"id":"sb-intro","lessonId":"space-busters","type":"intro","subject":null,"title":"Intro Story","description":"The crew's spaceship has lost power — can you restore the engines before the impostor strikes?"},
  {"id":"sb-sci1-video","lessonId":"space-busters","type":"video","subject":"science","title":"Energy","description":"Kinetic vs potential energy — how the ship's engines convert fuel into thrust."},
  {"id":"sb-sci1-quiz","lessonId":"space-busters","type":"quiz","subject":"science","title":"Energy Quiz","description":"Test your understanding of energy transfer."},
  {"id":"sb-sci2-video","lessonId":"space-busters","type":"video","subject":"science","title":"Forces","description":"Push, pull, thrust and gravity — the forces at play when a spaceship launches."},
  {"id":"sb-sci2-quiz","lessonId":"space-busters","type":"quiz","subject":"science","title":"Forces Quiz","description":"Check your knowledge of forces."},
  {"id":"sb-sci-sim","lessonId":"space-busters","type":"simulation","subject":"science","title":"Launching a Spaceship","description":"Launch an Among Us spaceship by balancing energy and forces to reach orbit."},
  {"id":"sb-math1-video","lessonId":"space-busters","type":"video","subject":"math","title":"Order of Operations","description":"BODMAS explained: solve multi-step calculations in the right order to fix the ship's systems."},
  {"id":"sb-math1-quiz","lessonId":"space-busters","type":"quiz","subject":"math","title":"BODMAS Quiz","description":"Practice BODMAS calculations."},
  {"id":"sb-math-sim","lessonId":"space-busters","type":"simulation","subject":"math","title":"Among Us Tasks as BODMAS","description":"Complete Among Us-style tasks that are really BODMAS questions in disguise."},
  {"id":"sb-exit","lessonId":"space-busters","type":"exit","subject":null,"title":"Exit Card","description":"Reflect: 3 things you learnt, 2 interesting facts or connections, 1 question you still have."},
];

export const BEATS_BY_ID = new Map(BEATS.map((b) => [b.id, b]));

const BOT_NAMES = { sophia: "Sophia", timothy: "Timothy", emily: "Emily", matthew: "Matthew" };

/** Same rule as BOT_FOR_BEAT in src/components/AskStembots.tsx. */
export function botNameForBeat(beat) {
  const key = beat.subject === "science" ? "sophia" : beat.subject === "math" ? "matthew" : "timothy";
  return BOT_NAMES[key];
}
