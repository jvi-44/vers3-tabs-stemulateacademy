import { useEffect, useState } from "react";
import stembotBlue from "../assets/stembot_blue.png";
import stembotRed from "../assets/stembot_red.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotCream from "../assets/stembot_cream.png";

// Colour themes. The colours themselves live in styles/theme.css under
// [data-theme="..."]; this list is what the theme pickers show.
export const THEMES = [
  { id: "sunshine", name: "Sunshine", bot: stembotCream, swatch: ["#84cc16", "#facc15", "#f59e0b"] },
  { id: "ocean", name: "Ocean", bot: stembotBlue, swatch: ["#0ea5e9", "#38bdf8", "#22d3ee"] },
  { id: "forest", name: "Forest", bot: stembotGreen, swatch: ["#16a34a", "#4ade80", "#a3e635"] },
  { id: "berry", name: "Berry", bot: stembotRed, swatch: ["#e11d48", "#f472b6", "#fb923c"] },
  { id: "galaxy", name: "Galaxy", bot: stembotBlue, swatch: ["#7c3aed", "#a855f7", "#ec4899"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const THEME_KEY = "stemulate_theme";

function readSaved(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.some((t) => t.id === saved)) return saved as ThemeId;
  } catch {
    // Storage blocked: use the default theme.
  }
  return "sunshine";
}

export function useColourTheme() {
  const [theme, setTheme] = useState<ThemeId>(readSaved);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not saved; the theme still applies for this visit.
    }
  }, [theme]);
  return [theme, setTheme] as const;
}
