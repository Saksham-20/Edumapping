// client/src/components/landing/InnerPages.js
// The Features / About / Connect pages that share the landing chrome.
import React, { useState } from 'react';
import {
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  BoltIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  EyeIcon,
  HeartIcon,
  LightBulbIcon,
  PhoneIcon,
  PresentationChartLineIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrophyIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import {
  Button,
  Card,
  Container,
  Counter,
  Eyebrow,
  Grain,
  GridTexture,
  IconTile,
  Mark,
  Reveal,
  Section
} from './primitives';

/* ------------------------------------------------------------- page header */

/**
 * Shared masthead for the inner pages.
 * Left-aligned to match the home page's grid rather than centring, so moving
 * between pages doesn't shift the eye to a different reading position.
 */
const PageHeader = ({ eyebrow, title, highlight, lead }) => (
  <section className="relative overflow-hidden bg-bone-50 pb-14 pt-32 sm:pb-16 sm:pt-36">
    <GridTexture />
    <Grain />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-32 -top-24 h-[380px] w-[380px] rounded-full opacity-50 blur-3xl"
      style={{ background: 'radial-gradient(circle, rgba(255,153,51,.28) 0%, rgba(255,153,51,0) 70%)' }}
    />
    <Container className="relative">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="lp-balance mt-6 max-w-4xl font-display text-display font-bold text-ink-950">
        {title} {highlight && <Mark>{highlight}</Mark>}
      </h1>
      {lead && (
        <p className="mt-6 max-w-prose text-base leading-relaxed text-ink-600 sm:text-lg">{lead}</p>
      )}
    </Container>
  </section>
);

/* ----------------------------------------------------------------- features */

const COLLEGE_FEATURES = [
  {
    icon: ChartBarIcon,
    title: 'Advanced analytics',
    desc: 'Real-time insight into placement trends, student performance and recruiter engagement.'
  },
  {
    icon: BriefcaseIcon,
    title: 'Recruiter connect',
    desc:
      'Target talent by institution, region, year and stream. Post jobs, manage applications, read resumes and coordinate drives with TPOs — all in one place.'
  },
  {
    icon: DocumentTextIcon,
    title: 'Resume builder',
    desc: 'Guided builder that turns a student profile into an ATS-friendly professional resume.'
  },
  {
    icon: ClipboardDocumentCheckIcon,
    title: 'Skill assessment',
    desc: 'Integrated assessments to measure and improve student employability.'
  },
  {
    icon: PresentationChartLineIcon,
    title: 'Drive management',
    desc: 'End-to-end placement drives, from scheduling through to offer letter generation.'
  },
  {
    icon: DevicePhoneMobileIcon,
    title: 'Mobile ready',
    desc: 'Fully responsive, so the features that matter stay reachable on any device.'
  }
];

const SCHOOL_FEATURES = [
  {
    icon: AcademicCapIcon,
    title: 'Training programs',
    desc: 'Skill-building across tech, creative arts and soft skills, designed for school students.'
  },
  {
    icon: BriefcaseIcon,
    title: 'Internship portal',
    desc: 'Find and apply for internships with companies open to school-age talent.'
  },
  {
    icon: PuzzlePieceIcon,
    title: 'Portfolio builder',
    desc: 'A professional portfolio of projects, achievements and skills.'
  },
  {
    icon: WrenchScrewdriverIcon,
    title: 'Industrial workshops',
    desc: 'Hands-on exposure to real industry tools, workflows and career paths.'
  },
  {
    icon: LightBulbIcon,
    title: 'Career guidance',
    desc: 'Mentorship and guidance to find a direction and plan a route toward it.'
  },
  {
    icon: BeakerIcon,
    title: 'Psychometric career tests',
    desc: 'Assessments that give counselling something concrete to work from.'
  },
  {
    icon: TrophyIcon,
    title: 'Achievement tracking',
    desc: 'Accomplishments, certificates and milestones tracked in one place.'
  },
  {
    icon: DevicePhoneMobileIcon,
    title: 'Mobile ready',
    desc: 'Every feature on any device. Learn and grow on the go.'
  }
];

export const FeaturesPage = ({ audience = 'college' }) => {
  const isSchool = audience === 'school';
  const features = isSchool ? SCHOOL_FEATURES : COLLEGE_FEATURES;

  return (
    <>
      <PageHeader
        eyebrow={isSchool ? 'For schools' : 'For colleges'}
        title="Everything you need,"
        highlight="in one platform"
        lead={
          isSchool
            ? 'Workshops, psychometrics, training and early internships — built for school students and the counsellors guiding them.'
            : 'Placements, analytics, assessments and drive management — the full toolkit for placement cells and the students they serve.'
        }
      />

      <Section tone="white">
        <Container>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon, title, desc }, index) => (
              <Reveal key={title} delay={index * 0.04}>
                <Card interactive className="h-full">
                  <IconTile
                    icon={icon}
                    accent={index % 3 === 0 ? 'india' : index % 3 === 1 ? 'saffron' : 'ink'}
                  />
                  <h3 className="mt-5 font-display text-base font-bold text-ink-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{desc}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
};

/* -------------------------------------------------------------------- about */

const VALUES = [
  {
    icon: SparklesIcon,
    title: 'Innovation',
    desc: 'Constantly pushing at the hard problems in education and employment.'
  },
  {
    icon: ScaleIcon,
    title: 'Integrity',
    desc: 'Trust built through transparency and honest practice with every partner.'
  },
  {
    icon: ArrowTrendingUpIcon,
    title: 'Impact',
    desc: 'Success measured by the careers we help launch, not the traffic we attract.'
  },
  {
    icon: BoltIcon,
    title: 'Empowerment',
    desc: 'Giving students the tools, skills and confidence to go after what they want.'
  }
];

const WHAT_WE_DO = [
  {
    icon: WrenchScrewdriverIcon,
    title: 'Industrial workshops',
    desc:
      'Hands-on workshops with industry experts covering current technology and its real-world application, for both school and college students.'
  },
  {
    icon: LightBulbIcon,
    title: 'Career guidance',
    desc:
      'Psychometric assessment and personalised counselling to help students choose the right path, from school through college.'
  },
  {
    icon: BriefcaseIcon,
    title: 'Placements & internships',
    desc:
      'An employer network that connects students to real opportunity — full placement support for colleges, early internships for schools.'
  },
  {
    icon: AcademicCapIcon,
    title: 'Training programs',
    desc:
      'Industry-aligned training in tech, soft skills and domain expertise, to make students job-ready at every level.'
  }
];

const ABOUT_STATS = [
  { value: '12,500+', label: 'Active students' },
  { value: '100+', label: 'Partner institutions' },
  { value: '2,300+', label: 'Successful placements' },
  { value: '500+', label: 'Training programs' }
];

export const AboutPage = () => (
  <>
    <PageHeader
      eyebrow="About us"
      title="We partner with schools and colleges to build"
      highlight="job-ready graduates"
      lead="EduMapping provides workshops, career guidance, placements and training programs — closing the gap between what students learn and what employers need."
    />

    {/* Mission & vision */}
    <Section tone="white">
      <Container>
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-ink-950 bg-ink-950 p-8 text-white">
              <IconTile icon={RocketLaunchIcon} accent="saffron" tone="dark" />
              <h2 className="mt-6 font-display text-2xl font-bold text-white">Our mission</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                To democratise access to career opportunity by bridging education and employment.
                We empower students at every level — school through college — with essential
                skills, training programs, industrial workshops, career guidance and placement
                opportunities, backed by technology and real data.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="h-full rounded-3xl border border-ink-950/15 bg-bone-50 p-8">
              <IconTile icon={EyeIcon} accent="india" />
              <h2 className="mt-6 font-display text-2xl font-bold text-ink-950">Our vision</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-600">
                To be the standard for career development and campus placements — a world where
                every student, in school or college, gets the chance to discover their potential,
                build real skills and find work that matches their talents and ambition.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>

    {/* What we do */}
    <Section tone="bone">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>What we do</Eyebrow>
          <h2 className="lp-balance mt-5 font-display text-display-sm font-bold text-ink-950">
            Comprehensive solutions, end to end
          </h2>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-600 sm:text-lg">
            For educational institutions and the students inside them.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {WHAT_WE_DO.map(({ icon, title, desc }, index) => (
            <Reveal key={title} delay={index * 0.05}>
              <Card interactive className="flex h-full gap-5">
                <IconTile icon={icon} accent={index % 2 === 0 ? 'saffron' : 'india'} />
                <div>
                  <h3 className="font-display text-base font-bold text-ink-950">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{desc}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>

    {/* Impact */}
    <Section tone="sand">
      <GridTexture />
      <Container className="relative">
        <Eyebrow>Our impact</Eyebrow>
        <h2 className="lp-balance mt-5 max-w-2xl font-display text-display-sm font-bold text-ink-950">
          Making a difference across institutions
        </h2>
        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-ink-950/15 pt-10 lg:grid-cols-4">
          {ABOUT_STATS.map(({ value, label }, index) => (
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

    {/* Values */}
    <Section tone="white">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Our core values</Eyebrow>
          <h2 className="lp-balance mt-5 font-display text-display-sm font-bold text-ink-950">
            What we hold ourselves to
          </h2>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon, title, desc }, index) => (
            <Reveal key={title} delay={index * 0.05}>
              <Card interactive className="h-full">
                <IconTile icon={icon} accent={index % 2 === 0 ? 'saffron' : 'india'} />
                <h3 className="mt-5 font-display text-base font-bold text-ink-950">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  </>
);

/* ------------------------------------------------------------------ contact */

const CONTACT_CHANNELS = [
  {
    icon: EnvelopeIcon,
    label: 'Email us',
    lines: ['hello@edumapping.com', 'support@edumapping.com'],
    hrefs: ['mailto:hello@edumapping.com', 'mailto:support@edumapping.com']
  },
  {
    icon: PhoneIcon,
    label: 'Call us',
    lines: ['+91 91049 91059'],
    hrefs: ['tel:+919104991059']
  },
  {
    icon: ClockIcon,
    label: 'Office hours',
    lines: ['Mon – Fri, 9am – 6pm IST']
  }
];

const TRUST_POINTS = [
  { icon: ShieldCheckIcon, text: 'Your details are only used to reply to your enquiry.' },
  { icon: UserGroupIcon, text: 'Replies typically within one working day.' },
  { icon: HeartIcon, text: 'Schools, colleges and employers all welcome.' }
];

export const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus(null);

    try {
      // Posts to the real /api/contact endpoint, which emails the team.
      await api.post('/contact', form);
      setStatus({
        type: 'success',
        message: "Thanks — your message is on its way. We'll be in touch shortly."
      });
      setForm({ name: '', email: '', message: '' });
    } catch (error) {
      // If the API is unreachable, hand off to the visitor's mail client rather
      // than losing the message entirely.
      const subject = `Contact form enquiry from ${form.name}`;
      const body = `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`;
      window.location.href = `mailto:hello@edumapping.com?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      setStatus({
        type: 'info',
        message: "We couldn't reach the server, so we've opened your email app instead."
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full rounded-2xl border border-ink-950/20 bg-white px-4 py-3 text-sm text-ink-950 ' +
    'placeholder:text-ink-500 transition-colors duration-200 focus:border-ink-950 ' +
    'focus:outline-none focus:ring-2 focus:ring-ink-950/20';

  return (
    <>
      <PageHeader
        eyebrow="Connect with us"
        title="Let's talk about your"
        highlight="institution"
        lead="Whether you run a placement cell, a school career programme or a hiring team — tell us what you need and we'll show you how EduMapping fits."
      />

      <Section tone="white">
        <Container>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            {/* Channels */}
            <div className="space-y-4">
              {CONTACT_CHANNELS.map(({ icon, label, lines, hrefs }, i) => (
                <Reveal key={label} delay={i * 0.06}>
                  <Card className="flex gap-5">
                    <IconTile icon={icon} accent={i === 0 ? 'saffron' : i === 1 ? 'india' : 'ink'} />
                    <div className="min-w-0">
                      <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                        {label}
                      </h3>
                      <ul className="mt-2 space-y-1">
                        {lines.map((line, idx) => (
                          <li key={line} className="text-sm">
                            {hrefs?.[idx] ? (
                              <a
                                href={hrefs[idx]}
                                className="lp-link cursor-pointer break-words font-semibold text-ink-950 transition-colors duration-200 hover:text-saffron-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                              >
                                {line}
                              </a>
                            ) : (
                              <span className="font-semibold text-ink-950">{line}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                </Reveal>
              ))}

              <Reveal delay={0.2}>
                <ul className="space-y-3 rounded-3xl border border-ink-950/15 bg-bone-100 p-6">
                  {TRUST_POINTS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-3 text-sm text-ink-600">
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-india-600"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {text}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Form */}
            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-ink-950 bg-bone-50 p-7 shadow-block sm:p-8">
                <h2 className="font-display text-2xl font-bold text-ink-950">Send us a message</h2>
                <p className="mt-2 text-sm text-ink-600">
                  Fill this in and the team will get back to you.
                </p>

                <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                  <div>
                    <label
                      htmlFor="lp-contact-name"
                      className="mb-1.5 block text-sm font-semibold text-ink-950"
                    >
                      Your name
                    </label>
                    <input
                      id="lp-contact-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={form.name}
                      onChange={update('name')}
                      placeholder="Your full name"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lp-contact-email"
                      className="mb-1.5 block text-sm font-semibold text-ink-950"
                    >
                      Your email
                    </label>
                    <input
                      id="lp-contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={update('email')}
                      placeholder="you@example.com"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="lp-contact-message"
                      className="mb-1.5 block text-sm font-semibold text-ink-950"
                    >
                      Message
                    </label>
                    <textarea
                      id="lp-contact-message"
                      name="message"
                      rows="5"
                      required
                      value={form.message}
                      onChange={update('message')}
                      placeholder="How can we help?"
                      className={`${fieldClass} resize-y`}
                    />
                  </div>

                  {status && (
                    <p
                      role="status"
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        status.type === 'success'
                          ? 'border-india-600/30 bg-india-50 text-india-800'
                          : status.type === 'info'
                          ? 'border-saffron-500/40 bg-saffron-50 text-saffron-800'
                          : 'border-red-300 bg-red-50 text-red-700'
                      }`}
                    >
                      {status.message}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="saffron"
                    size="lg"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Send message'}
                  </Button>
                </form>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
};
