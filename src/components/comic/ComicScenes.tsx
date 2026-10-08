import type { ComicScene } from "../../data/comicStrips";

// Hand-drawn-style SVG backdrops for comic panels. Each scene is drawn on a
// 400×300 canvas and sliced to fill the panel, so anything important stays
// inside x 80–320 (the part still visible on tall phone-shaped panels).

const INK = "#1f1a17";
const LINE = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const };

function Stars({ count = 40, seed = 1 }: { count?: number; seed?: number }) {
  // Deterministic pseudo-random scatter so stars never jump between renders.
  const stars = Array.from({ length: count }, (_, i) => {
    const a = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
    const b = Math.sin(i * 39.3468 + seed * 11.135) * 24634.6345;
    return { x: (a - Math.floor(a)) * 400, y: (b - Math.floor(b)) * 300, r: i % 5 === 0 ? 2 : 1.1 };
  });
  return (
    <g fill="#fff">
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={0.5 + (i % 3) * 0.2} />
      ))}
    </g>
  );
}

function Halftone({ id, color, opacity = 0.25 }: { id: string; color: string; opacity?: number }) {
  return (
    <>
      <defs>
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1.8" fill={color} />
        </pattern>
      </defs>
      <rect width="400" height="300" fill={`url(#${id})`} opacity={opacity} />
    </>
  );
}

/** A row of Minecraft-style grass/dirt blocks along the bottom. */
function BlockGround({ top = "#5fbf3a", side = "#8b5a2b", y = 230 }: { top?: string; side?: string; y?: number }) {
  return (
    <g>
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <rect x={i * 30 - 10} y={y} width="30" height="10" fill={top} {...LINE} strokeWidth={1.5} />
          <rect x={i * 30 - 10} y={y + 10} width="30" height={300 - y} fill={side} {...LINE} strokeWidth={1.5} />
          <rect x={i * 30 - 2} y={y + 20} width="5" height="5" fill="#00000022" />
          <rect x={i * 30 + 8} y={y + 34} width="5" height="5" fill="#00000022" />
        </g>
      ))}
    </g>
  );
}

function BlockTree({ x, y, leaf = "#3f9b2f" }: { x: number; y: number; leaf?: string }) {
  return (
    <g>
      <rect x={x - 6} y={y - 40} width="12" height="40" fill="#7a4e24" {...LINE} strokeWidth={1.8} />
      <rect x={x - 26} y={y - 76} width="52" height="40" fill={leaf} {...LINE} strokeWidth={1.8} />
      <rect x={x - 14} y={y - 92} width="28" height="18" fill={leaf} {...LINE} strokeWidth={1.8} />
      <rect x={x - 18} y={y - 66} width="8" height="8" fill="#ffffff22" />
    </g>
  );
}

function BlockCloud({ x, y }: { x: number; y: number }) {
  return (
    <g fill="#fff" opacity="0.9">
      <rect x={x} y={y} width="60" height="14" />
      <rect x={x + 12} y={y - 10} width="30" height="10" />
    </g>
  );
}

function Spotlights() {
  return (
    <g opacity="0.35">
      <polygon points="60,0 100,0 190,240 120,240" fill="#fff6a8" />
      <polygon points="300,0 340,0 280,240 210,240" fill="#fff6a8" />
      <polygon points="185,0 215,0 240,240 160,240" fill="#ffd1f0" />
    </g>
  );
}

function StageFloor() {
  return (
    <g>
      <rect x="0" y="232" width="400" height="68" fill="#3b2a6b" {...LINE} />
      <ellipse cx="200" cy="250" rx="160" ry="16" fill="#6c4fd1" {...LINE} strokeWidth={2} />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={20 + i * 33} cy="240" r="3" fill={i % 2 ? "#ffd84d" : "#ff7ac8"} />
      ))}
    </g>
  );
}

function Confetti() {
  const colors = ["#ff5d8f", "#ffd84d", "#4dd4ff", "#7cf06b", "#b47cff"];
  return (
    <g>
      {Array.from({ length: 46 }, (_, i) => {
        const a = Math.sin(i * 91.7) * 1000;
        const b = Math.sin(i * 17.3) * 1000;
        const x = (a - Math.floor(a)) * 400;
        const y = (b - Math.floor(b)) * 230;
        return <rect key={i} x={x} y={y} width="7" height="4" fill={colors[i % colors.length]} transform={`rotate(${(i * 37) % 180} ${x} ${y})`} />;
      })}
    </g>
  );
}

function ScreenText({ text, x, y, size = 14, color = "#7CFFB2", lineGap = 1.25 }: { text: string; x: number; y: number; size?: number; color?: string; lineGap?: number }) {
  const lines = text.split("\n");
  return (
    <text x={x} y={y} fill={color} fontSize={size} fontFamily="ui-monospace, Menlo, monospace" fontWeight="700" textAnchor="middle">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : size * lineGap}>{l}</tspan>
      ))}
    </text>
  );
}

function Spaceship({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-60 0 Q-40 -26 20 -22 L60 -6 Q70 0 60 6 L20 22 Q-40 26 -60 0 Z" fill="#d9dde8" {...LINE} />
      <path d="M-20 -22 L-34 -40 L0 -36 L10 -21" fill="#8f9bb8" {...LINE} />
      <path d="M-20 22 L-34 40 L0 36 L10 21" fill="#8f9bb8" {...LINE} />
      <circle cx="22" cy="-2" r="8" fill="#7fd8ff" {...LINE} strokeWidth={2} />
      <circle cx="0" cy="-2" r="6" fill="#7fd8ff" {...LINE} strokeWidth={2} />
      <path d="M-60 -6 L-78 0 L-60 6" fill="#ff9d2e" {...LINE} strokeWidth={2} />
    </g>
  );
}

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 1.5} fill="#ffb347" opacity="0.25" />
      <circle cx={cx} cy={cy} r={r * 1.22} fill="#ffcf4d" opacity="0.4" />
      <circle cx={cx} cy={cy} r={r} fill="#ffd23f" {...LINE} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.2} r={r * 0.12} fill="#ffb02e" />
      <circle cx={cx + r * 0.25} cy={cy + r * 0.3} r={r * 0.18} fill="#ffb02e" />
    </g>
  );
}

function ControlConsole({ screen, warn }: { screen?: string; warn: boolean }) {
  return (
    <g>
      <rect x="0" y="0" width="400" height="300" fill="#26304a" />
      {/* window to space */}
      <path d="M70 20 H330 L360 140 H40 Z" fill="#0d1230" {...LINE} />
      <Sun cx={300} cy={80} r={warn ? 46 : 30} />
      {/* console */}
      <path d="M0 170 L40 140 H360 L400 170 V300 H0 Z" fill="#4a5677" {...LINE} />
      <rect x="140" y="150" width="120" height="58" rx="6" fill="#0b1a12" {...LINE} />
      {screen && <ScreenText text={screen} x={200} y={185} size={18} color={warn ? "#ff6b6b" : "#7CFFB2"} />}
      {[60, 90, 310, 340].map((x, i) => (
        <circle key={x} cx={x} cy="175" r="7" fill={i % 2 ? "#ffd84d" : warn ? "#ff4d4d" : "#4dff8f"} {...LINE} strokeWidth={1.8} />
      ))}
      {warn && <rect width="400" height="300" fill="#ff2d2d" opacity="0.12" />}
    </g>
  );
}

export function ComicSceneArt({ scene, screen }: { scene: ComicScene; screen?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      {renderScene(scene, screen)}
    </svg>
  );
}

function renderScene(scene: ComicScene, screen?: string) {
  switch (scene) {
    case "mc-plains":
      return (
        <>
          <rect width="400" height="300" fill="#8fd3ff" />
          <rect x="300" y="24" width="34" height="34" fill="#ffe14d" {...LINE} />
          <BlockCloud x={60} y={40} />
          <BlockCloud x={220} y={70} />
          <BlockTree x={70} y={230} />
          <BlockTree x={340} y={230} leaf="#4fb03a" />
          <BlockGround />
        </>
      );
    case "mc-forest":
      return (
        <>
          <rect width="400" height="300" fill="#a6e3c3" />
          <BlockTree x={40} y={230} leaf="#2f7d2a" />
          <BlockTree x={120} y={230} />
          <BlockTree x={280} y={230} leaf="#2f7d2a" />
          <BlockTree x={360} y={230} />
          {Array.from({ length: 18 }, (_, i) => (
            <rect key={i} x={(i * 47) % 400} y={(i * 29) % 140} width="2" height="10" fill="#4a7fd1" opacity="0.6" />
          ))}
          <BlockGround />
        </>
      );
    case "mc-build":
      return (
        <>
          <rect width="400" height="300" fill="#ffd9a8" />
          <Halftone id="h-build" color="#ff9f43" opacity={0.25} />
          {/* half-built block house */}
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3, 4].slice(0, 5 - (r === 3 ? 2 : 0)).map((c) => (
              <rect key={`${r}-${c}`} x={250 + c * 22} y={208 - r * 22} width="22" height="22" fill={r === 0 ? "#9b9b9b" : "#c7964f"} {...LINE} strokeWidth={1.5} />
            )),
          )}
          {/* crafting table */}
          <rect x="60" y="170" width="60" height="60" fill="#a06a32" {...LINE} />
          <path d="M60 190 H120 M60 210 H120 M80 170 V230 M100 170 V230" stroke={INK} strokeWidth="1.5" />
          {screen && (
            <g>
              <rect x="40" y="130" width="100" height="26" rx="5" fill="#1f1a17" />
              <ScreenText text={screen} x={90} y={148} size={12} color="#ffe14d" />
            </g>
          )}
          <BlockGround />
        </>
      );
    case "mc-desert":
      return (
        <>
          <rect width="400" height="300" fill="#ffe7a3" />
          <rect x="280" y="30" width="40" height="40" fill="#ffb02e" {...LINE} />
          {/* cacti */}
          {[60, 340].map((x) => (
            <g key={x}>
              <rect x={x - 8} y="150" width="16" height="80" fill="#3f9b2f" {...LINE} strokeWidth={1.8} />
              <rect x={x + 8} y="175" width="14" height="10" fill="#3f9b2f" {...LINE} strokeWidth={1.5} />
              <rect x={x + 14} y="160" width="8" height="25" fill="#3f9b2f" {...LINE} strokeWidth={1.5} />
            </g>
          ))}
          {screen && (
            <g>
              <rect x="90" y="196" width="150" height="26" rx="4" fill="#00000088" />
              <ScreenText text={screen} x={165} y={214} size={15} color="#ffffff" />
            </g>
          )}
          <BlockGround top="#f2d27a" side="#e3bc5b" />
        </>
      );
    case "mc-biomes":
      return (
        <>
          {[
            { x: 0, sky: "#a6e3c3", top: "#5fbf3a", side: "#8b5a2b" },
            { x: 100, sky: "#ffe7a3", top: "#f2d27a", side: "#e3bc5b" },
            { x: 200, sky: "#dff3ff", top: "#ffffff", side: "#9fc6e8" },
            { x: 300, sky: "#c7d9a3", top: "#4e7d3a", side: "#4a3b2a" },
          ].map((b) => (
            <g key={b.x}>
              <rect x={b.x} width="100" height="300" fill={b.sky} />
              <rect x={b.x} y="230" width="100" height="10" fill={b.top} />
              <rect x={b.x} y="240" width="100" height="60" fill={b.side} />
              <line x1={b.x} y1="0" x2={b.x} y2="300" stroke={INK} strokeWidth="3" />
            </g>
          ))}
          <BlockTree x={50} y={230} />
          <rect x="142" y="170" width="16" height="60" fill="#3f9b2f" {...LINE} strokeWidth={1.8} />
          <rect x="230" y="200" width="40" height="30" fill="#bfe6ff" {...LINE} strokeWidth={1.8} />
          <rect x="320" y="226" width="60" height="6" fill="#3a6b8f" />
          <line x1="0" y1="230" x2="400" y2="230" stroke={INK} strokeWidth="2" />
        </>
      );
    case "gs-stage":
    case "gs-confetti":
      return (
        <>
          <rect width="400" height="300" fill="#1d1350" />
          <Halftone id={`h-${scene}`} color="#6c4fd1" opacity={0.5} />
          <Spotlights />
          <g>
            <rect x="120" y="22" width="160" height="44" rx="10" fill="#ffd84d" {...LINE} />
            <text x="200" y="53" textAnchor="middle" fontSize="24" fontWeight="900" fill="#1d1350" fontFamily="system-ui, sans-serif">$1,000,000</text>
          </g>
          <StageFloor />
          {scene === "gs-confetti" && <Confetti />}
        </>
      );
    case "gs-question":
      return (
        <>
          <rect width="400" height="300" fill="#1d1350" />
          <Spotlights />
          <rect x="85" y="70" width="230" height="140" rx="12" fill="#0d0a2e" {...LINE} strokeWidth={3} />
          <rect x="92" y="77" width="216" height="126" rx="8" fill="none" stroke="#ffd84d" strokeWidth="2" />
          {screen && <ScreenText text={screen} x={200} y={112} size={15} color="#ffffff" lineGap={1.5} />}
          <StageFloor />
        </>
      );
    case "gs-atm":
      return (
        <>
          <rect width="400" height="300" fill="#1d1350" />
          <Halftone id="h-atm" color="#4dd4ff" opacity={0.3} />
          {/* giant ATM */}
          <rect x="190" y="80" width="130" height="152" rx="12" fill="#c9d4e8" {...LINE} strokeWidth={3} />
          <rect x="202" y="92" width="106" height="62" rx="6" fill="#0b1a12" {...LINE} />
          {screen && <ScreenText text={screen} x={255} y={screen.includes("\n") ? 110 : 129} size={screen.includes("\n") ? 12 : 16} color="#7CFFB2" />}
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={220 + c * 24} y={162 + r * 16} width="18" height="11" rx="2" fill="#fff" {...LINE} strokeWidth={1.4} />
          )))}
          <rect x="215" y="214" width="80" height="7" rx="3" fill={INK} />
          <StageFloor />
        </>
      );
    case "gs-city":
      return (
        <>
          <rect width="400" height="300" fill="#10264d" />
          <Halftone id="h-city" color="#4dd4ff" opacity={0.35} />
          <g opacity="0.95" stroke="#7fe7ff" strokeWidth="2.5" fill="#4dd4ff33">
            {/* buildings */}
            <rect x="90" y="110" width="40" height="120" />
            <rect x="140" y="80" width="50" height="150" />
            {/* hospital */}
            <rect x="210" y="120" width="70" height="110" />
            <path d="M245 135 v24 M233 147 h24" strokeWidth="6" stroke="#ff7a9a" />
            <rect x="290" y="95" width="36" height="135" />
            {/* MRT line */}
            <path d="M40 200 H360" strokeWidth="4" />
            <rect x="60" y="186" width="90" height="16" rx="6" fill="#7fe7ff66" />
            {/* road */}
            <path d="M0 260 H400" strokeWidth="10" stroke="#7fe7ff55" />
            <path d="M10 260 H390" strokeDasharray="14 10" />
          </g>
          <rect x="0" y="232" width="400" height="68" fill="#0a1a36" opacity="0.6" />
        </>
      );
    case "gs-calculator":
      return (
        <>
          <rect width="400" height="300" fill="#ffe0f0" />
          <Halftone id="h-calc" color="#ff7ac8" opacity={0.35} />
          <rect x="150" y="30" width="110" height="190" rx="14" fill="#ff5d5d" {...LINE} strokeWidth={3} />
          <rect x="164" y="44" width="82" height="40" rx="5" fill="#d8f7c8" {...LINE} strokeWidth={2} />
          <ScreenText text="$$$" x={205} y={71} size={18} color="#1f1a17" />
          {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={166 + c * 27} y={96 + r * 28} width="22" height="22" rx="5" fill={c === 2 ? "#ffd84d" : "#fff"} {...LINE} strokeWidth={1.6} />
          )))}
          <rect x="0" y="232" width="400" height="68" fill="#ffb3d9" {...LINE} />
        </>
      );
    case "gs-dream":
      return (
        <>
          <rect width="400" height="300" fill="#ffd6f5" />
          <Halftone id="h-dream" color="#ffffff" opacity={0.6} />
          {/* yacht */}
          <path d="M60 190 H170 L150 215 H80 Z" fill="#fff" {...LINE} />
          <path d="M110 190 V130 L150 185 Z" fill="#9fd8ff" {...LINE} strokeWidth={2} />
          {/* golden toilet */}
          <path d="M190 170 h40 v18 q0 22 -20 22 q-20 0 -20 -22 Z" fill="#ffd23f" {...LINE} />
          <rect x="216" y="150" width="16" height="22" fill="#ffd23f" {...LINE} strokeWidth={2} />
          {/* rocket house */}
          <path d="M300 220 V120 Q320 80 340 120 V220 Z" fill="#ff7a9a" {...LINE} />
          <circle cx="320" cy="140" r="9" fill="#9fd8ff" {...LINE} strokeWidth={2} />
          <rect x="311" y="190" width="18" height="30" fill="#fff" {...LINE} strokeWidth={2} />
          <path d="M300 200 L285 225 H300 M340 200 L355 225 H340" fill="#ffd84d" {...LINE} strokeWidth={2} />
          {/* dream-bubble border */}
          <rect x="6" y="6" width="388" height="288" rx="40" fill="none" stroke="#fff" strokeWidth="10" strokeDasharray="2 18" strokeLinecap="round" />
          <rect x="0" y="232" width="400" height="68" fill="#9fd8ff" opacity="0.7" />
        </>
      );
    case "gs-bank":
      return (
        <>
          <rect width="400" height="300" fill="#d7f5e3" />
          <Halftone id="h-bank" color="#3fbf7f" opacity={0.3} />
          {/* piggy bank */}
          <ellipse cx="200" cy="140" rx="70" ry="52" fill="#ff9ec4" {...LINE} strokeWidth={3} />
          <circle cx="252" cy="130" r="18" fill="#ff9ec4" {...LINE} />
          <circle cx="257" cy="128" r="3" fill={INK} />
          <circle cx="247" cy="128" r="3" fill={INK} />
          <path d="M150 100 L160 78 L175 96" fill="#ff9ec4" {...LINE} />
          <rect x="180" y="86" width="40" height="7" rx="3" fill={INK} />
          <rect x="160" y="182" width="16" height="22" fill="#ff9ec4" {...LINE} strokeWidth={2} />
          <rect x="222" y="182" width="16" height="22" fill="#ff9ec4" {...LINE} strokeWidth={2} />
          <circle cx="200" cy="60" r="16" fill="#ffd23f" {...LINE} />
          <text x="200" y="66" textAnchor="middle" fontSize="16" fontWeight="900" fill={INK}>$</text>
          <rect x="0" y="232" width="400" height="68" fill="#8fd9b0" {...LINE} />
        </>
      );
    case "gs-board":
      return (
        <>
          <rect width="400" height="300" fill="#e6f7d9" />
          {/* board squares around the edge */}
          {Array.from({ length: 10 }, (_, i) => {
            const colors = ["#ff5d5d", "#ffd84d", "#4dd4ff", "#7cf06b", "#b47cff"];
            return (
              <g key={i}>
                <rect x={i * 40} y="0" width="40" height="40" fill="#fffdf5" {...LINE} strokeWidth={1.6} />
                <rect x={i * 40} y="0" width="40" height="11" fill={colors[i % 5]} {...LINE} strokeWidth={1.6} />
              </g>
            );
          })}
          {/* little houses + Singapore skyline nod */}
          {[90, 140, 260, 310].map((x, i) => (
            <path key={x} d={`M${x} 200 v-26 l14 -14 l14 14 v26 Z`} fill={i % 2 ? "#3fbf7f" : "#ff5d5d"} {...LINE} strokeWidth={2} />
          ))}
          <g fill="#c9d4e8" {...LINE} strokeWidth={2}>
            <rect x="180" y="90" width="14" height="110" />
            <rect x="198" y="90" width="14" height="110" />
            <rect x="216" y="90" width="14" height="110" />
            <path d="M174 90 Q205 70 236 90 Z" />
          </g>
          <text x="200" y="230" textAnchor="middle" fontSize="13" fontWeight="900" fill={INK} fontFamily="system-ui, sans-serif">STEMCITY</text>
          <rect x="0" y="236" width="400" height="64" fill="#bfe8a6" {...LINE} />
        </>
      );
    case "space-calm":
      return (
        <>
          <rect width="400" height="300" fill="#0b0f2e" />
          <Stars count={60} seed={2} />
          <circle cx="330" cy="60" r="22" fill="#8a7dff" {...LINE} />
          <Spaceship x={200} y={130} scale={1.3} />
          <rect x="0" y="240" width="400" height="60" fill="#0b0f2e" opacity="0.5" />
        </>
      );
    case "space-alarm":
      return (
        <>
          <rect width="400" height="300" fill="#3a1220" />
          {/* corridor walls */}
          <path d="M0 0 L120 70 V230 L0 300 Z" fill="#4a1a2a" {...LINE} />
          <path d="M400 0 L280 70 V230 L400 300 Z" fill="#4a1a2a" {...LINE} />
          <rect x="120" y="70" width="160" height="160" fill="#2a0c16" {...LINE} />
          {[60, 340].map((x) => (
            <g key={x}>
              <circle cx={x} cy="60" r="16" fill="#ff2d2d" {...LINE} />
              <circle cx={x} cy="60" r="34" fill="#ff2d2d" opacity="0.25" />
            </g>
          ))}
          <rect width="400" height="300" fill="#ff2d2d" opacity="0.15" />
          <rect x="0" y="236" width="400" height="64" fill="#1e0810" {...LINE} />
        </>
      );
    case "space-sun":
      return (
        <>
          <rect width="400" height="300" fill="#2a0f2e" />
          <Stars count={30} seed={5} />
          <Sun cx={330} cy={120} r={90} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${170 - i * 12} ${80 + i * 30} q 10 -8 20 0 t 20 0 t 20 0`} stroke="#ff9d2e" strokeWidth="3" fill="none" opacity="0.8" />
          ))}
          <Spaceship x={110} y={110} scale={0.8} />
          <rect x="0" y="240" width="400" height="60" fill="#2a0f2e" opacity="0.6" />
        </>
      );
    case "space-cockpit": {
      const warn = !!screen && /▲|▼/.test(screen);
      return <ControlConsole screen={screen} warn={warn} />;
    }
    case "space-asteroids":
      return (
        <>
          <rect width="400" height="300" fill="#0b0f2e" />
          <Stars count={50} seed={9} />
          {[
            { x: 90, y: 70, r: 30 },
            { x: 210, y: 50, r: 22 },
            { x: 320, y: 90, r: 36 },
            { x: 150, y: 150, r: 18 },
            { x: 270, y: 170, r: 24 },
          ].map((a, i) => (
            <g key={i}>
              <circle cx={a.x} cy={a.y} r={a.r} fill="#8a7464" {...LINE} />
              <circle cx={a.x - a.r * 0.3} cy={a.y - a.r * 0.2} r={a.r * 0.2} fill="#6e5b4e" />
              {/* glowing fuel crystal + lock */}
              <path d={`M${a.x + a.r * 0.2} ${a.y} l6 -10 l6 10 l-6 10 Z`} fill="#4dff8f" stroke={INK} strokeWidth="1.5" />
              <text x={a.x - a.r * 0.15} y={a.y + a.r * 0.55} fontSize={a.r * 0.5} fontWeight="900" fill="#ffd84d" textAnchor="middle">?</text>
            </g>
          ))}
          <rect x="0" y="240" width="400" height="60" fill="#0b0f2e" opacity="0.5" />
        </>
      );
  }
}
