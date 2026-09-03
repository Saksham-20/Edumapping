// client/src/components/common/LoadingSpinner.js
//
// The app-wide loading indicator. Previously offered six visual variants
// (dots, pulse, bars, ring, gradient, default) in a blue that no longer exists
// in the palette — six ways to say the same thing, none of which announced
// itself to a screen reader. One spinner now, on the brand accent.
//
// Prefer the `Skeleton`/`SkeletonCard` primitives from `components/ui` for
// lists and cards: they hold the layout still so content does not jump in.
// Use this for a whole route that has nothing to show yet.
import React from 'react';

const SIZES = {
  small: 'h-4 w-4 border-2',
  medium: 'h-8 w-8 border-2',
  large: 'h-12 w-12 border-[3px]',
  xl: 'h-16 w-16 border-4'
};

// The track colour has to match the ground it sits on: the light track is
// invisible against the conference room's ink canvas, and vice versa.
const TONES = {
  light: 'border-ink-950/15 border-t-saffron-500',
  dark: 'border-white/20 border-t-saffron-500'
};

const LoadingSpinner = ({
  size = 'medium',
  tone = 'light',
  className = '',
  text = '',
  fullScreen = false
}) => {
  const spinner = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`animate-spin rounded-full ${TONES[tone] || TONES.light} ${
          SIZES[size] || SIZES.medium
        }`}
      />
      {/*
        Always announce something. `text` is optional visually, but a status
        region with no accessible name tells assistive tech nothing at all.
      */}
      {text ? (
        <span className={`text-sm font-medium ${tone === 'dark' ? 'text-white/70' : 'text-ink-600'}`}>
          {text}
        </span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bone-50">{spinner}</div>
    );
  }
  return spinner;
};

export default LoadingSpinner;
