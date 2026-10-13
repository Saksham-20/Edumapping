// client/src/components/landing/Record.js
//
// The home page in the attested-record world. Five movements:
//
//   RecordHero   the navy folder, a sample academic record being verified
//   RecordChain  one record from school guidance to the offer letter
//   RuleCheck    the policy engine, run live on three sample students
//   SeasonLedger who does what, set as a ruled register
//   InspectionReport + RecordClose
//
// Every name, mark and figure on this page is sample data and is labelled as
// such. No customers, counts or testimonials are claimed.
import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import { Button, ArrowGlyph } from './primitives';
import { CertificateFrame, Guilloche, GuillocheBand, MicroRule, Stamp } from '../brand';

const cx = (...p) => p.filter(Boolean).join(' ');

const Wrap = ({ children, className = '' }) => (
  <div className={cx('mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12', className)}>
    {children}
  </div>
);

/* ===================================================================== hero */

const HERO_FIELDS = [
  { label: 'CGPA', value: '8.47', unit: '/ 10' },
  { label: 'Class X', value: '92.4', unit: '%' },
  { label: 'Class XII', value: '88.0', unit: '%' },
  { label: 'Active backlogs', value: '0', unit: '' },
  { label: 'Marksheets', value: '8 of 8', unit: 'semesters' },
  { label: 'Placement tier', value: 'Dream', unit: '8–15 LPA' }
];

/** The signature of the officer who checked the record: one drawn stroke. */
const Signature = () => (
  <svg viewBox="0 0 160 40" className="ink-draw h-9 w-36" aria-hidden="true">
    <path
      d="M4 28c10-16 18-22 22-14s-8 16-2 12 14-20 20-18-6 18 2 16 10-14 16-12-4 12 4 11 18-9 24-13 10 3 16 1 18-6 30-9"
      fill="none"
      stroke="#2E215B"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      style={{ animationDelay: '1.35s', animationDuration: '1.1s' }}
    />
  </svg>
);

const HeroRecord = () => {
  const reduce = useReducedMotion();
  return (
    <figure className="relative">
      <CertificateFrame serial="No. EM/26/CSE/0031" className="shadow-folder">
        <div className="px-6 pb-7 pt-10 sm:px-9 sm:pb-9 sm:pt-8">
          {/* Letterhead */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-10 w-auto" />
              <div className="leading-tight">
                <p className="font-display text-[15px] font-bold text-ink-950">EduMapping</p>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-600">
                  Statement of academic record
                </p>
              </div>
            </div>
            <Guilloche size={88} draw={!reduce} tone="light" className="-mr-1 -mt-2 shrink-0" />
          </div>

          <MicroRule className="mt-4" />

          {/* Holder */}
          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <p className="font-display text-[1.9rem] font-extrabold leading-none tracking-[-0.02em] text-ink-950 sm:text-[2.3rem]">
                Ananya Iyer
              </p>
              <p className="mt-2 text-sm text-ink-600">
                B.Tech · Computer Science Engineering · Batch of 2026
              </p>
            </div>
            <p className="font-mono text-sm text-ink-700">
              Roll <span className="font-semibold text-ink-950">22CSE031</span>
            </p>
          </div>

          {/* Marks: fill in roll-number order, one field at a time. */}
          <dl className="mt-6 grid grid-cols-2 border-y border-ink-950/15 sm:grid-cols-3">
            {HERO_FIELDS.map((f, i) => (
              <motion.div
                key={f.label}
                className={cx(
                  'border-ink-950/10 px-1 py-4',
                  i % 2 === 1 && 'border-l sm:border-l-0',
                  i % 3 !== 0 && 'sm:border-l',
                  i >= 2 && 'border-t sm:border-t-0',
                  i >= 3 && 'sm:border-t'
                )}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <dt className="px-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                  {f.label}
                </dt>
                <dd className="mt-1 px-3 font-display text-[1.65rem] font-bold leading-none tabular-nums text-ink-950">
                  {f.value}
                  {f.unit && (
                    <span
                      className={cx(
                        'whitespace-nowrap font-sans text-xs font-medium text-ink-500',
                        // Long units drop under the figure on phones; "%" stays beside it.
                        f.unit.length > 4 ? 'mt-1 block sm:ml-1.5 sm:mt-0 sm:inline' : 'ml-1.5'
                      )}
                    >
                      {f.unit}
                    </span>
                  )}
                </dd>
              </motion.div>
            ))}
          </dl>

          {/* Attestation */}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <Signature />
              <p className="mt-1 border-t border-ink-950/25 pt-1.5 text-xs text-ink-600">
                Checked by the Training &amp; Placement Officer
              </p>
            </div>
            <div className="relative -mb-2 ml-auto shrink-0 sm:-mr-3">
              <Stamp press={!reduce} delay={1.8} size="fluid" sub="Placement Cell · 13 Oct 2026">
                Verified · Locked
              </Stamp>
            </div>
          </div>
        </div>
      </CertificateFrame>
      <figcaption className="mt-3 text-xs text-bone-300/70">
        Sample record. Names and marks are illustrative.
      </figcaption>
    </figure>
  );
};

export const RecordHero = ({ onNavigate, loginPath, onSelectAudience }) => {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden bg-ink-950 pb-16 pt-28 text-bone-50 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-36">
      {/* The rosette watermark behind the record, engraved once on load. */}
      <Guilloche
        size={980}
        tone="dark"
        draw={!reduce}
        opacity={0.16}
        className="pointer-events-none absolute -right-60 top-1/2 hidden -translate-y-1/2 lg:block"
      />
      <Wrap className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <h1 className="font-display text-[clamp(2.9rem,1.5rem+4.6vw,5.6rem)] font-extrabold leading-[0.94] tracking-[-0.03em]">
              From classroom
              <br />
              to{' '}
              <span className="relative inline-block">
                career.
                <GuillocheBand
                  tone="dark"
                  height={10}
                  className="absolute -bottom-2 left-0 opacity-90"
                />
              </span>
            </h1>
            <p className="mt-8 max-w-[38ch] text-lg leading-relaxed text-bone-200/85">
              EduMapping runs a college&rsquo;s whole placement season on one verified record,
              from marksheets checked and locked to offer letters the cell has seen.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button variant="saffron" size="lg" onClick={() => onNavigate('contact')}>
                Bring your college on board
                <ArrowGlyph />
              </Button>
              <Button
                as={Link}
                to={loginPath}
                state={{ from: { pathname: '/dashboard' } }}
                variant="ghostDark"
                size="lg"
              >
                Sign in
              </Button>
            </div>
            <button
              type="button"
              onClick={() => onSelectAudience('school')}
              className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 text-left text-sm font-medium text-bone-200 underline decoration-saffron-400/70 underline-offset-[5px] hover:text-bone-50"
            >
              Running a school? The record starts with career guidance
            </button>
          </div>
          <div className="min-w-0 lg:col-span-7 lg:pl-6">
            <HeroRecord />
          </div>
        </div>
      </Wrap>
    </section>
  );
};

/* ==================================================================== chain */

// The ink that names each document's kind, matching the stamp it carries.
const KIND_INK = {
  ink: 'text-ink-800',
  stamp: 'text-stamp-700',
  saffron: 'text-saffron-800',
  india: 'text-india-700'
};

// Every stop is the same paper as the hero record: guilloche edge, serial
// strip, microtext rule. Only the ink naming the kind changes.
const DocShell = ({ kind, number, tone = 'ink', children, className = '' }) => (
  <CertificateFrame compact className={cx('h-full', className)} innerClassName="flex flex-col">
    <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
      <span className={cx('font-display text-[10.5px] font-bold uppercase tracking-[0.12em]', KIND_INK[tone])}>
        {kind}
      </span>
      <span className="font-mono text-[10px] text-ink-500">{number}</span>
    </header>
    <MicroRule className="mx-4" />
    <div className="flex flex-1 flex-col p-4">{children}</div>
  </CertificateFrame>
);

const Line = ({ k, v, mono }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink-950/20 py-1.5 text-[13px]">
    <span className="text-ink-600">{k}</span>
    <span className={cx('text-right font-medium text-ink-950', mono && 'font-mono text-[12px]')}>{v}</span>
  </div>
);

const STOPS = [
  { where: 'At school', what: 'Guidance that points somewhere' },
  { where: 'At college', what: 'A record the cell has checked' },
  { where: 'On drive day', what: 'Every round, on time' },
  { where: 'At the finish', what: 'An offer with proof' }
];

export const RecordChain = () => (
  <section className="bg-bone-50 py-20 sm:py-24 lg:py-32">
    <Wrap>
      <div className="grid gap-8 lg:grid-cols-12">
        <h2 className="text-balance font-display text-[clamp(2.1rem,1.3rem+2.8vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-ink-950 lg:col-span-7">
          One record, from the first counselling session to the offer letter.
        </h2>
        <p className="max-w-[46ch] self-end text-lg leading-relaxed text-ink-600 lg:col-span-5">
          A placement portal starts at the drive. EduMapping starts years earlier, with career
          guidance at school, and carries the same record through college verification, drive day
          and the signed offer.
        </p>
      </div>

      {/* The chain: four documents joined by a punched rule. */}
      <ol className="relative mt-16 grid gap-10 lg:grid-cols-4 lg:gap-6">
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[11px] top-0 border-l border-dashed border-ink-950/30 lg:bottom-auto lg:left-0 lg:right-0 lg:top-[11px] lg:border-l-0 lg:border-t"
        />
        {STOPS.map((s, i) => (
          <li key={s.where} className="relative pl-10 lg:pl-0 lg:pt-10">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 flex h-[23px] w-[23px] items-center justify-center rounded-full border border-ink-950/40 bg-bone-50"
            >
              <span className={cx('h-2 w-2 rounded-full', i === 3 ? 'bg-india-600' : 'bg-saffron-500')} />
            </span>
            <p className="font-display text-sm font-bold uppercase tracking-[0.1em] text-ink-950">{s.where}</p>
            <p className="mt-1 text-sm text-ink-600">{s.what}</p>

            <div className="mt-5">
              {i === 0 && (
                <DocShell kind="Career guidance report" number="CG/2021/0412" tone="ink">
                  <Line k="Interests" v="Investigative, Realistic" />
                  <Line k="Stream" v="PCM → Engineering" />
                  <Line k="Counselling" v="3 of 3 sessions" />
                  <Line k="Workshop" v="Intro to programming" />
                  <p className="mt-auto pt-4 text-xs text-ink-500">Issued by the school&rsquo;s career counsellor</p>
                </DocShell>
              )}
              {i === 1 && (
                <DocShell kind="Verified marksheet" number="EM/26/CSE/0031" tone="stamp">
                  <Line k="CGPA" v="8.47" mono />
                  <Line k="Class X / XII" v="92.4 / 88.0 %" mono />
                  <Line k="Backlogs" v="0" mono />
                  <div className="mt-auto flex justify-end pt-4">
                    <Stamp size="sm" rotate={-5}>
                      Verified
                    </Stamp>
                  </div>
                </DocShell>
              )}
              {i === 2 && (
                <DocShell kind="Round slip" number="R3 · 22CSE031" tone="saffron">
                  <p className="font-display text-lg font-bold leading-tight text-ink-950">HR interview</p>
                  <p className="text-xs text-ink-500">Round 3 of 3 · Software Engineer</p>
                  <div className="mt-3">
                    <Line k="When" v="Sat 17 Oct, 2:00 pm" />
                    <Line k="Where" v="Block C · Room 105" />
                    <Line k="Bring" v="College ID, 2 resumes" />
                  </div>
                </DocShell>
              )}
              {i === 3 && (
                <DocShell kind="Offer letter" number="OL/26/0008" tone="india">
                  <p className="font-display text-lg font-bold leading-tight text-ink-950">Graduate Software Engineer</p>
                  <p className="text-xs text-ink-500">Accepted by the student</p>
                  <p className="mt-3 font-display text-[1.7rem] font-extrabold leading-none text-ink-950">
                    ₹12 <span className="text-base font-bold">LPA</span>
                  </p>
                  <div className="mt-auto flex justify-end pt-4">
                    <Stamp size="sm" tone="india" rotate={4}>
                      Letter verified
                    </Stamp>
                  </div>
                </DocShell>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-xs text-ink-500">Sample documents. Names, marks and offers are illustrative.</p>
    </Wrap>
  </section>
);

/* =============================================================== rule check */

const DRIVE_RULES = [
  { key: 'cgpa', label: 'Minimum CGPA', want: '7.5' },
  { key: 'backlogs', label: 'Active backlogs', want: '0' },
  { key: 'x', label: 'Class X', want: '≥ 60 %' },
  { key: 'xii', label: 'Class XII', want: '≥ 60 %' },
  { key: 'branch', label: 'Branch', want: 'CSE · IT · ECE' },
  { key: 'verified', label: 'Profile', want: 'Verified by the cell' }
];

const STUDENTS = [
  {
    id: 'ananya',
    name: 'Ananya Iyer',
    roll: '22CSE031',
    facts: { cgpa: '8.47', backlogs: '0', x: '92.4 %', xii: '88.0 %', branch: 'CSE', verified: 'Verified' },
    fails: {}
  },
  {
    id: 'kabir',
    name: 'Kabir Singh',
    roll: '22CSE019',
    facts: { cgpa: '7.12', backlogs: '0', x: '81.0 %', xii: '76.2 %', branch: 'CSE', verified: 'Verified' },
    fails: { cgpa: 'Needs 7.5; the record shows 7.12.' }
  },
  {
    id: 'vikram',
    name: 'Vikram Joshi',
    roll: '22CSE044',
    facts: { cgpa: '7.90', backlogs: '0', x: '74.0 %', xii: '69.5 %', branch: 'CSE', verified: 'Sent back' },
    fails: { verified: 'Class XII does not match the marksheet. Sent back to the student to correct.' }
  }
];

export const RuleCheck = () => {
  const [sid, setSid] = useState('kabir');
  const reduce = useReducedMotion();
  const group = useId();
  const s = STUDENTS.find((x) => x.id === sid);
  const failed = Object.keys(s.fails);
  const eligible = failed.length === 0;

  return (
    <section className="border-y border-ink-950/10 bg-bone-100 py-20 sm:py-24 lg:py-32">
      <Wrap>
        <div className="max-w-3xl">
          <h2 className="text-balance font-display text-[clamp(2.1rem,1.3rem+2.8vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-ink-950">
            Every rule, checked for every student. And the reason, in writing.
          </h2>
          <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-600">
            The cell sets the season&rsquo;s policy once: cut-offs, backlogs, Class X and XII,
            branches, Dream tiers, offer caps, verified profiles only. EduMapping applies it to every
            application, and a student who is turned away sees exactly which rule and why. Pick a
            student to try it.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          {/* The drive and its rules */}
          <div className="rounded-[14px] border border-ink-950/15 bg-[#FFFDF8] p-6 lg:col-span-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl font-bold text-ink-950">Graduate Software Engineer</p>
                <p className="mt-1 text-sm text-ink-600">₹10–14 LPA · Bengaluru · Dream tier</p>
              </div>
              <span className="rounded-[6px] border border-saffron-600/40 bg-saffron-50 px-2 py-0.5 text-xs font-semibold text-saffron-800">
                Sample drive
              </span>
            </div>
            <dl className="mt-5">
              {DRIVE_RULES.map((r) => (
                <div
                  key={r.key}
                  className="flex items-baseline justify-between gap-4 border-t border-ink-950/10 py-2.5 text-sm"
                >
                  <dt className="text-ink-600">{r.label}</dt>
                  <dd className="font-medium text-ink-950">{r.want}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The student and the verdict */}
          <div className="min-w-0 lg:col-span-7">
            <fieldset>
              <legend className="text-sm font-semibold text-ink-800">Check a student against this drive</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {STUDENTS.map((st) => (
                  <label
                    key={st.id}
                    className={cx(
                      'cursor-pointer rounded-[10px] border px-4 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-saffron-600',
                      sid === st.id
                        ? 'border-ink-950 bg-ink-950 text-bone-50'
                        : 'border-ink-950/20 bg-[#FFFDF8] text-ink-800 hover:border-ink-950/50'
                    )}
                  >
                    <input
                      type="radio"
                      name={group}
                      value={st.id}
                      checked={sid === st.id}
                      onChange={() => setSid(st.id)}
                      className="sr-only"
                    />
                    <span className="font-semibold">{st.name}</span>
                    <span className={cx('ml-2 font-mono text-xs', sid === st.id ? 'text-bone-300' : 'text-ink-500')}>
                      {st.roll}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div
              className="relative mt-5 rounded-[14px] border border-ink-950/15 bg-[#FFFDF8] p-6"
              aria-live="polite"
            >
              <ul className="divide-y divide-ink-950/10">
                {DRIVE_RULES.map((r) => {
                  const bad = s.fails[r.key];
                  return (
                    <li key={r.key} className="flex items-start gap-3 py-2.5 text-sm">
                      <span
                        className={cx(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px]',
                          bad ? 'bg-vermilion-50 text-vermilion-700' : 'bg-india-50 text-india-700'
                        )}
                      >
                        {bad ? (
                          <XMarkIcon className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Fails" />
                        ) : (
                          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Passes" />
                        )}
                      </span>
                      <span className="flex-1">
                        <span className="text-ink-700">{r.label}</span>
                        {bad && <span className="mt-0.5 block text-[13px] font-medium text-vermilion-700">{bad}</span>}
                      </span>
                      <span className="font-mono text-xs text-ink-800">{s.facts[r.key]}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="pointer-events-none absolute -right-2 -top-5 sm:-right-4">
                <Stamp
                  key={sid}
                  press={!reduce}
                  tone={eligible ? 'india' : 'vermilion'}
                  rotate={eligible ? -6 : 5}
                  size="md"
                  sub={eligible ? 'Can apply' : `${failed.length} rule${failed.length > 1 ? 's' : ''} not met`}
                >
                  {eligible ? 'Eligible' : 'Not eligible'}
                </Stamp>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-500">Sample students. The checks mirror the ones the product runs.</p>
          </div>
        </div>
      </Wrap>
    </section>
  );
};

/* ============================================================ season ledger */

const LEDGER = [
  {
    who: 'Placement cell',
    does: 'Imports the batch, verifies and locks marks, sets the season’s policy, approves every drive before students see it, runs rounds and checks offer letters.'
  },
  {
    who: 'Students',
    does: 'Keep one verified profile, see every drive they qualify for and why not when they don’t, apply in a click, follow each round and accept offers on their phone.'
  },
  {
    who: 'Recruiters',
    does: 'Post drives with real eligibility, see only the students the college has opened to them, shortlist by roll number, publish results and raise offers.'
  },
  {
    who: 'Schools',
    does: 'Run career guidance, psychometric testing, workshops and live classes, so a student reaches college already knowing where they are headed.'
  },
  {
    who: 'Administrators',
    does: 'Approve institutions, companies and accounts, send announcements and keep a complete audit log of who did what, and when.'
  }
];

export const SeasonLedger = ({ onNavigate }) => (
  <section className="bg-bone-50 py-20 sm:py-24 lg:py-32">
    <Wrap>
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4">
          <h2 className="text-balance font-display text-[clamp(2.1rem,1.3rem+2.8vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-ink-950">
            Everyone signs the same register.
          </h2>
          <p className="mt-5 max-w-[40ch] text-lg leading-relaxed text-ink-600">
            Five roles, one record, and nothing reaches a student without the cell&rsquo;s say.
          </p>
          <Button variant="outline" className="mt-8" onClick={() => onNavigate('features')}>
            See every feature
            <ArrowGlyph />
          </Button>
        </div>
        {/* A ruled register: the margin rule and the ruled lines are the page. */}
        <div className="relative lg:col-span-8">
          <span aria-hidden="true" className="absolute bottom-0 left-[9.5rem] top-0 hidden w-px bg-vermilion-500/60 sm:block" />
          <dl>
            {LEDGER.map((row) => (
              <div
                key={row.who}
                className="grid gap-1 border-t border-ink-950/15 py-6 sm:grid-cols-[9.5rem_1fr] sm:gap-8 last:border-b"
              >
                <dt className="font-display text-lg font-bold text-ink-950">{row.who}</dt>
                <dd className="text-base leading-relaxed text-ink-700 sm:pl-6">{row.does}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Wrap>
  </section>
);

/* ======================================================== inspection report */

const REPORT = [
  { prog: 'B.Tech · Computer Science', students: 120, eligible: 112, placed: 81, higher: 9, median: '6.8' },
  { prog: 'B.Tech · Information Technology', students: 60, eligible: 57, placed: 38, higher: 4, median: '6.2' },
  { prog: 'B.Tech · Electronics & Comm.', students: 60, eligible: 55, placed: 31, higher: 6, median: '5.4' },
  { prog: 'B.Tech · Mechanical', students: 60, eligible: 58, placed: 24, higher: 11, median: '4.6' }
];

export const InspectionReport = () => (
  <section className="relative overflow-hidden bg-ink-950 py-20 text-bone-50 sm:py-24 lg:py-32">
    <Guilloche size={620} tone="dark" lace opacity={0.1} className="pointer-events-none absolute -right-56 -top-56" />
    <Wrap className="relative">
      <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-5">
          <h2 className="text-balance font-display text-[clamp(2.1rem,1.3rem+2.8vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.025em]">
            Numbers that survive an inspection.
          </h2>
          <p className="mt-5 max-w-[42ch] text-lg leading-relaxed text-bone-200/85">
            At year end the NIRF and NAAC placement figures are already done: placement rate, higher
            studies, median and highest CTC, programme by programme. Every figure traces back to a
            verified record and a checked offer letter. One click exports it to Excel.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-bone-200">
            {[
              'Opted-out students leave the denominator, as NIRF requires',
              'Each student counts once, at their best offer',
              'Calendar of every round and deadline, synced to Google or Outlook',
              'A complete audit log behind every change'
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-india-300" strokeWidth={2.2} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <CertificateFrame tone="dark" serial="NIRF · 2025–26">
            <div className="px-5 pb-5 pt-10 sm:px-7 sm:pb-7 sm:pt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-sm font-bold uppercase tracking-[0.12em] text-bone-100">
                  Placement report · Batch of 2026
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-india-400/40 bg-india-500/15 px-2.5 py-1 text-xs font-semibold text-india-200">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Excel
                </span>
              </div>
              <div
                className="mt-5 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
                // Scrollable on phones, so it must be reachable by keyboard too.
                tabIndex={0}
                role="region"
                aria-label="Sample placement report"
              >
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/15 text-[11px] uppercase tracking-[0.07em] text-bone-300/80">
                      <th className="py-2 pr-3 font-semibold">Programme</th>
                      <th className="px-2 py-2 text-right font-semibold">Students</th>
                      <th className="px-2 py-2 text-right font-semibold">Eligible</th>
                      <th className="px-2 py-2 text-right font-semibold">Placed</th>
                      <th className="px-2 py-2 text-right font-semibold">Higher studies</th>
                      <th className="py-2 pl-2 text-right font-semibold">Median LPA</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[13px] text-bone-100">
                    {REPORT.map((r) => (
                      <tr key={r.prog} className="border-b border-white/10">
                        <td className="py-3 pr-3 font-sans text-sm text-bone-50">{r.prog}</td>
                        <td className="px-2 py-3 text-right">{r.students}</td>
                        <td className="px-2 py-3 text-right">{r.eligible}</td>
                        <td className="px-2 py-3 text-right">{r.placed}</td>
                        <td className="px-2 py-3 text-right">{r.higher}</td>
                        <td className="py-3 pl-2 text-right">{r.median}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-bone-300/60 sm:hidden">
                Swipe the table sideways to see every column.
              </p>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <p className="max-w-[30ch] flex-1 basis-56 text-xs text-bone-300/70">
                  Sample report for a fictional college. Your figures come from your own season.
                </p>
                <Stamp tone="light" size="sm" rotate={-4}>
                  From verified records
                </Stamp>
              </div>
            </div>
          </CertificateFrame>
        </div>
      </div>
    </Wrap>
  </section>
);

/* ==================================================================== close */

export const RecordClose = ({ loginPath }) => (
  <section className="relative overflow-hidden bg-bone-100 py-20 sm:py-24 lg:py-28">
    <Wrap className="relative">
      <div className="grid items-center gap-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <h2 className="text-balance font-display text-[clamp(2.4rem,1.4rem+3.6vw,4.4rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink-950">
            Bring your next placement season home.
          </h2>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-600">
            Tell us about your college and the season you are planning. We will set up your
            placement cell, import your batch and walk your team through the first drive.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button as="a" href="mailto:hello@edumapping.com?subject=Bring%20our%20college%20on%20board" variant="primary" size="lg">
              <EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
              hello@edumapping.com
            </Button>
            <Button
              as="a"
              href="https://wa.me/919104991059"
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="lg"
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
              WhatsApp +91 91049 91059
            </Button>
            <Button as={Link} to={loginPath} variant="outline" size="lg">
              Sign in
            </Button>
          </div>
        </div>
        <div className="hidden justify-center lg:col-span-4 lg:flex">
          <Guilloche size={300} tone="light" opacity={0.9} />
        </div>
      </div>
    </Wrap>
  </section>
);
