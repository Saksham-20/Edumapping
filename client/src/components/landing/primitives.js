// client/src/components/landing/primitives.js
//
// The landing page's design system. Every section composes these; nothing
// below fetches data or makes routing decisions.
//
// Visual language: a warm bone canvas, near-black ink type, saffron as the one
// hot accent and india green as the "verified/positive" signal. Surfaces are
// hard-edged — 1px ink borders and offset block shadows rather than soft
// drop shadows — so the page reads as printed editorial rather than generic
// glassy SaaS.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/* ------------------------------------------------------------------ motion */

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

export const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } }
};

/**
 * Reveal — fades a block up as it enters the viewport, once.
 * Collapses to a plain element under reduced motion, so content is never
 * withheld from someone who has asked for less movement.
 */
export const Reveal = ({ children, className = '', delay = 0, as = 'div' }) => {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-70px' }}
      variants={{
        hidden: { opacity: 0, y: 22 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] } }
      }}
    >
      {children}
    </MotionTag>
  );
};

/* ------------------------------------------------------------------ layout */

/** The page gutter and max width. Every section uses it, so nothing drifts. */
export const Container = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-content px-5 sm:px-8 lg:px-10 ${className}`}>{children}</div>
);

/**
 * Section — the vertical rhythm unit.
 * `tone` sets ground and text colour together, so a section can never end up
 * with dark type on a dark ground.
 */
const SECTION_TONES = {
  bone: 'bg-bone-50 text-ink-950',
  white: 'bg-white text-ink-950',
  sand: 'bg-bone-100 text-ink-950',
  ink: 'bg-ink-950 text-white'
};

export const Section = ({ children, tone = 'bone', className = '', id }) => (
  <section
    id={id}
    className={`relative overflow-hidden py-20 sm:py-24 lg:py-28 ${SECTION_TONES[tone]} ${className}`}
  >
    {children}
  </section>
);

/** Hairline rule in the ink palette. Separates bands without a colour change. */
export const Rule = ({ tone = 'light', className = '' }) => (
  <hr
    aria-hidden="true"
    className={`border-0 h-px ${tone === 'dark' ? 'bg-white/10' : 'bg-ink-950/10'} ${className}`}
  />
);

/* -------------------------------------------------------------- typography */

/**
 * Eyebrow — the small tracked label above a heading.
 * Rendered as a bordered tag rather than plain text so it reads as a printed
 * category marker and holds its own against the oversized headlines.
 */
export const Eyebrow = ({ children, tone = 'light', className = '' }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.18em] ${
      tone === 'dark'
        ? 'border-white/20 text-saffron-300'
        : 'border-ink-950/15 text-ink-700'
    } ${className}`}
  >
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 rounded-full bg-saffron-500 animate-pulse-dot"
    />
    {children}
  </span>
);

/**
 * Mark — a saffron highlighter swipe behind a word.
 * The swipe is a background layer (see .lp-mark in LandingPage.css), so the
 * glyphs keep full ink contrast and stay readable.
 */
export const Mark = ({ children, className = '' }) => (
  <span className={`lp-mark ${className}`}>{children}</span>
);

/** Outlined display text — used once per headline for contrast against solid. */
export const Outline = ({ children, className = '' }) => (
  <span
    className={`text-transparent ${className}`}
    style={{ WebkitTextStroke: '1.5px currentColor', color: 'inherit' }}
  >
    {children}
  </span>
);

/**
 * SectionHead — heading block shared by every section.
 * Defaults to left-aligned: a consistent left edge is what makes the page feel
 * like a designed grid rather than a stack of centred cards.
 */
export const SectionHead = ({
  eyebrow,
  title,
  lead,
  tone = 'light',
  align = 'left',
  className = '',
  actions
}) => (
  <div
    className={`flex flex-col gap-6 ${
      align === 'center' ? 'items-center text-center' : 'lg:flex-row lg:items-end lg:justify-between'
    } ${className}`}
  >
    <div className={align === 'center' ? 'max-w-3xl' : 'max-w-2xl'}>
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2
        className={`lp-balance mt-5 font-display text-display-sm font-bold ${
          tone === 'dark' ? 'text-white' : 'text-ink-950'
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`mt-4 max-w-prose text-base leading-relaxed sm:text-lg ${
            tone === 'dark' ? 'text-white/65' : 'text-ink-600'
          } ${align === 'center' ? 'mx-auto' : ''}`}
        >
          {lead}
        </p>
      )}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
);

/* --------------------------------------------------------------- controls */

/**
 * Button — one component for every CTA, so size, focus ring and hover
 * behaviour stay identical everywhere.
 *
 * Hover changes colour and shadow offset only. Nothing scales, so a button
 * never nudges the layout of the row it sits in.
 */
const BUTTON_BASE =
  'group relative inline-flex cursor-pointer items-center justify-center gap-2 font-semibold ' +
  'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const BUTTON_SIZES = {
  sm: 'min-h-[40px] rounded-full px-4 py-2 text-sm',
  md: 'min-h-[46px] rounded-full px-5 py-2.5 text-sm',
  lg: 'min-h-[54px] rounded-full px-7 py-3.5 text-base'
};

const BUTTON_VARIANTS = {
  // The one high-emphasis action. Offset block shadow that collapses on press.
  primary:
    'bg-ink-950 text-white border border-ink-950 shadow-block hover:-translate-x-[2px] ' +
    'hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_#FF9933] active:translate-x-0 ' +
    'active:translate-y-0 active:shadow-block-sm focus-visible:ring-ink-950 focus-visible:ring-offset-bone-50',
  saffron:
    'bg-saffron-500 text-ink-950 border border-ink-950 shadow-block hover:-translate-x-[2px] ' +
    'hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_#0B0C0E] active:translate-x-0 ' +
    'active:translate-y-0 active:shadow-block-sm focus-visible:ring-ink-950 focus-visible:ring-offset-bone-50',
  // Secondary on light grounds.
  outline:
    'border border-ink-950/20 bg-transparent text-ink-950 hover:border-ink-950 hover:bg-ink-950/[0.04] ' +
    'focus-visible:ring-ink-950 focus-visible:ring-offset-bone-50',
  // Primary on the inverted dark bands.
  light:
    'bg-white text-ink-950 border border-white hover:bg-saffron-500 hover:border-saffron-500 ' +
    'focus-visible:ring-white focus-visible:ring-offset-ink-950',
  // Secondary on the inverted dark bands.
  ghostDark:
    'border border-white/25 bg-white/[0.06] text-white hover:border-white/60 hover:bg-white/[0.12] ' +
    'focus-visible:ring-white focus-visible:ring-offset-ink-950'
};

export const Button = ({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}) => (
  <Tag
    className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

/** Arrow that nudges right on parent hover. Decorative only. */
export const ArrowGlyph = ({ className = '' }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 ${className}`}
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* ------------------------------------------------------------------ chrome */

/** Small tag for metadata and trust signals. */
export const Tag = ({ children, tone = 'light', className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${
      tone === 'dark'
        ? 'border-white/20 bg-white/[0.06] text-white/75'
        : 'border-ink-950/15 bg-white text-ink-600'
    } ${className}`}
  >
    {children}
  </span>
);

/**
 * Card — the standard surface. Hard 1px border, generous radius, no blur.
 * `interactive` adds the pointer cursor plus a border and shadow shift; there
 * is deliberately no transform, so a hovered card never reflows its grid.
 */
export const Card = ({
  tone = 'light',
  interactive = false,
  className = '',
  children,
  as: Tag = 'div',
  ...rest
}) => {
  const tones = {
    light: 'border-ink-950/15 bg-white text-ink-700',
    sand: 'border-ink-950/15 bg-bone-100 text-ink-700',
    dark: 'border-white/15 bg-white/[0.04] text-white/70'
  };
  const hover =
    tone === 'dark'
      ? 'hover:border-saffron-500/50 hover:bg-white/[0.08]'
      : 'hover:border-ink-950/40 hover:shadow-block-sm';

  return (
    <Tag
      className={`rounded-3xl border p-6 transition-all duration-200 ${tones[tone]} ${
        interactive ? `cursor-pointer ${hover}` : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
};

/**
 * IconTile — the coloured square holding a section icon.
 * Every tile is the same size so a grid of cards lines up on the baseline.
 */
export const IconTile = ({ icon: Icon, accent = 'saffron', tone = 'light', className = '' }) => {
  const accents = {
    saffron: {
      light: 'border-saffron-500/35 bg-saffron-50 text-saffron-800',
      dark: 'border-saffron-500/30 bg-saffron-500/15 text-saffron-300'
    },
    india: {
      light: 'border-india-600/30 bg-india-50 text-india-700',
      dark: 'border-india-500/30 bg-india-500/15 text-india-300'
    },
    ink: {
      light: 'border-ink-950/15 bg-ink-950 text-white',
      dark: 'border-white/20 bg-white/10 text-white'
    }
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${accents[accent][tone]} ${className}`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
    </span>
  );
};

/* ----------------------------------------------------------------- counter */

/**
 * Counter — counts a number up once, when it scrolls into view.
 *
 * Accepts values like "12,500+" and animates only the numeric part, keeping
 * whatever prefix and suffix were supplied. Renders the final value straight
 * away under reduced motion or when IntersectionObserver is unavailable.
 */
export const Counter = ({ value, className = '', duration = 1400 }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);

  // Memoised: String.match() returns a NEW array on every render. Used as an
  // effect dependency — directly or through derived values — that restarts the
  // effect each animation frame, cancelling the pending frame and pinning the
  // number at zero forever. Parse once per `value`.
  const parsed = useMemo(() => {
    const match = String(value).match(/^([^\d]*)([\d,.]+)(.*)$/);
    if (!match) return { numeric: false, prefix: '', suffix: '', target: 0, decimals: 0 };
    return {
      numeric: true,
      prefix: match[1],
      suffix: match[3],
      target: Number(match[2].replace(/,/g, '')),
      decimals: match[2].includes('.') ? match[2].split('.')[1].length : 0
    };
  }, [value]);

  const { numeric, prefix, suffix, target, decimals } = parsed;

  const [display, setDisplay] = useState(reduce || !numeric ? target : 0);

  useEffect(() => {
    if (reduce || !numeric) {
      setDisplay(target);
      return undefined;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setDisplay(target);
      return undefined;
    }

    let frame;
    let safety;
    let started = false;

    const run = () => {
      // Take the clock from the first animation frame rather than from
      // performance.now(). A rAF callback receives the timestamp of when the
      // frame *began*, which can predate a performance.now() sampled moments
      // earlier — that yields negative progress, flips the sign of the easing
      // exponent, and renders a negative count.
      let start = null;

      const tick = (now) => {
        if (start === null) start = now;
        // Clamped at both ends so progress can never leave [0, 1].
        const progress = Math.min(Math.max((now - start) / duration, 0), 1);
        // easeOutExpo — quick off the mark, settles gently on the final number.
        const eased = progress >= 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setDisplay(target * eased);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);

      // If rAF never runs to completion — a throttled background tab, a
      // headless capture — snap to the real number rather than leaving a stat
      // tile reading zero.
      safety = setTimeout(() => setDisplay(target), duration + 400);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started) {
            started = true;
            run();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (safety) clearTimeout(safety);
    };
  }, [target, duration, reduce, numeric]);

  const formatted = numeric
    ? display.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : value;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ decor */

/** Printed grid texture behind a section. Purely decorative. */
export const GridTexture = ({ tone = 'light', fade = true }) => (
  <div
    aria-hidden="true"
    className={`lp-grid ${tone === 'dark' ? 'lp-grid--dark' : ''} ${fade ? 'lp-grid--fade' : ''}`}
  />
);

/** Film grain over a flat colour field. Purely decorative. */
export const Grain = () => <div aria-hidden="true" className="lp-noise" />;

/**
 * Marquee — an infinite horizontal ticker.
 *
 * The children are rendered twice and the track translates by exactly -50%, so
 * the second copy lands precisely where the first began and the loop is
 * seamless. `aria-hidden` on the duplicate keeps screen readers from hearing
 * every item announced twice.
 */
export const Marquee = ({ children, speed = 'normal', className = '' }) => (
  <div className={`lp-marquee-mask lp-marquee-hover overflow-hidden ${className}`}>
    <div className={`lp-marquee ${speed === 'slow' ? 'animate-marquee-slow' : 'animate-marquee'}`}>
      <div className="lp-marquee__track">{children}</div>
      <div className="lp-marquee__track" aria-hidden="true">
        {children}
      </div>
    </div>
  </div>
);
