// Phenomena cards — front image already contains the question + category
// chip; back image contains the explanation. Extracted from
// phenomena_cards.pdf (16 cards).
import phen1f from "../assets/cards/phenomena/phen_1_front.jpg";
import phen1b from "../assets/cards/phenomena/phen_1_back.jpg";
import phen2f from "../assets/cards/phenomena/phen_2_front.jpg";
import phen2b from "../assets/cards/phenomena/phen_2_back.jpg";
import phen3f from "../assets/cards/phenomena/phen_3_front.jpg";
import phen3b from "../assets/cards/phenomena/phen_3_back.jpg";
import phen4f from "../assets/cards/phenomena/phen_4_front.jpg";
import phen4b from "../assets/cards/phenomena/phen_4_back.jpg";
import phen5f from "../assets/cards/phenomena/phen_5_front.jpg";
import phen5b from "../assets/cards/phenomena/phen_5_back.jpg";
import phen6f from "../assets/cards/phenomena/phen_6_front.jpg";
import phen6b from "../assets/cards/phenomena/phen_6_back.jpg";
import phen7f from "../assets/cards/phenomena/phen_7_front.jpg";
import phen7b from "../assets/cards/phenomena/phen_7_back.jpg";
import phen8f from "../assets/cards/phenomena/phen_8_front.jpg";
import phen8b from "../assets/cards/phenomena/phen_8_back.jpg";
import phen9f from "../assets/cards/phenomena/phen_9_front.jpg";
import phen9b from "../assets/cards/phenomena/phen_9_back.jpg";
import phen10f from "../assets/cards/phenomena/phen_10_front.jpg";
import phen10b from "../assets/cards/phenomena/phen_10_back.jpg";
import phen11f from "../assets/cards/phenomena/phen_11_front.jpg";
import phen11b from "../assets/cards/phenomena/phen_11_back.jpg";
import phen12f from "../assets/cards/phenomena/phen_12_front.jpg";
import phen12b from "../assets/cards/phenomena/phen_12_back.jpg";
import phen13f from "../assets/cards/phenomena/phen_13_front.jpg";
import phen13b from "../assets/cards/phenomena/phen_13_back.jpg";
import phen14f from "../assets/cards/phenomena/phen_14_front.jpg";
import phen14b from "../assets/cards/phenomena/phen_14_back.jpg";
import phen15f from "../assets/cards/phenomena/phen_15_front.jpg";
import phen15b from "../assets/cards/phenomena/phen_15_back.jpg";
import phen16f from "../assets/cards/phenomena/phen_16_front.jpg";
import phen16b from "../assets/cards/phenomena/phen_16_back.jpg";

// Figure cards — front image contains name/title/rarity chip already; back
// has "Why it matters" / achievements / fun fact. Extracted from
// figures_stemulate_academy.pdf (14 cards). Rarities below match what's
// printed on each card.
import fig1f from "../assets/cards/figures/fig_1_front.jpg";
import fig1b from "../assets/cards/figures/fig_1_back.jpg";
import fig2f from "../assets/cards/figures/fig_2_front.jpg";
import fig2b from "../assets/cards/figures/fig_2_back.jpg";
import fig3f from "../assets/cards/figures/fig_3_front.jpg";
import fig3b from "../assets/cards/figures/fig_3_back.jpg";
import fig4f from "../assets/cards/figures/fig_4_front.jpg";
import fig4b from "../assets/cards/figures/fig_4_back.jpg";
import fig5f from "../assets/cards/figures/fig_5_front.jpg";
import fig5b from "../assets/cards/figures/fig_5_back.jpg";
import fig6f from "../assets/cards/figures/fig_6_front.jpg";
import fig6b from "../assets/cards/figures/fig_6_back.jpg";
import fig7f from "../assets/cards/figures/fig_7_front.jpg";
import fig7b from "../assets/cards/figures/fig_7_back.jpg";
import fig8f from "../assets/cards/figures/fig_8_front.jpg";
import fig8b from "../assets/cards/figures/fig_8_back.jpg";
import fig9f from "../assets/cards/figures/fig_9_front.jpg";
import fig9b from "../assets/cards/figures/fig_9_back.jpg";
import fig10f from "../assets/cards/figures/fig_10_front.jpg";
import fig10b from "../assets/cards/figures/fig_10_back.jpg";
import fig11f from "../assets/cards/figures/fig_11_front.jpg";
import fig11b from "../assets/cards/figures/fig_11_back.jpg";
import fig12f from "../assets/cards/figures/fig_12_front.jpg";
import fig12b from "../assets/cards/figures/fig_12_back.jpg";
import fig13f from "../assets/cards/figures/fig_13_front.jpg";
import fig13b from "../assets/cards/figures/fig_13_back.jpg";
import fig14f from "../assets/cards/figures/fig_14_front.jpg";
import fig14b from "../assets/cards/figures/fig_14_back.jpg";

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface CollectibleCard {
  id: string;
  name: string;
  category: string;
  rarity: Rarity;
  front: string;
  back: string;
}

export const PHENOMENA_CARDS: CollectibleCard[] = [
  { id: "phen-1", name: "Why Does Time Slow Down in Space?", category: "Science", rarity: "epic", front: phen1f, back: phen1b },
  { id: "phen-2", name: "How Does WiFi Work Without Wires?", category: "Technology", rarity: "common", front: phen2f, back: phen2b },
  { id: "phen-3", name: "Why Do Rainbows Appear After Rain?", category: "Science", rarity: "common", front: phen3f, back: phen3b },
  { id: "phen-4", name: "Why Do Helium Balloons Float?", category: "Engineering", rarity: "common", front: phen4f, back: phen4b },
  { id: "phen-5", name: "How Does Your Brain Remember Things?", category: "Technology", rarity: "rare", front: phen5f, back: phen5b },
  { id: "phen-6", name: "Why Is Space Dark Even Though the Sun Is Bright?", category: "Technology", rarity: "common", front: phen6f, back: phen6b },
  { id: "phen-7", name: "How Does Your Voice Travel?", category: "Science", rarity: "common", front: phen7f, back: phen7b },
  { id: "phen-8", name: "Why Don't People Fall Off the Bottom of Earth?", category: "Mathematics", rarity: "rare", front: phen8f, back: phen8b },
  { id: "phen-9", name: "Why Do Volcanoes Erupt?", category: "Science", rarity: "common", front: phen9f, back: phen9b },
  { id: "phen-10", name: "How Does Lightning Happen?", category: "Science", rarity: "rare", front: phen10f, back: phen10b },
  { id: "phen-11", name: "Your Fingers Don't Have Muscles?", category: "Science", rarity: "common", front: phen11f, back: phen11b },
  { id: "phen-12", name: "Why Do Magnets Stick to Some Metals?", category: "Science", rarity: "common", front: phen12f, back: phen12b },
  { id: "phen-13", name: "How Do Chameleons Change Colour?", category: "Science", rarity: "rare", front: phen13f, back: phen13b },
  { id: "phen-14", name: "How Do Rockets Move in Space?", category: "Science", rarity: "epic", front: phen14f, back: phen14b },
  { id: "phen-15", name: "Why Does the Moon Change Shape?", category: "Science", rarity: "common", front: phen15f, back: phen15b },
  { id: "phen-16", name: "Why Are Snowflakes All Different?", category: "Science", rarity: "epic", front: phen16f, back: phen16b },
];

export const FIGURE_CARDS: CollectibleCard[] = [
  { id: "fig-1", name: "Marie Curie", category: "The Radioactivity Pioneer", rarity: "legendary", front: fig1f, back: fig1b },
  { id: "fig-2", name: "Albert Einstein", category: "The Master of Relativity", rarity: "legendary", front: fig2f, back: fig2b },
  { id: "fig-3", name: "Isaac Newton", category: "The Motion Pioneer", rarity: "legendary", front: fig3f, back: fig3b },
  { id: "fig-4", name: "Alan Turing", category: "The Codebreaker Genius", rarity: "legendary", front: fig4f, back: fig4b },
  { id: "fig-5", name: "Jennifer Doudna", category: "The Gene Editing Pioneer", rarity: "legendary", front: fig5f, back: fig5b },
  { id: "fig-6", name: "Rosalind Franklin", category: "The DNA Detective", rarity: "epic", front: fig6f, back: fig6b },
  { id: "fig-7", name: "Katherine Johnson", category: "The Mathematician Who Reached Space", rarity: "epic", front: fig7f, back: fig7b },
  { id: "fig-8", name: "Jane Goodall", category: "The Chimpanzee Champion", rarity: "epic", front: fig8f, back: fig8b },
  { id: "fig-9", name: "Nikola Tesla", category: "The Master of Electricity", rarity: "epic", front: fig9f, back: fig9b },
  { id: "fig-10", name: "Mae Jemison", category: "Reach for the Stars", rarity: "epic", front: fig10f, back: fig10b },
  { id: "fig-11", name: "Louis Pasteur", category: "Guardian Against Germs", rarity: "epic", front: fig11f, back: fig11b },
  { id: "fig-12", name: "Gregor Mendel", category: "Father of Genetics", rarity: "rare", front: fig12f, back: fig12b },
  { id: "fig-13", name: "Ada Lovelace", category: "The First Programmer", rarity: "rare", front: fig13f, back: fig13b },
  { id: "fig-14", name: "Stephen Hawking", category: "The Theorist", rarity: "rare", front: fig14f, back: fig14b },
];

export const RARITY_STYLE: Record<Rarity, { label: string; badge: string; glow: string }> = {
  common: { label: "Common", badge: "bg-slate-500", glow: "shadow-slate-300/50" },
  rare: { label: "Rare", badge: "bg-sky-500", glow: "shadow-sky-400/60" },
  epic: { label: "Epic", badge: "bg-purple-500", glow: "shadow-purple-400/60" },
  legendary: { label: "Legendary", badge: "bg-amber-500", glow: "shadow-amber-400/70" },
};

export interface AlbumPack {
  id: string;
  name: string;
  cost: number;
  cardsCount: number;
  description: string;
  coverGradient: string;
}

export const ALBUM_PACKS: Record<"phenomena" | "figures", AlbumPack[]> = {
  phenomena: [
    { id: "phen-p1", name: "Curiosity Pack", cost: 50, cardsCount: 2, description: "Everyday wonders, explained!", coverGradient: "from-sky-400 to-blue-500" },
    { id: "phen-p2", name: "Mystery Pack", cost: 100, cardsCount: 3, description: "Weirder phenomena, unlocked.", coverGradient: "from-purple-400 to-indigo-500" },
  ],
  figures: [
    { id: "fig-p1", name: "Pioneers Pack", cost: 75, cardsCount: 2, description: "Meet the scientific greats.", coverGradient: "from-amber-400 to-orange-500" },
    { id: "fig-p2", name: "Legends Pack", cost: 150, cardsCount: 3, description: "Higher odds of Legendary figures!", coverGradient: "from-rose-400 to-red-500" },
  ],
};
