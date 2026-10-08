// The certificate artwork itself, drawn as one SVG on an A4 landscape canvas.
// The same SVG is shown on screen, printed, and rasterised for the PNG export,
// so it only uses plain SVG (no CSS variables, no HTML inside).
import { forwardRef, useEffect, useId, useMemo, useState, type ReactElement } from "react";
import stemulateLogo from "../assets/stemulate_logo.png";
import {
  CERT_BOTS,
  CERT_H,
  CERT_W,
  type CertBotId,
  type CertPalette,
  type CertPatternId,
  burstPath,
  scallopPath,
  seeded,
  starPath,
} from "./certificateKit";

const HEAD = "Fredoka, Nunito, 'Arial Rounded MT Bold', system-ui, sans-serif";
const BODY = "Nunito, Fredoka, system-ui, sans-serif";

// ---- text measuring (canvas, after the web fonts have loaded) ----

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, size: number, weight: number, family = HEAD, spacing = 0): number {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * size * 0.56;
  measureCtx.font = `${weight} ${size}px ${family}`;
  return measureCtx.measureText(text).width + spacing * text.length;
}

function useFontsReady() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    Promise.all([
      fonts.load(`700 80px Fredoka`),
      fonts.load(`600 20px Fredoka`),
      fonts.load(`800 16px Nunito`),
    ])
      .catch(() => undefined)
      .then(() => fonts.ready)
      .then(() => live && setTick((t) => t + 1));
    return () => {
      live = false;
    };
  }, []);
  return tick;
}

// ---- layout helpers ----

type Badge = { text: string; x: number; y: number; w: number };

function layoutBadges(lessons: string[], maxW: number, top: number) {
  const gap = 14;
  for (let size = 19; size >= 12; size--) {
    const widths = lessons.map((l) => Math.ceil(textWidth(l, size, 600)) + 58);
    const rows: number[][] = [[]];
    let rowW = 0;
    widths.forEach((w, i) => {
      const add = rows[rows.length - 1].length ? gap + w : w;
      if (rowW + add > maxW && rows[rows.length - 1].length) {
        rows.push([i]);
        rowW = w;
      } else {
        rows[rows.length - 1].push(i);
        rowW += add;
      }
    });
    if (rows.length <= 2 || size === 12) {
      const rowH = size + 26;
      const badges: Badge[] = [];
      rows.forEach((row, r) => {
        const total = row.reduce((s, i) => s + widths[i], 0) + gap * (row.length - 1);
        let x = CERT_W / 2 - total / 2;
        row.forEach((i) => {
          badges.push({ text: lessons[i], x, y: top + r * (rowH + 10), w: widths[i] });
          x += widths[i] + gap;
        });
      });
      return { badges, size, rowH };
    }
  }
  return { badges: [], size: 12, rowH: 38 };
}

// ---- border patterns ----

function Pattern({ kind, p, seed }: { kind: CertPatternId; p: CertPalette; seed: string }) {
  const els = useMemo(() => {
    const rnd = seeded(`${kind}:${seed}`);
    const colours = [p.primary, p.pop2, p.pop3];
    const out: ReactElement[] = [];
    // Points scattered round the margin of the paper, avoiding the middle.
    const spots = (n: number, pad = 0) => {
      const pts: { x: number; y: number }[] = [];
      let guard = 0;
      while (pts.length < n && guard++ < n * 40) {
        const x = 60 + rnd() * (CERT_W - 120);
        const y = 60 + rnd() * (CERT_H - 120);
        const inMiddle = x > 230 - pad && x < CERT_W - 230 + pad && y > 118 - pad && y < CERT_H - 92 + pad;
        if (inMiddle) continue;
        if (x > 330 && x < CERT_W - 330 && y < 150) continue; // keep the logo clear
        if (y > CERT_H - 130 && ((x > 140 && x < 400) || (x > 720 && x < 990))) continue; // date + signature
        if (pts.some((q) => Math.hypot(q.x - x, q.y - y) < 46)) continue;
        pts.push({ x, y });
      }
      return pts;
    };

    if (kind === "stars") {
      spots(48).forEach(({ x, y }, i) => {
        const c = colours[i % 3];
        if (i % 3 === 2) {
          const s = 5 + rnd() * 5;
          out.push(
            <path
              key={i}
              d={`M${x},${y - s * 1.6}Q${x},${y} ${x + s * 1.6},${y}Q${x},${y} ${x},${y + s * 1.6}Q${x},${y} ${x - s * 1.6},${y}Q${x},${y} ${x},${y - s * 1.6}Z`}
              fill={c}
              opacity={0.7}
            />,
          );
        } else {
          const r = 8 + rnd() * 9;
          out.push(
            <path
              key={i}
              d={starPath(x, y, r)}
              fill={c}
              opacity={0.55}
              stroke={p.ink}
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeLinejoin="round"
              transform={`rotate(${(rnd() * 40 - 20).toFixed(1)} ${x} ${y})`}
            />,
          );
        }
      });
    } else if (kind === "confetti") {
      spots(70).forEach(({ x, y }, i) => {
        const c = colours[i % 3];
        const rot = (rnd() * 180).toFixed(0);
        const t = i % 4;
        if (t === 0) out.push(<circle key={i} cx={x} cy={y} r={4 + rnd() * 3} fill={c} opacity={0.7} />);
        else if (t === 1)
          out.push(
            <rect key={i} x={x - 8} y={y - 3.5} width={16} height={7} rx={2} fill={c} opacity={0.7} transform={`rotate(${rot} ${x} ${y})`} />,
          );
        else if (t === 2)
          out.push(
            <path
              key={i}
              d={`M${x - 12},${y}q4,-8 8,0t8,0t8,0`}
              fill="none"
              stroke={c}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.75}
              transform={`rotate(${rot} ${x} ${y})`}
            />,
          );
        else
          out.push(
            <path key={i} d={`M${x},${y - 7}L${x + 7},${y + 6}L${x - 7},${y + 6}Z`} fill={c} opacity={0.65} transform={`rotate(${rot} ${x} ${y})`} />,
          );
      });
    } else if (kind === "waves") {
      const wave = (y: number, amp: number, len: number, phase: number) => {
        let d = `M${40 - phase},${y}`;
        for (let x = 40 - phase; x < CERT_W - 20; x += len) d += `q${len / 4},${-amp} ${len / 2},0t${len / 2},0`;
        return d;
      };
      [
        { y: 78, c: p.pop3, a: 9 },
        { y: 100, c: p.primary, a: 7 },
        { y: CERT_H - 100, c: p.primary, a: 7 },
        { y: CERT_H - 78, c: p.pop3, a: 9 },
      ].forEach((w, i) =>
        out.push(
          <path key={`w${i}`} d={wave(w.y, w.a, 56, (i % 2) * 28)} fill="none" stroke={w.c} strokeWidth={5} strokeLinecap="round" opacity={0.42} />,
        ),
      );
      // Bubbles up the sides.
      spots(26, -20)
        .filter((s) => s.y > 120 && s.y < CERT_H - 120)
        .forEach(({ x, y }, i) =>
          out.push(
            <circle key={`b${i}`} cx={x} cy={y} r={5 + rnd() * 9} fill="none" stroke={colours[i % 3]} strokeWidth={3} opacity={0.5} />,
          ),
        );
    } else {
      // Blocks: little pixel staircases in each corner, Minecraft style.
      const size = 22;
      const corners = [
        { x: 58, y: 58, dx: 1, dy: 1 },
        { x: CERT_W - 58 - size, y: 58, dx: -1, dy: 1 },
        { x: 58, y: CERT_H - 58 - size, dx: 1, dy: -1 },
        { x: CERT_W - 58 - size, y: CERT_H - 58 - size, dx: -1, dy: -1 },
      ];
      corners.forEach((c, ci) => {
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 6 - row; col++) {
            if (rnd() < 0.18 && row + col > 1) continue;
            const x = c.x + c.dx * col * size;
            const y = c.y + c.dy * row * size;
            const fill = colours[(row + col + ci) % 3];
            out.push(
              <g key={`${ci}-${row}-${col}`} opacity={0.5}>
                <rect x={x} y={y} width={size} height={size} fill={fill} stroke={p.ink} strokeWidth={2} />
                <rect x={x + 4} y={y + 4} width={6} height={6} fill="#ffffff" opacity={0.55} />
              </g>,
            );
          }
        }
      });
      spots(18, -30)
        .filter((s) => s.y > 210 && s.y < CERT_H - 210)
        .forEach(({ x, y }, i) =>
          out.push(
            <rect key={`s${i}`} x={x - 7} y={y - 7} width={14} height={14} fill={colours[i % 3]} stroke={p.ink} strokeWidth={1.5} opacity={0.45} />,
          ),
        );
    }
    return out;
  }, [kind, p, seed]);
  return <g>{els}</g>;
}

// ---- the artwork ----

export type CertificateArtProps = {
  name: string;
  moduleName: string;
  moduleId: string;
  lessons: string[];
  dateText: string | null;
  palette: CertPalette;
  bots: CertBotId[];
  pattern: CertPatternId;
  locked?: boolean;
  className?: string;
};

export const CertificateArt = forwardRef<SVGSVGElement, CertificateArtProps>(function CertificateArt(
  { name, moduleName, moduleId, lessons, dateText, palette: p, bots, pattern, locked, className },
  ref,
) {
  const fontsTick = useFontsReady();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { cut: `cut${uid}`, clip: `clip${uid}`, arc: `arc${uid}`, paper: `paper${uid}` };

  const displayName = name.trim() || "Your Name";

  // Font sizes that keep long names and module titles inside the paper.
  const layout = useMemo(() => {
    const nameMax = 600;
    let nameSize = 86;
    const nw = textWidth(displayName, nameSize, 700);
    if (nw > nameMax) nameSize = Math.max(40, Math.floor((nameSize * nameMax) / nw));
    const nameW = Math.min(nameMax, textWidth(displayName, nameSize, 700));

    let modSize = 32;
    const mw = textWidth(moduleName, modSize, 700);
    if (mw > 520) modSize = Math.max(18, Math.floor((modSize * 520) / mw));
    const modW = textWidth(moduleName, modSize, 700);

    const brandW = textWidth("STEMulate Academy", 25, 600);
    const kicker = "Module complete!";
    const kickerW = textWidth(kicker.toUpperCase(), 13, 800, BODY, 2.6) + 78;
    const badges = layoutBadges(lessons, 700, 494);
    return { nameSize, nameW, modSize, modW, brandW, kicker, kickerW, badges };
    // fontsTick re-measures once Fredoka has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, moduleName, lessons.join("|"), fontsTick]);

  const chosenBots = bots.map((b) => CERT_BOTS.find((x) => x.id === b)).filter(Boolean) as (typeof CERT_BOTS)[number][];
  const W = CERT_W;
  const H = CERT_H;
  const cx = W / 2;

  // Ribbon banner for the module name.
  const ribW = layout.modW + 90;
  const ribH = 58;
  const ribY = 410;
  const ribX = cx - ribW / 2;
  const tail = 34;

  // Seal position (bottom centre).
  const sx = cx;
  const sy = 642;

  const badgeColours = [p.soft1, p.soft2, p.soft3];

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`Certificate of completion: ${displayName}, ${moduleName}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Die-cut sticker outline for the STEMbots: ink rim, white rim, hard shadow. */}
        <filter id={ids.cut} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="white" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="8.5" result="inkA" />
          <feFlood floodColor={p.ink} result="inkC" />
          <feComposite in="inkC" in2="inkA" operator="in" result="inkRim" />
          <feOffset in="inkRim" dx="0" dy="6" result="shadow" />
          <feFlood floodColor="#ffffff" result="whiteC" />
          <feComposite in="whiteC" in2="white" operator="in" result="whiteRim" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="inkRim" />
            <feMergeNode in="whiteRim" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={ids.clip}>
          <rect x={50} y={46} width={W - 100} height={H - 104} rx={26} />
        </clipPath>
        <path id={ids.arc} d={`M${sx - 46},${sy} a46,46 0 1 1 92,0 a46,46 0 1 1 -92,0`} />
      </defs>

      {/* Hard ink shadow, then the scalloped stamp frame in the theme colour. */}
      <path d={scallopPath(24, 28, W - 48, H - 52, 13)} fill={p.ink} />
      <path
        d={scallopPath(24, 20, W - 48, H - 52, 13)}
        fill={p.primary}
        stroke={p.ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* Little white "perforation" dots round the frame */}
      <rect x={37} y={33} width={W - 74} height={H - 78} rx={30} fill="none" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={4} strokeDasharray="0.1 16" strokeLinecap="round" />

      {/* Paper */}
      <rect x={50} y={46} width={W - 100} height={H - 104} rx={26} fill={p.paper} stroke={p.ink} strokeWidth={4} />
      <g clipPath={`url(#${ids.clip})`}>
        <Pattern kind={pattern} p={p} seed={moduleId} />
      </g>
      {/* Stitched inner line */}
      <rect
        x={64}
        y={60}
        width={W - 128}
        height={H - 132}
        rx={18}
        fill="none"
        stroke={p.primary}
        strokeWidth={3}
        strokeDasharray="1 11"
        strokeLinecap="round"
      />

      {/* Header: logo + wordmark */}
      <g>
        {(() => {
          const groupW = 58 + 12 + layout.brandW;
          const gx = cx - groupW / 2 - 6;
          return (
            <>
              <image href={stemulateLogo} x={gx} y={78} width={58} height={52} preserveAspectRatio="xMidYMid meet" />
              <text x={gx + 70} y={113} fontFamily={HEAD} fontWeight={600} fontSize={25} fill={p.ink}>
                STEM<tspan fill={p.primary === "#f5a20b" ? "#c27c00" : p.primary}>ulate</tspan> Academy
              </text>
            </>
          );
        })()}
      </g>

      {/* Kicker pill */}
      <g transform={`rotate(-2 ${cx} 160)`}>
        <rect x={cx - layout.kickerW / 2} y={143} width={layout.kickerW} height={32} rx={16} fill={p.soft2} stroke={p.ink} strokeWidth={2.5} />
        <path d={starPath(cx - layout.kickerW / 2 + 20, 159, 7)} fill={p.pop2} stroke={p.ink} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={starPath(cx + layout.kickerW / 2 - 20, 159, 7)} fill={p.pop2} stroke={p.ink} strokeWidth={1.5} strokeLinejoin="round" />
        <text
          x={cx}
          y={164}
          textAnchor="middle"
          fontFamily={BODY}
          fontWeight={800}
          fontSize={13}
          letterSpacing={2.6}
          fill={p.soft2Ink}
        >
          {layout.kicker.toUpperCase()}
        </text>
      </g>

      {/* Title */}
      <text x={cx} y={232} textAnchor="middle" fontFamily={HEAD} fontWeight={700} fontSize={50} fill={p.ink}>
        Certificate of Completion
      </text>
      <text x={cx} y={272} textAnchor="middle" fontFamily={BODY} fontWeight={700} fontSize={18} fill={p.muted}>
        This certificate is proudly presented to
      </text>

      {/* Name with a highlighter swoosh behind it */}
      <g transform={`rotate(-1.5 ${cx} 340)`}>
        <rect
          x={cx - layout.nameW / 2 - 22}
          y={340 - layout.nameSize * 0.32}
          width={layout.nameW + 44}
          height={layout.nameSize * 0.42}
          rx={layout.nameSize * 0.2}
          fill={p.pop2}
          opacity={0.55}
        />
      </g>
      <text
        x={cx}
        y={360}
        textAnchor="middle"
        fontFamily={HEAD}
        fontWeight={700}
        fontSize={layout.nameSize}
        fill={p.ink}
      >
        {displayName}
      </text>

      <text x={cx} y={398} textAnchor="middle" fontFamily={BODY} fontWeight={700} fontSize={18} fill={p.muted}>
        for completing every lesson in the module
      </text>

      {/* Module ribbon */}
      <g transform={`rotate(-1 ${cx} ${ribY + ribH / 2})`}>
        {/* tails */}
        <path
          d={`M${ribX + 10},${ribY + 14} h${-tail - 12} l${tail * 0.55},${(ribH - 6) / 2} l${-tail * 0.55},${(ribH - 6) / 2} h${tail + 12} Z`}
          fill={p.pop3}
          stroke={p.ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d={`M${ribX + ribW - 10},${ribY + 14} h${tail + 12} l${-tail * 0.55},${(ribH - 6) / 2} l${tail * 0.55},${(ribH - 6) / 2} h${-tail - 12} Z`}
          fill={p.pop3}
          stroke={p.ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <rect x={ribX + 3} y={ribY + 5} width={ribW} height={ribH} rx={14} fill={p.ink} />
        <rect x={ribX} y={ribY} width={ribW} height={ribH} rx={14} fill={p.primary} stroke={p.ink} strokeWidth={3} />
        <rect x={ribX + 8} y={ribY + 7} width={ribW - 16} height={ribH - 14} rx={9} fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="6 6" />
        <text
          x={cx}
          y={ribY + ribH / 2 + layout.modSize * 0.36}
          textAnchor="middle"
          fontFamily={HEAD}
          fontWeight={700}
          fontSize={layout.modSize}
          fill={p.primaryFg}
        >
          {moduleName}
        </text>
      </g>

      {/* Lessons as little badges */}
      {layout.badges.badges.map((b, i) => {
        const h = layout.badges.rowH;
        const r = h / 2 - 7;
        return (
          <g key={b.text + i} transform={`rotate(${i % 2 ? 1.2 : -1.2} ${b.x + b.w / 2} ${b.y + h / 2})`}>
            <rect x={b.x} y={b.y + 3} width={b.w} height={h} rx={h / 2} fill={p.ink} />
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={h}
              rx={h / 2}
              fill={badgeColours[i % 3]}
              stroke={p.ink}
              strokeWidth={2.5}
              strokeDasharray={locked ? "6 5" : undefined}
            />
            <circle cx={b.x + 7 + r} cy={b.y + h / 2} r={r} fill={locked ? "#ffffff" : p.pop2} stroke={p.ink} strokeWidth={2} />
            {!locked && (
              <path
                d={`M${b.x + 7 + r - r * 0.45},${b.y + h / 2 + 0.5} l${r * 0.32},${r * 0.34} l${r * 0.6},${-r * 0.7}`}
                fill="none"
                stroke={p.ink}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <text
              x={b.x + 14 + r * 2 + 4}
              y={b.y + h / 2 + layout.badges.size * 0.36}
              fontFamily={HEAD}
              fontWeight={600}
              fontSize={layout.badges.size}
              fill={p.ink}
            >
              {b.text}
            </text>
          </g>
        );
      })}

      {/* Footer: date (left) and signature (right) */}
      <g>
        <text x={268} y={652} textAnchor="middle" fontFamily={HEAD} fontWeight={600} fontSize={24} fill={p.ink}>
          {dateText ?? "Not earned yet"}
        </text>
        <line x1={158} y1={666} x2={378} y2={666} stroke={p.ink} strokeWidth={2.5} strokeLinecap="round" />
        <text x={268} y={690} textAnchor="middle" fontFamily={BODY} fontWeight={800} fontSize={12} letterSpacing={2.4} fill={p.muted}>
          DATE AWARDED
        </text>

        <path
          d="M772,650 c8,-30 22,-34 18,-6 c-3,18 -10,22 -6,8 c5,-16 18,-22 22,-6 c3,10 8,12 14,-2 c4,-10 10,-10 10,2 c0,10 6,10 12,0 c6,-12 12,-14 14,-2 c2,10 8,10 16,-4 c5,-9 10,-6 10,2 c0,8 6,8 14,-2 c10,-12 20,-12 28,-6"
          fill="none"
          stroke={p.ink}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M780,658 q70,-12 150,-8" fill="none" stroke={p.primary} strokeWidth={3.5} strokeLinecap="round" />
        <line x1={745} y1={666} x2={965} y2={666} stroke={p.ink} strokeWidth={2.5} strokeLinecap="round" />
        <text x={855} y={690} textAnchor="middle" fontFamily={BODY} fontWeight={800} fontSize={12} letterSpacing={2.4} fill={p.muted}>
          STEMULATE EXCO
        </text>
      </g>

      {/* Rosette seal */}
      <g>
        <path d={`M${sx - 30},${sy + 30} l-20,78 l22,-12 l12,22 l18,-74 Z`} fill={p.pop3} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
        <path d={`M${sx + 30},${sy + 30} l20,78 l-22,-12 l-12,22 l-18,-74 Z`} fill={p.primary} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
        <path d={burstPath(sx + 2, sy + 5, 72, 62, 22)} fill={p.ink} />
        <path d={burstPath(sx, sy, 72, 62, 22)} fill={p.pop2} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
        <circle cx={sx} cy={sy} r={56} fill="#ffffff" stroke={p.ink} strokeWidth={3} />
        <circle cx={sx} cy={sy} r={36} fill={p.soft1} stroke={p.ink} strokeWidth={2} strokeDasharray="3 4" />
        <text fontFamily={BODY} fontWeight={900} fontSize={10.5} letterSpacing={2.2} fill={p.ink}>
          <textPath href={`#${ids.arc}`} startOffset="0" textLength={2 * Math.PI * 46 - 6} lengthAdjust="spacing">
            ★ STEMULATE ACADEMY ★ WELL DONE
          </textPath>
        </text>
        <path d={starPath(sx, sy - 6, 19)} fill={p.primary} stroke={p.ink} strokeWidth={2.5} strokeLinejoin="round" />
        <text x={sx} y={sy + 26} textAnchor="middle" fontFamily={HEAD} fontWeight={700} fontSize={12} fill={p.ink}>
          100%
        </text>
      </g>

      {/* STEMbot mascots, peeking in from the sides */}
      {chosenBots.map((b, i) => {
        const left = i === 0;
        const w = 168;
        const h = 196;
        const x = left ? 34 : W - 34 - w;
        const y = 236;
        return (
          <g key={b.id} transform={`rotate(${left ? -9 : 9} ${x + w / 2} ${y + h / 2})`}>
            <image href={b.src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" filter={`url(#${ids.cut})`} />
            <g transform={`rotate(${left ? 4 : -4} ${x + w / 2} ${y + h + 18})`}>
              <rect x={x + w / 2 - 44} y={y + h + 2} width={88} height={28} rx={14} fill="#ffffff" stroke={p.ink} strokeWidth={2.5} />
              <text x={x + w / 2} y={y + h + 21} textAnchor="middle" fontFamily={HEAD} fontWeight={600} fontSize={15} fill={p.ink}>
                {b.name}
              </text>
            </g>
          </g>
        );
      })}

      {locked && (
        <g data-export-skip="">
          <rect x={50} y={46} width={W - 100} height={H - 104} rx={26} fill={p.paper} opacity={0.45} />
          <g transform={`rotate(-10 ${cx} 330)`}>
            <rect x={cx - 230} y={282} width={460} height={100} rx={22} fill="#ffffff" stroke={p.ink} strokeWidth={4} />
            <rect x={cx - 220} y={292} width={440} height={80} rx={16} fill="none" stroke={p.primary} strokeWidth={3} strokeDasharray="10 8" />
            <g transform={`translate(${cx - 182} 309)`}>
              <rect x={0} y={18} width={40} height={30} rx={7} fill={p.primary} stroke={p.ink} strokeWidth={3} />
              <path d="M8,19 v-7 a12,12 0 0 1 24,0 v7" fill="none" stroke={p.ink} strokeWidth={4} strokeLinecap="round" />
              <circle cx={20} cy={32} r={4} fill={p.ink} />
            </g>
            <text x={cx + 26} y={330} textAnchor="middle" fontFamily={HEAD} fontWeight={700} fontSize={38} fill={p.ink}>
              Preview
            </text>
            <text x={cx + 26} y={358} textAnchor="middle" fontFamily={BODY} fontWeight={800} fontSize={15} fill={p.muted}>
              Finish every lesson to unlock it!
            </text>
          </g>
        </g>
      )}
    </svg>
  );
});
