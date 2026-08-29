// client/src/components/landing/Hero.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PlayCircleIcon } from '@heroicons/react/24/outline';
import ProductPreview from './ProductPreview';
import {
  ArrowGlyph,
  Button,
  Container,
  Counter,
  Eyebrow,
  Grain,
  GridTexture,
  Mark,
  fadeUp,
  stagger
} from './primitives';

// The rotating tail of the headline. Every entry is a real outcome the
// platform delivers, so the motion carries meaning rather than decoration.
const ROTATING = ['career.', 'first offer.', 'internship.', 'campus drive.'];

const STATS = [
  { value: '12,500+', label: 'Active students' },
  { value: '100+', label: 'Partner institutions' },
  { value: '2,300+', label: 'Placements made' }
];

/**
 * Hero — the first screen.
 *
 * Asymmetric split: an oversized editorial headline and the CTAs on the left,
 * a live-looking recruiter pipeline on the right. A visitor should be able to
 * tell what the product *is* without reading a paragraph.
 */
const Hero = ({ onSelectAudience, loginPath = '/login/college' }) => {
  const reduce = useReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);

  // Cycle the headline's last word. Skipped entirely under reduced motion —
  // the first word simply stays put.
  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => {
      setWordIndex((i) => (i + 1) % ROTATING.length);
    }, 2600);
    return () => clearInterval(id);
  }, [reduce]);

  const motionProps = reduce ? {} : { initial: 'hidden', animate: 'visible', variants: stagger };
  const itemProps = reduce ? {} : { variants: fadeUp };

  return (
    <section className="relative overflow-hidden bg-bone-50 pb-14 pt-28 sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-32">
      <GridTexture />
      <Grain />

      {/* Soft saffron wash in the top-right corner. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-[460px] w-[460px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,153,51,.28) 0%, rgba(255,153,51,0) 70%)' }}
      />

      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-14">
          {/* ------------------------------------------------------------ copy */}
          <motion.div {...motionProps}>
            <motion.div {...itemProps}>
              <Eyebrow>Workshops · Guidance · Training · Placements</Eyebrow>
            </motion.div>

            <motion.h1
              className="lp-balance mt-6 font-display text-display font-bold text-ink-950"
              {...itemProps}
            >
              From classroom
              <br />
              to{' '}
              {/* The grid stack reserves the width of the longest word, so the
                  headline never reflows as the word swaps. */}
              <span className="lp-rotator text-left">
                {ROTATING.map((word) => (
                  <span key={word} className="invisible" aria-hidden="true">
                    {word}
                  </span>
                ))}
                {reduce ? (
                  <Mark>{ROTATING[0]}</Mark>
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={ROTATING[wordIndex]}
                      initial={{ opacity: 0, y: '0.25em' }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: '-0.25em' }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Mark>{ROTATING[wordIndex]}</Mark>
                    </motion.span>
                  </AnimatePresence>
                )}
              </span>
            </motion.h1>

            <motion.p
              className="mt-6 max-w-prose text-base leading-relaxed text-ink-600 sm:text-lg"
              {...itemProps}
            >
              EduMapping runs the whole journey from one place — industrial workshops, career
              guidance, skill training and placements — for schools, colleges and the employers
              hiring from them.
            </motion.p>

            {/* CTAs */}
            <motion.div className="mt-8 flex flex-wrap gap-3" {...itemProps}>
              <Button variant="primary" size="lg" onClick={() => onSelectAudience('college')}>
                Explore for colleges
                <ArrowGlyph />
              </Button>
              <Button variant="outline" size="lg" onClick={() => onSelectAudience('school')}>
                For schools
              </Button>
              <Button
                as={Link}
                to={loginPath}
                state={{ from: { pathname: '/dashboard' } }}
                variant="outline"
                size="lg"
                className="border-transparent hover:border-ink-950/20"
              >
                <PlayCircleIcon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                See the demo
              </Button>
            </motion.div>

            {/* Stats — the proof, immediately under the CTAs where it does work. */}
            <motion.dl
              className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-ink-950/10 pt-6"
              {...itemProps}
            >
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-bold text-ink-950 sm:text-3xl">
                      <Counter value={value} />
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase leading-tight tracking-wider text-ink-500">
                      {label}
                    </span>
                  </dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* --------------------------------------------------------- preview */}
          <motion.div
            className="flex justify-center lg:justify-end"
            initial={reduce ? false : { opacity: 0, y: 28 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProductPreview />
          </motion.div>
        </div>
      </Container>
    </section>
  );
};

export default Hero;
