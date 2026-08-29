// client/src/components/landing/ProductPreview.js
import React from 'react';
import {
  BriefcaseIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

// A recruiter's pipeline view. Deliberately built in markup rather than shipped
// as a screenshot: it stays crisp at any pixel density, weighs nothing, and
// cannot drift out of date with the real product's colours.
const PIPELINE = [
  { stage: 'Applied', count: 248, width: '100%', tone: 'bg-ink-950' },
  { stage: 'Shortlisted', count: 96, width: '62%', tone: 'bg-saffron-500' },
  { stage: 'Interviewed', count: 41, width: '34%', tone: 'bg-azure-500' },
  { stage: 'Selected', count: 18, width: '17%', tone: 'bg-india-600' }
];

const CANDIDATES = [
  { initials: 'AK', name: 'Ananya K.', meta: 'B.Tech CSE · 2026 · 8.7 CGPA', status: 'Shortlisted' },
  { initials: 'RS', name: 'Rohit S.', meta: 'B.Tech ECE · 2026 · 8.1 CGPA', status: 'Interviewed' },
  { initials: 'MP', name: 'Meera P.', meta: 'MBA Fin · 2025 · 9.0 CGPA', status: 'Selected' }
];

const STATUS_TONES = {
  Shortlisted: 'border-saffron-500/40 bg-saffron-50 text-saffron-800',
  Interviewed: 'border-azure-500/30 bg-primary-50 text-azure-700',
  Selected: 'border-india-600/30 bg-india-50 text-india-700'
};

const ProductPreview = () => (
  <div className="lp-preview relative w-full max-w-[520px]">
    {/* ---------------------------------------------------------- app window */}
    <div className="relative overflow-hidden rounded-3xl border border-ink-950 bg-white shadow-[10px_10px_0_0_#0B0C0E]">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-ink-950/10 bg-bone-100 px-4 py-3">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-950/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-950/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-950/20" />
        </span>
        <span className="ml-2 flex flex-1 items-center gap-2 rounded-full border border-ink-950/10 bg-white px-3 py-1">
          <MagnifyingGlassIcon className="h-3 w-3 text-ink-500" strokeWidth={2} aria-hidden="true" />
          <span className="font-mono text-[10px] tracking-wide text-ink-500">
            edumapping.com/recruiter
          </span>
        </span>
      </div>

      <div className="space-y-5 p-5">
        {/* Job header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-india-600/30 bg-india-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-india-700">
              <CheckCircleIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Verified drive
            </span>
            <p className="mt-2 font-display text-lg font-bold leading-tight text-ink-950">
              Software Engineer · 2026 batch
            </p>
            <p className="mt-0.5 text-xs text-ink-600">Bengaluru · Hybrid · ₹12–18 LPA</p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-950/15 bg-bone-100 text-ink-950">
            <BriefcaseIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </span>
        </div>

        {/* Pipeline */}
        <div className="rounded-2xl border border-ink-950/10 bg-bone-50 p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500">
            Application pipeline
          </p>
          <div className="mt-3 space-y-2.5">
            {PIPELINE.map(({ stage, count, width, tone }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[11px] font-medium text-ink-600">{stage}</span>
                <span
                  aria-hidden="true"
                  className="h-2 flex-1 overflow-hidden rounded-full bg-ink-950/[0.07]"
                >
                  <span className={`block h-full rounded-full ${tone}`} style={{ width }} />
                </span>
                <span className="w-8 shrink-0 text-right font-display text-xs font-bold text-ink-950">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Candidates */}
        <ul className="space-y-2">
          {CANDIDATES.map(({ initials, name, meta, status }) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-2xl border border-ink-950/10 bg-white px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 font-display text-[11px] font-bold text-white"
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink-950">{name}</span>
                <span className="block truncate font-mono text-[10px] text-ink-500">{meta}</span>
              </span>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${STATUS_TONES[status]}`}
              >
                {status}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sweeping highlight across the glass. Decorative. */}
      <span aria-hidden="true" className="lp-sheen animate-sheen" />
    </div>

    {/* ------------------------------------------------- floating live-class chip */}
    <div className="absolute -bottom-5 -left-4 hidden animate-float items-center gap-2.5 rounded-2xl border border-ink-950 bg-saffron-500 px-3.5 py-2.5 shadow-block-sm sm:flex">
      <VideoCameraIcon className="h-4 w-4 text-ink-950" strokeWidth={2} aria-hidden="true" />
      <span className="leading-tight">
        <span className="block font-display text-xs font-bold text-ink-950">Live class</span>
        <span className="block font-mono text-[10px] text-ink-950/70">28 students joined</span>
      </span>
      <span aria-hidden="true" className="h-2 w-2 animate-pulse-dot rounded-full bg-india-700" />
    </div>
  </div>
);

export default ProductPreview;
