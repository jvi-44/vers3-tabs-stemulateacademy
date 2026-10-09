// 3D blocks drawn with CSS 3D transforms.
// <VoxelWorld> tilts a flat grid into an isometric view; <Voxel> is one cube
// on that grid at (x, y) with height z (all in block units).

import type { CSSProperties, ReactNode } from "react";

export interface BlockColors {
  top: string;
  side: string;
  /** Darker side; defaults to a shaded version of `side`. */
  side2?: string;
}

export const BLOCKS = {
  grass: { top: "#6fcf3b", side: "#8b5a2b", side2: "#6e4520" },
  dirt: { top: "#9b6a3c", side: "#8b5a2b", side2: "#6e4520" },
  stone: { top: "#a3a3a3", side: "#8a8a8a", side2: "#6f6f6f" },
  sand: { top: "#f4dc8a", side: "#e6c96c", side2: "#cfb257" },
  redSand: { top: "#e59a54", side: "#cc7f3d", side2: "#a8642c" },
  snow: { top: "#ffffff", side: "#dbeafe", side2: "#bfdbfe" },
  ice: { top: "#bae6fd", side: "#93c5fd", side2: "#60a5fa" },
  water: { top: "#3b82f6cc", side: "#2563ebcc", side2: "#1d4ed8cc" },
  log: { top: "#c49a6c", side: "#7c4a1e", side2: "#5e3715" },
  leaves: { top: "#2f9e44", side: "#2b8a3e", side2: "#237032" },
  jungleLeaves: { top: "#37b24d", side: "#2f9e44", side2: "#2b8a3e" },
  darkLeaves: { top: "#1f6f3a", side: "#1a5c30", side2: "#144a26" },
  cactus: { top: "#5c940d", side: "#66a80f", side2: "#4f7f0b" },
  cloud: { top: "#ffffff", side: "#f1f5f9", side2: "#e2e8f0" },
  rainCloud: { top: "#94a3b8", side: "#7b8a9f", side2: "#64748b" },
  plank: { top: "#d4a373", side: "#c08552", side2: "#a26c3c" },
  brick: { top: "#c2410c", side: "#b23a0a", side2: "#8f2f08" },
  glass: { top: "#e0f2fecc", side: "#bae6fd99", side2: "#7dd3fc99" },
  gold: { top: "#fde047", side: "#facc15", side2: "#eab308" },
  lava: { top: "#f97316", side: "#ea580c", side2: "#c2410c" },
  mud: { top: "#6b4f2a", side: "#5a4122", side2: "#47331b" },
} satisfies Record<string, BlockColors>;

export function Voxel({
  x,
  y,
  z = 0,
  size,
  colors,
  heightScale = 1,
  textured = true,
  className,
  style,
  children,
}: {
  x: number;
  y: number;
  z?: number;
  size: number;
  colors: BlockColors;
  /** Stretch the cube vertically (e.g. 0.3 for a flat water slab). */
  heightScale?: number;
  textured?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const h = size * heightScale;
  const side2 = colors.side2 ?? colors.side;
  const face = (extra: CSSProperties, bg: string, w = size, hh = size): CSSProperties => ({
    width: w,
    height: hh,
    background: bg,
    inset: "auto",
    left: 0,
    top: 0,
    ...extra,
  });
  const cls = `vx-face${textured ? " textured" : ""}`;
  return (
    <div
      className={`vx-block ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        left: x * size,
        top: y * size,
        transform: `translateZ(${z * size}px)`,
        ...style,
      }}
    >
      {/* top */}
      <div className={cls} style={face({ transform: `translateZ(${h}px)` }, colors.top)} />
      {/* south (+y) */}
      <div className={cls} style={face({ top: size - h, transformOrigin: "bottom", transform: "rotateX(-90deg)" }, colors.side, size, h)} />
      {/* north (-y) */}
      <div className={cls} style={face({ top: 0, transformOrigin: "top", transform: "rotateX(90deg)" }, side2, size, h)} />
      {/* east (+x) */}
      <div className={cls} style={face({ left: size - h, transformOrigin: "right", transform: "rotateY(90deg)" }, side2, h, size)} />
      {/* west (-x) */}
      <div className={cls} style={face({ left: 0, transformOrigin: "left", transform: "rotateY(-90deg)" }, colors.side, h, size)} />
      {children}
    </div>
  );
}

/**
 * Isometric stage. `cols`×`rows` is the ground grid; the world is centred in
 * its box and tilted so blocks read as 3D.
 */
export function VoxelWorld({
  cols,
  rows,
  size,
  tilt = 58,
  spin = 45,
  sway = true,
  children,
  className,
  style,
}: {
  cols: number;
  rows: number;
  size: number;
  tilt?: number;
  spin?: number;
  /** Gently rock the scene back and forth. */
  sway?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`relative flex items-center justify-center ${className ?? ""}`} style={{ perspective: 2200, ...style }}>
      <div
        className={`vx-world${sway ? " vx-sway" : ""}`}
        style={
          {
            width: cols * size,
            height: rows * size,
            "--tilt": `${tilt}deg`,
            "--spin": `${spin}deg`,
            transform: `rotateX(${tilt}deg) rotateZ(${spin}deg)`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
