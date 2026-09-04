import stembotBlue from "../assets/stembot_blue.png";
import stembotRed from "../assets/stembot_red.png";
import stembotGreen from "../assets/stembot_green.png";
import stembotCream from "../assets/stembot_cream.png";

const BOTS = [stembotBlue, stembotRed, stembotGreen, stembotCream];

// Fixed (not random-per-render) rotation/scale per tile so the pattern
// looks hand-arranged and playful but never shifts between renders.
const TILE_VARIANTS = [
  { rotate: -12, scale: 1.0 },
  { rotate: 8, scale: 0.9 },
  { rotate: -6, scale: 1.05 },
  { rotate: 15, scale: 0.85 },
  { rotate: -18, scale: 0.95 },
  { rotate: 5, scale: 1.0 },
  { rotate: -9, scale: 0.9 },
  { rotate: 20, scale: 1.05 },
];

const COLS = 10;
const ROWS = 8;
const TILE_SIZE = 130; // px — every row/band is an exact multiple of this,
// so two bands placed side by side tile with zero gap.

function Tile({ i }: { i: number }) {
  const bot = BOTS[i % BOTS.length];
  const variant = TILE_VARIANTS[i % TILE_VARIANTS.length];
  return (
    <div
      style={{ width: TILE_SIZE, height: TILE_SIZE }}
      className="flex items-center justify-center shrink-0"
    >
      <img
        src={bot}
        alt=""
        draggable={false}
        style={{
          transform: `rotate(${variant.rotate}deg) scale(${variant.scale})`,
          width: "78%",
          height: "78%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

/**
 * A continuous, never-ending tiled collage of the STEMbot characters,
 * arranged in an even grid but at varying angles for a dynamic feel.
 * Purely decorative — sits behind the login card, fills the entire
 * viewport, and slowly auto-scrolls sideways in a perfectly seamless loop.
 *
 * Each row is an explicit fixed-width strip (COLS * TILE_SIZE, exactly).
 * Alternate rows are nudged sideways with a CSS transform (which doesn't
 * change the row's box width) purely for visual stagger — this keeps every
 * band pixel-identical in width, so two bands placed side by side tile with
 * no seam or vertical gap, no matter how far the loop scrolls.
 */
export function StembotPattern({ className = "" }: { className?: string }) {
  const bandWidth = COLS * TILE_SIZE;

  const renderBand = (bandKey: string) => (
    <div style={{ width: bandWidth }} className="shrink-0" key={bandKey}>
      {Array.from({ length: ROWS }, (_, rowIndex) => {
        const staggered = rowIndex % 2 === 1;
        return (
          <div
            key={rowIndex}
            className="flex overflow-visible"
            style={{
              width: bandWidth,
              transform: staggered ? `translateX(${TILE_SIZE / 2}px)` : undefined,
            }}
          >
            {Array.from({ length: COLS }, (_, col) => {
              const i = rowIndex * COLS + col;
              return <Tile key={col} i={i} />;
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Two identical, pixel-exact bands placed side by side and animated
          together give a perfectly seamless infinite horizontal scroll. */}
      <div
        className="flex h-full items-center animate-stembot-scroll"
        style={{ width: bandWidth * 2 }}
      >
        {renderBand("band-a")}
        {renderBand("band-b")}
      </div>
    </div>
  );
}
