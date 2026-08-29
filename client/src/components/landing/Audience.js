// client/src/components/landing/Audience.js
import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AcademicCapIcon,
  BeakerIcon,
  BriefcaseIcon,
  BuildingLibraryIcon,
  BuildingOffice2Icon,
  CheckIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { Card, Container, Counter, Eyebrow, IconTile, Reveal, Section } from './primitives';

/**
 * Per-audience content. The two audiences are kept structurally identical so
 * the toggle can cross-fade one panel instead of swapping the whole route.
 */
export const AUDIENCE = {
  college: {
    key: 'college',
    label: 'Colleges',
    icon: BuildingLibraryIcon,
    accent: 'india',
    heroTitle: 'Complete career solutions for colleges',
    heroSub:
      'Workshops, career guidance, placements and training programs designed for college students — and the placement cells running them.',
    pillars: [
      {
        icon: BriefcaseIcon,
        title: 'Placements & internships',
        desc:
          'Connect with top employers through our network and a streamlined placement portal.'
      },
      {
        icon: WrenchScrewdriverIcon,
        title: 'Industrial workshops',
        desc:
          'Hands-on workshops with industry experts covering current technology and real-world application.'
      },
      {
        icon: LightBulbIcon,
        title: 'Guidance & psychometrics',
        desc:
          'Assessments and personalised counselling so students choose a career path that fits.'
      },
      {
        icon: AcademicCapIcon,
        title: 'Skill training',
        desc: 'Industry-aligned training in tech, soft skills and domain expertise.'
      }
    ],
    whoWeServe: [
      { role: 'TPOs & placement officers', desc: 'Run drives and reach employers without spreadsheets' },
      { role: 'Faculty', desc: 'Track student progress and support career development' },
      { role: 'Students & alumni', desc: 'Find opportunities and build a job-ready profile' }
    ],
    stats: [
      { value: '7,500+', label: 'Active students' },
      { value: '2,000+', label: 'Placements' },
      { value: '50+', label: 'Partner companies' }
    ]
  },

  school: {
    key: 'school',
    label: 'Schools',
    icon: BuildingOffice2Icon,
    accent: 'saffron',
    heroTitle: 'Early career discovery for schools',
    heroSub:
      'Industrial workshops, psychometric testing for counselling, training programs and first internship exposure — pitched at where school students actually are.',
    pillars: [
      {
        icon: WrenchScrewdriverIcon,
        title: 'Industrial workshops',
        desc:
          'Hands-on exposure to real industry tools, workflows and the careers behind them.'
      },
      {
        icon: BeakerIcon,
        title: 'Psychometric tests',
        desc: 'Assessments that give counsellors something concrete to guide a student with.'
      },
      {
        icon: LightBulbIcon,
        title: 'Career guidance',
        desc:
          'Mentorship and counselling to help a student find a direction and plan toward it.'
      },
      {
        icon: AcademicCapIcon,
        title: 'Training programs',
        desc: 'Skill-building across tech, creative arts and soft skills, built for school age.'
      }
    ],
    whoWeServe: [
      { role: 'School administrators', desc: 'Offer a real career development programme' },
      { role: 'Career counsellors', desc: 'Psychometric tools and structured guidance resources' },
      { role: 'Students', desc: 'Discover career paths and build skills early' }
    ],
    stats: [
      { value: '5,000+', label: 'School students' },
      { value: '100+', label: 'Training programs' },
      { value: '300+', label: 'Internships' }
    ]
  }
};

/**
 * Audience — "who we work with", with an in-place toggle.
 *
 * Switching audience cross-fades one panel rather than changing route: it
 * keeps scroll position, and it keeps the other half of the offering exactly
 * one click away instead of hidden behind navigation.
 */
const Audience = ({ audience = 'college', onSelectAudience }) => {
  const reduce = useReducedMotion();
  const active = AUDIENCE[audience] || AUDIENCE.college;
  const accentText = active.accent === 'india' ? 'text-india-700' : 'text-saffron-800';

  return (
    <Section tone="white" id="who-we-work-with">
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>Who we work with</Eyebrow>
            <h2 className="lp-balance mt-5 font-display text-display-sm font-bold text-ink-950">
              Built for every level of education
            </h2>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-600 sm:text-lg">
              From school through university, with programmes matched to where students actually
              are — not a single curriculum stretched to fit everyone.
            </p>
          </div>

          {/* Toggle */}
          <div
            className="inline-flex shrink-0 self-start rounded-full border border-ink-950/15 bg-bone-50 p-1 lg:self-end"
            role="group"
            aria-label="Choose audience"
          >
            {Object.values(AUDIENCE).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelectAudience(key)}
                aria-pressed={audience === key}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 ${
                  audience === key
                    ? 'bg-ink-950 text-white'
                    : 'text-ink-600 hover:text-ink-950'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.key}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            className="mt-12"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              {/* Summary, numbers and roles */}
              <div className="rounded-3xl border border-ink-950/15 bg-bone-50 p-7 sm:p-8">
                <h3 className="font-display text-2xl font-bold text-ink-950">{active.heroTitle}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{active.heroSub}</p>

                <dl className="mt-7 grid grid-cols-3 gap-4 border-y border-ink-950/10 py-6">
                  {active.stats.map(({ value, label }) => (
                    <div key={label}>
                      <dt className="sr-only">{label}</dt>
                      <dd>
                        <span className={`block font-display text-2xl font-bold ${accentText}`}>
                          <Counter value={value} />
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase leading-tight tracking-wider text-ink-500">
                          {label}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>

                <ul className="mt-7 space-y-4">
                  {active.whoWeServe.map(({ role, desc }) => (
                    <li key={role} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          active.accent === 'india' ? 'bg-india-600' : 'bg-saffron-500'
                        }`}
                      >
                        <CheckIcon
                          className={`h-3 w-3 ${
                            active.accent === 'india' ? 'text-white' : 'text-ink-950'
                          }`}
                          strokeWidth={3}
                        />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink-950">{role}</p>
                        <p className="mt-0.5 text-sm text-ink-600">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* This audience's pillars */}
              <div className="grid gap-4 sm:grid-cols-2">
                {active.pillars.map(({ icon, title, desc }, index) => (
                  <Reveal key={title} delay={index * 0.05}>
                    <Card interactive className="h-full">
                      <IconTile icon={icon} accent={index % 2 === 0 ? active.accent : 'ink'} />
                      <h4 className="mt-5 font-display text-base font-bold text-ink-950">{title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-ink-600">{desc}</p>
                    </Card>
                  </Reveal>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </Container>
    </Section>
  );
};

export default Audience;
