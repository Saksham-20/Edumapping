// client/src/components/brand/index.js
//
// The attested record's signature pieces, shared by the public site and the
// signed-in app:
//
//   Guilloche       a security-printing rosette, generated from spirograph
//                   curves rather than drawn, so it is crisp at any size
//   GuillocheBand   the interleaved wave border of a marksheet
//   CertificateFrame  a record surface framed by that band
//   Stamp           a rubber attestation stamp, optionally pressed in
//   Serial          a document serial / roll number
//   MicroRule       a line of microtext, the anti-copy rule on real certificates
//
// Every animation here is CSS (`ink-draw`, `stamp-press` in styles/index.css)
// and switches off under prefers-reduced-motion.
import React, { useId, useMemo } from 'react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ----------------------------------------------------------------- geometry */

/**
 * A hypotrochoid: the curve a pen traces inside a rolling circle. Real
 * guilloche engines layer these with slightly different ratios. `R`, `r` and
 * `d` are in the same arbitrary unit; the result is centred on (cx, cy).
 */
const hypotrochoid = ({ R, r, d, cx: ox, cy: oy, steps = 1400 }) => {
  // The curve closes after lcm(R, r) / R turns of the outer circle.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const turns = r / gcd(R, r);
  const total = Math.PI * 2 * turns;
  let out = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * total;
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    out += `${i ? 'L' : 'M'}${(ox + x).toFixed(2)} ${(oy + y).toFixed(2)}`;
  }
  return `${out}Z`;
};

// Three layers that read as one engraved rosette: a dense saffron outer
// lace, a green middle ring and a fine ink core. Ratios chosen so the petals
// interleave instead of stacking.
const ROSETTE_LAYERS = [
  { R: 96, r: 37, d: 56, tone: 'saffron', width: 0.55 },
  { R: 96, r: 31, d: 40, tone: 'india', width: 0.5 },
  { R: 60, r: 23, d: 30, tone: 'ink', width: 0.45 },
  { R: 40, r: 11, d: 17, tone: 'saffron', width: 0.4 }
];

// A hollow ring: the pen offset `d` stays well short of R - r, so the curve
// never sweeps the centre (min radius R - r - d). Used for watermarks that sit
// behind text, where a dense core reads as a smudge.
const LACE_LAYERS = [
  { R: 96, r: 37, d: 26, tone: 'saffron', width: 0.55 },
  { R: 96, r: 31, d: 20, tone: 'india', width: 0.5 }
];

// Below ~150px the full lace turns to mush; two heavier layers stay crisp.
const SMALL_LAYERS = [
  { R: 96, r: 37, d: 56, tone: 'saffron', width: 1.3 },
  { R: 60, r: 23, d: 30, tone: 'india', width: 1.2 }
];

const TONES = {
  light: { saffron: '#E57E14', india: '#138808', ink: '#0C1426' },
  dark: { saffron: '#FFA451', india: '#3FB22D', ink: '#F5F1E6' },
  paper: { saffron: '#B35F0C', india: '#0F6C06', ink: '#46516B' }
};

/**
 * Guilloche — the rosette.
 *
 * `draw` traces each layer once on mount (the hero's signature moment); off
 * by default so dense app screens never animate decoration.
 */
export const Guilloche = ({
  size = 240,
  tone = 'light',
  draw = false,
  opacity = 1,
  lace = false,
  className = '',
  layers
}) => {
  const palette = TONES[tone] || TONES.light;
  // `lace` keeps only the two outer rings: a watermark with no dense core to
  // smudge whatever text it sits behind.
  if (!layers) layers = size < 150 ? SMALL_LAYERS : lace ? LACE_LAYERS : ROSETTE_LAYERS;
  const paths = useMemo(
    () => layers.map((l) => ({ ...l, d: hypotrochoid({ ...l, cx: 100, cy: 100 }) })),
    [layers]
  );
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cx(draw && 'ink-draw', className)}
      style={{ opacity }}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={palette[p.tone]}
          strokeWidth={p.width}
          strokeLinejoin="round"
          pathLength={1}
          style={draw ? { animationDelay: `${i * 0.22}s` } : undefined}
        />
      ))}
    </svg>
  );
};

/**
 * GuillocheBand — two interleaved sine waves, the border of a marksheet.
 * Tiles horizontally at any width; `height` is the band's thickness.
 */
export const GuillocheBand = ({ height = 14, tone = 'light', className = '' }) => {
  const id = useId().replace(/:/g, '');
  const palette = TONES[tone] || TONES.light;
  const w = 28;
  const h = height;
  const wave = (phase) => {
    let d = '';
    for (let x = 0; x <= w; x += 1) {
      const y = h / 2 + (h / 2 - 1.2) * Math.sin((x / w) * Math.PI * 2 + phase);
      d += `${x ? 'L' : 'M'}${x} ${y.toFixed(2)}`;
    }
    return d;
  };
  return (
    <svg aria-hidden="true" focusable="false" className={cx('block w-full', className)} height={h}>
      <defs>
        <pattern id={`gb-${id}`} width={w} height={h} patternUnits="userSpaceOnUse">
          <path d={wave(0)} fill="none" stroke={palette.saffron} strokeWidth="0.8" />
          <path d={wave(Math.PI)} fill="none" stroke={palette.india} strokeWidth="0.8" />
          <path d={wave(Math.PI / 2)} fill="none" stroke={palette.ink} strokeWidth="0.35" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height={h} fill={`url(#gb-${id})`} />
    </svg>
  );
};

/**
 * CertificateFrame — a record surface with a guilloche border on all four
 * sides, an inner hairline and optional serial in the top margin. Used for
 * the documents a student or the cell would recognise as "the record":
 * verification, offer letters, the landing hero.
 */
export const CertificateFrame = ({
  children,
  serial,
  tone = 'light',
  compact = false,
  className = '',
  innerClassName = ''
}) => {
  const id = useId().replace(/:/g, '');
  const palette = TONES[tone] || TONES.light;
  const dark = tone === 'dark';
  // Compact: a thinner band for small documents that sit beside the hero record.
  const band = compact
    ? { pad: 'p-[9px]', inset: 3, stroke: 5, r: 8 }
    : { pad: 'p-[14px]', inset: 5, stroke: 9, r: 10 };
  return (
    <div
      className={cx(
        'relative rounded-[14px]',
        band.pad,
        dark ? 'bg-ink-900' : 'bg-[#FFFDF8]',
        className
      )}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        // Inset by half the stroke so the band sits inside the padding; the
        // stroke itself spills over the svg box, hence overflow-visible.
        className="pointer-events-none absolute overflow-visible"
        style={{
          left: band.inset,
          top: band.inset,
          width: `calc(100% - ${band.inset * 2}px)`,
          height: `calc(100% - ${band.inset * 2}px)`
        }}
      >
        <defs>
          {/* Interlaced rings: the classic guilloche net. Symmetric, so it
              reads the same on the vertical edges as on the horizontal. */}
          <pattern id={`cf-${id}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="4.2" fill="none" stroke={palette.saffron} strokeWidth="0.6" />
            <circle cx="0" cy="0" r="4.2" fill="none" stroke={palette.india} strokeWidth="0.6" />
            <circle cx="10" cy="0" r="4.2" fill="none" stroke={palette.india} strokeWidth="0.6" />
            <circle cx="0" cy="10" r="4.2" fill="none" stroke={palette.india} strokeWidth="0.6" />
            <circle cx="10" cy="10" r="4.2" fill="none" stroke={palette.india} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          rx={band.r}
          fill="none"
          stroke={`url(#cf-${id})`}
          strokeWidth={band.stroke}
        />
      </svg>
      <div
        className={cx(
          'relative h-full rounded-[6px] border',
          dark ? 'border-white/15 bg-ink-900' : 'border-ink-950/15 bg-[#FFFDF8]',
          innerClassName
        )}
      >
        {serial && (
          <span
            className={cx(
              'absolute right-4 top-3 font-mono text-[10px] tracking-[0.08em]',
              dark ? 'text-bone-300/70' : 'text-ink-500'
            )}
          >
            {serial}
          </span>
        )}
        {children}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- stamp */

const STAMP_TONES = {
  stamp: 'text-stamp-600 border-stamp-600',
  india: 'text-india-700 border-india-700',
  vermilion: 'text-vermilion-600 border-vermilion-600',
  saffron: 'text-saffron-800 border-saffron-700',
  light: 'text-bone-50 border-bone-50'
};

/**
 * Stamp — a rubber attestation stamp.
 *
 * Double rule, expanded capitals, a few degrees off true. `press` plays the
 * stamp landing once (after `delay` seconds); without it the stamp simply sits
 * there, which is what in-app status uses.
 */
export const Stamp = ({
  children,
  sub,
  tone = 'stamp',
  rotate = -7,
  press = false,
  delay = 0,
  size = 'md',
  className = ''
}) => {
  const sizes = {
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-xl',
    // md on phones, lg from sm up: the hero stamp must fit a 390px card.
    fluid: 'px-4 py-2 text-base sm:px-6 sm:py-3 sm:text-xl'
  };
  return (
    <span
      className={cx(
        'inline-flex flex-col items-center rounded-[6px] border-[2.5px] font-display font-extrabold uppercase leading-none tracking-[0.12em]',
        'outline outline-[1.5px] outline-offset-[3px] outline-current',
        STAMP_TONES[tone] || STAMP_TONES.stamp,
        sizes[size],
        press && 'stamp-press',
        className
      )}
      style={{
        '--stamp-rot': `${rotate}deg`,
        transform: press ? undefined : `rotate(${rotate}deg)`,
        animationDelay: press ? `${delay}s` : undefined,
        mixBlendMode: tone === 'light' ? 'normal' : 'multiply'
      }}
    >
      <span className="whitespace-nowrap">{children}</span>
      {sub && (
        <span className="mt-1 whitespace-nowrap font-mono text-[0.55em] font-medium normal-case tracking-[0.06em]">
          {sub}
        </span>
      )}
    </span>
  );
};

/* ------------------------------------------------------------ small marks */

/** A document serial or roll number. Mono, because it is data. */
export const Serial = ({ children, className = '' }) => (
  <span className={cx('font-mono text-xs tracking-[0.04em] text-ink-500', className)}>{children}</span>
);

/**
 * MicroRule — a single line of 6px microtext, the anti-copy rule printed on
 * real certificates. Decorative, so hidden from assistive tech.
 */
export const MicroRule = ({
  text = 'EDUMAPPING · ATTESTED RECORD · FROM CLASSROOM TO CAREER · ',
  tone = 'light',
  className = ''
}) => (
  <div
    aria-hidden="true"
    className={cx(
      // `contain` keeps the nowrap run from widening a grid or flex parent.
      'select-none overflow-hidden whitespace-nowrap [contain:inline-size] font-display text-[6px] font-semibold uppercase leading-[8px] tracking-[0.2em]',
      tone === 'dark' ? 'text-bone-300/35' : 'text-ink-500/60',
      className
    )}
  >
    {text.repeat(14)}
  </div>
);
