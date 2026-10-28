// P1–2 and P3–4 blocks for Phase Fixer, the solid / liquid / gas sorter in the
// Minecraft episode (src/episodes/minigames/MatterSorter.tsx). The game deals 10 of
// them per round; the P5–6 set stays in that file. `color` fills the floating block.
import type { Banded, MatterItem } from "./types";

export const MATTER_ITEMS: Banded<MatterItem[]> = {
  p12: [
    { name: "Ice cube", state: "solid", color: "#bae6fd", why: "An ice cube is hard and keeps its shape, so it is a solid." },
    { name: "Stone block", state: "solid", color: "#a3a3a3", why: "A stone block keeps its shape, so it is a solid." },
    { name: "Wooden plank", state: "solid", color: "#b7834a", why: "A wooden plank stays the same shape, so it is a solid." },
    { name: "Toy block", state: "solid", color: "#ef4444", why: "A toy block keeps its shape when you hold it, so it is a solid." },
    { name: "Diamond", state: "solid", color: "#67e8f9", why: "A diamond is very hard and keeps its shape, so it is a solid." },
    { name: "Water in a glass", state: "liquid", color: "#3b82f6", why: "Water flows and takes the shape of its glass, so it is a liquid." },
    { name: "Orange juice", state: "liquid", color: "#fb923c", why: "Juice pours and flows, so it is a liquid." },
    { name: "Chocolate milk", state: "liquid", color: "#8b5a2b", why: "Chocolate milk pours and flows, so it is a liquid." },
    { name: "Rainwater", state: "liquid", color: "#60a5fa", why: "Rainwater flows into puddles, so it is a liquid." },
    { name: "Soya sauce", state: "liquid", color: "#5b3a1e", why: "Soya sauce pours out of the bottle, so it is a liquid." },
    { name: "Air in a balloon", state: "gas", color: "#e0f2fe", why: "A balloon is filled with air, and air is a gas." },
    { name: "Air in a tyre", state: "gas", color: "#e2e8f0", why: "A bicycle tyre is pumped full of air, which is a gas." },
    { name: "Wind", state: "gas", color: "#dbeafe", why: "Wind is moving air, and air is a gas." },
    { name: "Bubbles in soda", state: "gas", color: "#f1f5f9", why: "The bubbles in soda are full of gas." },
  ],
  p34: [
    { name: "Iron nail", state: "solid", color: "#6b7280", why: "An iron nail has a fixed shape and a fixed volume, so it is a solid." },
    { name: "Glass block", state: "solid", color: "#cffafe", why: "A glass block keeps its shape and volume, so it is a solid." },
    { name: "Gold ingot", state: "solid", color: "#facc15", why: "A gold ingot has a fixed shape and volume, so it is a solid." },
    { name: "Cobblestone", state: "solid", color: "#78716c", why: "Cobblestone keeps its shape and volume, so it is a solid." },
    { name: "Wooden chair", state: "solid", color: "#a16207", why: "A chair keeps its shape and volume, so it is a solid." },
    { name: "Cooking oil", state: "liquid", color: "#eab308", why: "Oil takes the shape of its bottle but keeps its volume, so it is a liquid." },
    { name: "Seawater", state: "liquid", color: "#0ea5e9", why: "Seawater flows and has no fixed shape, so it is a liquid." },
    { name: "Lime juice", state: "liquid", color: "#bef264", why: "Lime juice pours and takes the shape of its cup, so it is a liquid." },
    { name: "Melted ice", state: "liquid", color: "#93c5fd", why: "Ice that gains heat melts into water, which is a liquid." },
    { name: "Shampoo", state: "liquid", color: "#c084fc", why: "Shampoo flows slowly, but it takes the shape of its bottle, so it is a liquid." },
    { name: "Water vapour", state: "gas", color: "#dbeafe", why: "Water vapour is water as a gas, and it is too small to see." },
    { name: "Oxygen", state: "gas", color: "#e0f2fe", why: "Oxygen is one of the gases in the air we breathe." },
    { name: "Air in a football", state: "gas", color: "#f1f5f9", why: "Air spreads out to fill the whole football, so it is a gas." },
    { name: "Air in bubble wrap", state: "gas", color: "#ecfeff", why: "Each bubble in bubble wrap is filled with air, a gas." },
  ],
};
