// Shared pieces for the module certificate and the certificate shelf:
// colour palettes, STEMbot mascots, border patterns, saved choices and the
// scalloped "stamp" edge. Kept free of React so the PNG export can use it too.
import stembotGreen from "../assets/stembot_green.png";
import stembotBlue from "../assets/stembot_blue.png";
import stembotCream from "../assets/stembot_cream.png";
import stembotRed from "../assets/stembot_red.png";

export type CertificateModule = {
  id: string;
  name: string;
  lessons: string[];
  emoji?: string;
};

// The certificate is drawn on an A4 landscape canvas (297 x 210 mm at 96 dpi).
export const CERT_W = 1123;
export const CERT_H = 794;

export type CertPalette = {
  id: string;
  name: string;
  primary: string;
  primaryFg: string;
  pop2: string;
  pop3: string;
  ink: string;
  paper: string;
  soft1: string;
  soft2: string;
  soft3: string;
  soft2Ink: string;
  soft3Ink: string;
  muted: string;
};

// Same colours as the app themes in styles/theme.css (light mode). Written out
// here because the exported PNG cannot read CSS variables.
export const CERT_PALETTES: CertPalette[] = [
  {
    id: "sunshine",
    name: "Sunshine",
    primary: "#f5a20b",
    primaryFg: "#2a1f0c",
    pop2: "#7cc242",
    pop3: "#7c4dff",
    ink: "#2a1f0c",
    paper: "#fffbea",
    soft1: "#fff4bf",
    soft2: "#eaf8d8",
    soft3: "#efe7ff",
    soft2Ink: "#2f6a14",
    soft3Ink: "#4a23c2",
    muted: "#74654a",
  },
  {
    id: "ocean",
    name: "Ocean",
    primary: "#12a4e6",
    primaryFg: "#ffffff",
    pop2: "#ffb020",
    pop3: "#14b8a6",
    ink: "#0b2537",
    paper: "#f1f9ff",
    soft1: "#dff2fd",
    soft2: "#fff1c7",
    soft3: "#d2f7f1",
    soft2Ink: "#855300",
    soft3Ink: "#0f6b62",
    muted: "#456579",
  },
  {
    id: "forest",
    name: "Forest",
    primary: "#4caf2a",
    primaryFg: "#ffffff",
    pop2: "#c6ef72",
    pop3: "#f59e0b",
    ink: "#1b2e1c",
    paper: "#f5fbea",
    soft1: "#e4f6d4",
    soft2: "#f1fbcf",
    soft3: "#fff1c7",
    soft2Ink: "#3f6212",
    soft3Ink: "#855300",
    muted: "#4e5f50",
  },
  {
    id: "berry",
    name: "Berry",
    primary: "#e8345a",
    primaryFg: "#ffffff",
    pop2: "#ff9a3c",
    pop3: "#f472b6",
    ink: "#3a0d1a",
    paper: "#fff6f4",
    soft1: "#ffe4e6",
    soft2: "#ffead5",
    soft3: "#fde4f2",
    soft2Ink: "#9a3412",
    soft3Ink: "#9d174d",
    muted: "#7a4c57",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    primary: "#7c4dff",
    primaryFg: "#ffffff",
    pop2: "#ff5fa8",
    pop3: "#22c7e8",
    ink: "#1e1240",
    paper: "#f8f5ff",
    soft1: "#ede7ff",
    soft2: "#ffe1f0",
    soft3: "#d4f6fd",
    soft2Ink: "#9d174d",
    soft3Ink: "#0e6a80",
    muted: "#5c5280",
  },
];

export const CERT_BOTS = [
  { id: "sophia", name: "Sophia", src: stembotGreen },
  { id: "timothy", name: "Timothy", src: stembotBlue },
  { id: "emily", name: "Emily", src: stembotCream },
  { id: "matthew", name: "Matthew", src: stembotRed },
] as const;
export type CertBotId = (typeof CERT_BOTS)[number]["id"];
export const MAX_BOTS = 2;

export const CERT_PATTERNS = [
  { id: "stars", name: "Stars" },
  { id: "confetti", name: "Confetti" },
  { id: "waves", name: "Waves" },
  { id: "blocks", name: "Blocks" },
] as const;
export type CertPatternId = (typeof CERT_PATTERNS)[number]["id"];

export type CertChoices = {
  palette: string;
  bots: CertBotId[];
  pattern: CertPatternId;
  /** Only set once the student types their own display name. */
  name?: string;
};

export function paletteById(id: string | undefined): CertPalette {
  return CERT_PALETTES.find((p) => p.id === id) ?? CERT_PALETTES[0];
}

function appTheme(): string {
  try {
    const t = document.documentElement.dataset.theme;
    if (t && CERT_PALETTES.some((p) => p.id === t)) return t;
  } catch {
    // No DOM: fall through to the default.
  }
  return "sunshine";
}

// Each module gets a different default buddy so a shelf of certificates
// does not look identical.
function defaultBots(moduleId: string): CertBotId[] {
  let h = 0;
  for (const c of moduleId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = CERT_BOTS[h % 4].id;
  const b = CERT_BOTS[(h + 1) % 4].id;
  return [a, b];
}

export function defaultChoices(moduleId: string): CertChoices {
  return { palette: appTheme(), bots: defaultBots(moduleId), pattern: "stars" };
}

const storageKey = (moduleId: string) => `stemulate_cert_${moduleId}`;

export function loadChoices(moduleId: string): CertChoices {
  const base = defaultChoices(moduleId);
  try {
    const raw = localStorage.getItem(storageKey(moduleId));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<CertChoices>;
    return {
      palette: CERT_PALETTES.some((p) => p.id === saved.palette) ? saved.palette! : base.palette,
      bots: Array.isArray(saved.bots)
        ? saved.bots.filter((b): b is CertBotId => CERT_BOTS.some((x) => x.id === b)).slice(0, MAX_BOTS)
        : base.bots,
      pattern: CERT_PATTERNS.some((p) => p.id === saved.pattern) ? saved.pattern! : base.pattern,
      name: typeof saved.name === "string" && saved.name.trim() ? saved.name.slice(0, 40) : undefined,
    };
  } catch {
    return base;
  }
}

export function saveChoices(moduleId: string, choices: CertChoices) {
  try {
    localStorage.setItem(storageKey(moduleId), JSON.stringify(choices));
  } catch {
    // Storage blocked: the choices still apply until the modal closes.
  }
}

export function clearChoices(moduleId: string) {
  try {
    localStorage.removeItem(storageKey(moduleId));
  } catch {
    // Nothing saved to clear.
  }
}

/** A rectangle whose edges are a row of half-circle bumps, like a stamp. */
export function scallopPath(x: number, y: number, w: number, h: number, bump: number): string {
  const nx = Math.max(1, Math.round(w / (bump * 2)));
  const ny = Math.max(1, Math.round(h / (bump * 2)));
  const rx = w / nx / 2;
  const ry = h / ny / 2;
  let d = `M${x},${y}`;
  for (let i = 0; i < nx; i++) d += `a${rx},${rx} 0 0 1 ${rx * 2},0`;
  for (let i = 0; i < ny; i++) d += `a${ry},${ry} 0 0 1 0,${ry * 2}`;
  for (let i = 0; i < nx; i++) d += `a${rx},${rx} 0 0 1 ${-rx * 2},0`;
  for (let i = 0; i < ny; i++) d += `a${ry},${ry} 0 0 1 0,${-ry * 2}`;
  return d + "Z";
}

/** A many-pointed burst, used for the rosette seal. */
export function burstPath(cx: number, cy: number, rOut: number, rIn: number, points: number): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI * i) / points - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
}

/** A five-pointed star with rounded-looking proportions. */
export function starPath(cx: number, cy: number, r: number): string {
  return burstPath(cx, cy, r, r * 0.48, 5);
}

/** Small deterministic random generator so patterns do not jump on re-render. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatCertDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
