// client/src/components/landing/Ticker.js
import React from 'react';
import { Marquee } from './primitives';

// What the platform actually runs. A scrolling word-mark strip rather than a
// logo wall: we would only be able to fill a logo wall with placeholders, and
// a fake client list is worse than none.
const ITEMS = [
  'Industrial workshops',
  'Campus drives',
  'Psychometric testing',
  'Live classes',
  'Skill training',
  'Internships',
  'Resume builder',
  'Placement analytics',
  'Career guidance',
  'Employer network'
];

/**
 * Ticker — the strip directly under the hero.
 *
 * Sits on the inverted ink band so it acts as a hard rule between the hero and
 * the first content section, and gives the eye somewhere to land on the way
 * down the page.
 */
const Ticker = () => (
  <div className="relative overflow-hidden border-y border-ink-950 bg-ink-950 py-4">
    <Marquee>
      {ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="whitespace-nowrap px-7 font-display text-sm font-medium tracking-tight text-white/80 sm:text-base">
            {item}
          </span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
        </span>
      ))}
    </Marquee>
  </div>
);

export default Ticker;
