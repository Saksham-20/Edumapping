// client/src/components/landing/Closers.js
// The two blocks that close the home page: the impact numbers and the final CTA.
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowGlyph,
  Button,
  Container,
  Counter,
  Eyebrow,
  Grain,
  GridTexture,
  Reveal,
  Section
} from './primitives';

const IMPACT = [
  { value: '12,500+', label: 'Active students' },
  { value: '100+', label: 'Partner institutions' },
  { value: '2,300+', label: 'Successful placements' },
  { value: '500+', label: 'Training programs' }
];

/**
 * Impact — the numbers, at editorial scale on the light canvas.
 *
 * Set large and left-aligned in a rule-separated row rather than boxed in
 * cards: at this size the figures are the design, and a border around each one
 * only makes them smaller.
 */
export const Impact = () => (
  <Section tone="sand" id="impact">
    <GridTexture />
    <Container className="relative">
      <Eyebrow>Our impact</Eyebrow>
      <h2 className="lp-balance mt-5 max-w-2xl font-display text-display-sm font-bold text-ink-950">
        Measured by careers, not clicks
      </h2>

      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-ink-950/15 pt-10 lg:grid-cols-4">
        {IMPACT.map(({ value, label }, index) => (
          <Reveal key={label} delay={index * 0.06}>
            <div>
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-display text-display-sm font-bold leading-none text-ink-950">
                  <Counter value={value} />
                </span>
                <span className="mt-3 block font-mono text-[11px] uppercase tracking-wider text-ink-500">
                  {label}
                </span>
              </dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </Container>
  </Section>
);

/**
 * CtaBand — the closing call to action.
 * The saffron field runs at full strength here and nowhere else, so it lands
 * as a deliberate brand moment rather than background colour.
 */
export const CtaBand = ({ onNavigate }) => (
  <section className="relative overflow-hidden bg-saffron-500 py-20 sm:py-24">
    <GridTexture />
    <Grain />

    <Container className="relative">
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="lp-balance font-display text-display font-bold text-ink-950">
            Ready to transform your institution?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-950/75 sm:text-lg">
            Join the schools, colleges and employers already running workshops, guidance, training
            and placements on EduMapping.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button as={Link} to="/register" variant="primary" size="lg">
              Get started
              <ArrowGlyph />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onNavigate('contact')}
              className="border-ink-950/30 hover:bg-ink-950/10"
            >
              Talk to us
            </Button>
          </div>
        </div>
      </Reveal>
    </Container>
  </section>
);
