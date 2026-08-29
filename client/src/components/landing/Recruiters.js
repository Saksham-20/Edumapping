// client/src/components/landing/Recruiters.js
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  FunnelIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline';
import {
  ArrowGlyph,
  Button,
  Card,
  Container,
  Counter,
  Eyebrow,
  Grain,
  GridTexture,
  IconTile,
  Reveal
} from './primitives';

const FEATURES = [
  {
    icon: FunnelIcon,
    title: 'Target the right talent',
    desc:
      'Reach pre-verified students from partner schools and colleges. Filter by region, state, city, year of study and stream, so you only ever see candidates who match the role.'
  },
  {
    icon: BriefcaseIcon,
    title: 'Post jobs, manage applications',
    desc:
      'Rich listings with requirements, skills, salary range, work mode and deadlines. Every application lands in one dashboard — shortlist, track status and move candidates in bulk.'
  },
  {
    icon: IdentificationIcon,
    title: 'Full candidate visibility',
    desc:
      'Course, branch, CGPA, year, graduation and skills on every profile, resumes one click away, and the pipeline from applied to selected visible at a glance.'
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Direct line to TPOs',
    desc:
      'Coordinate drives with placement officers in the platform. Schedule events, share details and run campus hiring without an email thread.'
  },
  {
    icon: CalendarDaysIcon,
    title: 'Events & campus engagement',
    desc:
      'Host workshops, info sessions and recruitment events with virtual links and shared calendars, and build your employer brand where students already are.'
  },
  {
    icon: ArrowTrendingUpIcon,
    title: 'Real-time hiring insights',
    desc:
      'Total and active jobs, applications, shortlists, job views and conversion rate — so you can see what is working and hire faster next time.'
  }
];

const STEPS = [
  {
    n: '01',
    title: 'Register & get verified',
    desc:
      'Sign up, add your company details and complete admin verification. Once approved, the recruiter dashboard opens up.'
  },
  {
    n: '02',
    title: 'Get access to institutions',
    desc:
      'Get matched with partner institutions, then narrow by region, state, city, year and stream so you only see the talent that fits.'
  },
  {
    n: '03',
    title: 'Post jobs & hire',
    desc:
      'Post roles with salary and eligibility, shortlist candidates, manage applications in bulk and run drives with TPOs — from one dashboard.'
  }
];

const METRICS = [
  { value: '50+', label: 'Partner companies' },
  { value: '12,500+', label: 'Students reached' },
  { value: '100+', label: 'Partner institutions' }
];

/**
 * Recruiters — the employer pitch, on the inverted ink band.
 *
 * The colour inversion is doing structural work: it splits the page into an
 * institution-facing half and an employer-facing half, so a visitor can tell
 * at a glance which part of the page is addressed to them.
 */
const Recruiters = () => (
  <section className="relative overflow-hidden bg-ink-950 py-20 sm:py-24 lg:py-28" id="recruiters">
    <GridTexture tone="dark" />
    <Grain />

    <Container className="relative">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Eyebrow tone="dark">For recruiters & employers</Eyebrow>
          <h2 className="lp-balance mt-5 font-display text-display-sm font-bold text-white">
            Hire from campus, without the chaos
          </h2>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-white/65 sm:text-lg">
            Pre-verified candidates, structured applications and a direct line to placement
            officers — so campus hiring stops living in spreadsheets and inboxes.
          </p>
        </div>
        <Button as={Link} to="/register" variant="light" size="md" className="shrink-0">
          Start hiring
          <ArrowGlyph />
        </Button>
      </div>

      {/* Feature grid */}
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon, title, desc }, index) => (
          <Reveal key={title} delay={index * 0.05}>
            <Card tone="dark" interactive className="h-full">
              <IconTile icon={icon} accent={index % 2 === 0 ? 'saffron' : 'india'} tone="dark" />
              <h3 className="mt-5 font-display text-base font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{desc}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* How it works — oversized numerals carry the sequence, not arrows. */}
      <div className="mt-20">
        <h3 className="font-display text-xl font-bold text-white sm:text-2xl">
          How it works for recruiters
        </h3>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ n, title, desc }, index) => (
            <Reveal key={n} delay={index * 0.08}>
              <li className="relative h-full overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-7">
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -top-4 font-display text-[5.5rem] font-bold leading-none text-white/[0.06]"
                >
                  {n}
                </span>
                <span className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-saffron-400">
                  Step {n}
                </span>
                <h4 className="relative mt-3 font-display text-lg font-bold text-white">{title}</h4>
                <p className="relative mt-2 text-sm leading-relaxed text-white/60">{desc}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>

      {/* Metrics */}
      <Reveal className="mt-14">
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/15 bg-white/10 sm:grid-cols-3">
          {METRICS.map(({ value, label }) => (
            <div key={label} className="bg-ink-950 px-7 py-8">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-display text-3xl font-bold text-white sm:text-4xl">
                  <Counter value={value} />
                </span>
                <span className="mt-2 block font-mono text-[10px] uppercase tracking-wider text-white/55">
                  {label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Container>
  </section>
);

export default Recruiters;
