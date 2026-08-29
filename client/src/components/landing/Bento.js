// client/src/components/landing/Bento.js
import React from 'react';
import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  LightBulbIcon,
  VideoCameraIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import {
  ArrowGlyph,
  Button,
  Card,
  Container,
  Counter,
  Eyebrow,
  IconTile,
  Reveal,
  Section
} from './primitives';

// The four service pillars plus the two platform capabilities that make them
// work. `span` drives the bento layout — the placement tile is the widest
// because it is the outcome everything else feeds into.
const TILES = [
  {
    icon: BriefcaseIcon,
    accent: 'india',
    title: 'Placements & internships',
    desc:
      'A verified employer network and a placement portal that tracks every application from applied through to offer — full placement support for colleges, early internship exposure for schools.',
    points: ['Verified employers', 'Application tracking', 'Drive coordination'],
    span: 'sm:col-span-2 lg:col-span-3 lg:row-span-2',
    feature: true
  },
  {
    icon: WrenchScrewdriverIcon,
    accent: 'saffron',
    title: 'Industrial workshops',
    desc: 'Hands-on sessions with industry experts on the tools students will actually use.',
    span: 'lg:col-span-3'
  },
  {
    icon: LightBulbIcon,
    accent: 'ink',
    title: 'Career guidance',
    desc:
      'Psychometric assessment and one-to-one counselling, so a student picks a path that fits them.',
    span: 'lg:col-span-3'
  },
  {
    icon: AcademicCapIcon,
    accent: 'saffron',
    title: 'Training programs',
    desc: 'Industry-aligned tracks across tech, domain and soft skills, with progress tracked per student.',
    span: 'sm:col-span-2 lg:col-span-4'
  },
  {
    icon: VideoCameraIcon,
    accent: 'india',
    title: 'Live classes, built in',
    desc: 'Teach and screen-share in the browser. No third-party meeting links to chase.',
    span: 'lg:col-span-2'
  }
];

/**
 * Bento — "what we do", as an asymmetric grid.
 *
 * A uniform four-up grid gives every service equal weight, which is wrong:
 * placements are the outcome institutions buy. The wide feature tile says so
 * without a word of extra copy.
 */
const Bento = () => (
  <Section tone="bone" id="what-we-do">
    <Container className="relative">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>What we do</Eyebrow>
          <h2 className="lp-balance mt-5 font-display text-display-sm font-bold text-ink-950">
            One platform for the whole journey
          </h2>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-600 sm:text-lg">
            Everything between a classroom and a signed offer letter, run from a single place —
            for schools, colleges and the employers hiring from them.
          </p>
        </div>
        <Button as={Link} to="/register" variant="outline" size="md" className="shrink-0">
          Start free
          <ArrowGlyph />
        </Button>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {TILES.map(({ icon, accent, title, desc, points, span, feature }, index) => (
          <Reveal key={title} className={span} delay={index * 0.05}>
            {feature ? (
              // The one inverted tile on the page's light half. It anchors the
              // grid and keeps the section from reading as a flat row of cards.
              <div className="flex h-full flex-col justify-between gap-8 rounded-3xl border border-ink-950 bg-ink-950 p-7 text-white sm:p-8">
                <div>
                  <IconTile icon={icon} accent="saffron" tone="dark" />
                  <h3 className="mt-6 font-display text-2xl font-bold text-white sm:text-3xl">
                    {title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">
                    {desc}
                  </p>
                </div>

                <div>
                  <ul className="flex flex-wrap gap-2">
                    {points.map((point) => (
                      <li
                        key={point}
                        className="rounded-full border border-white/20 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-white/70"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-7 flex items-end gap-8 border-t border-white/10 pt-6">
                    <div>
                      <dt className="sr-only">Placements made</dt>
                      <dd>
                        <span className="block font-display text-3xl font-bold text-saffron-400 sm:text-4xl">
                          <Counter value="2,300+" />
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-white/55">
                          Placements made
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Partner companies</dt>
                      <dd>
                        <span className="block font-display text-3xl font-bold text-white sm:text-4xl">
                          <Counter value="50+" />
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-white/55">
                          Partner companies
                        </span>
                      </dd>
                    </div>
                    <ArrowTrendingUpIcon
                      className="ml-auto hidden h-8 w-8 text-white/20 sm:block"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </dl>
                </div>
              </div>
            ) : (
              <Card interactive className="flex h-full flex-col gap-4">
                <IconTile icon={icon} accent={accent} />
                <div>
                  <h3 className="font-display text-lg font-bold text-ink-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{desc}</p>
                </div>
              </Card>
            )}
          </Reveal>
        ))}
      </div>
    </Container>
  </Section>
);

export default Bento;
