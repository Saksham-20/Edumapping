// client/src/pages/auth/authKit.js
//
// The three pieces every signed-out screen needs and `components/ui` does not
// ship. They live here rather than in the app kit because they only make sense
// without the app header: a brand lockup instead of a PageHeader, and a
// password field with a reveal toggle — the kit's Input owns its own <input>
// element, so a trailing adornment has to be composed alongside it.
import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Field, cx } from '../../components/ui';
import { Guilloche, GuillocheBand, MicroRule, Stamp } from '../../components/brand';

/**
 * Full-viewport ground. Not PageShell: there is no header above it.
 *
 * On wide screens the left half is the navy document folder the record lives
 * in, with the rosette engraved once on load; the form sits on paper beside
 * it. Small screens get a short navy band instead, so the form still sits
 * high on the first screen but the page is recognisably the same document.
 */
export const AuthShell = ({ width = 'max-w-md', children }) => (
  <div className="min-h-screen bg-bone-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <aside className="relative hidden overflow-hidden bg-ink-950 text-bone-50 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <Guilloche
        size={820}
        tone="dark"
        draw
        opacity={0.18}
        className="pointer-events-none absolute -bottom-[30rem] -right-[30rem]"
      />
      <Link
        to="/"
        className="relative inline-flex items-center gap-3 self-start rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
      >
        <img src="/logo.svg" alt="" aria-hidden="true" className="h-10 w-auto" />
        <span className="font-display text-xl font-bold">EduMapping</span>
      </Link>
      <div className="relative">
        <p className="max-w-[12ch] font-display text-[clamp(2.6rem,1.4rem+2.6vw,4.2rem)] font-extrabold leading-[0.96] tracking-[-0.03em]">
          From classroom to career.
        </p>
        <GuillocheBand tone="dark" height={10} className="mt-6 max-w-[22rem] opacity-90" />
        <p className="mt-6 max-w-[40ch] text-base leading-relaxed text-bone-200/80">
          One verified record for every student, from school guidance to the signed offer letter.
        </p>
      </div>
      <div className="relative flex items-end justify-between gap-6">
        <MicroRule tone="dark" className="max-w-[60%]" />
        <Stamp tone="light" size="sm" rotate={-6}>
          Verified · Locked
        </Stamp>
      </div>
    </aside>
    <header className="relative overflow-hidden bg-ink-950 px-5 pb-5 pt-6 text-bone-50 sm:px-8 lg:hidden">
      <Guilloche
        size={300}
        tone="dark"
        lace
        opacity={0.16}
        className="pointer-events-none absolute -right-24 -top-28"
      />
      <div className="relative flex items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
        >
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-9 w-auto" />
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold">EduMapping</span>
            <span className="block text-[11px] text-bone-300/80">From classroom to career</span>
          </span>
        </Link>
        <Stamp tone="light" size="sm" rotate={-6}>
          Verified
        </Stamp>
      </div>
      <GuillocheBand tone="dark" height={10} className="relative mt-5 opacity-90" />
    </header>
    <main className="flex items-start justify-center px-5 pb-12 pt-8 sm:px-8 lg:min-h-screen lg:items-center lg:py-12">
      <div className={cx('w-full', width)}>{children}</div>
    </main>
  </div>
);

/**
 * The brand lockup used to sit above each form on small screens. The AuthShell
 * now carries the brand at every breakpoint (navy band on phones, navy panel
 * on desktop), so this renders nothing; it stays exported so the auth pages
 * that still place it keep compiling.
 */
export const AuthBrand = () => null;

/**
 * Submit-level failure banner. Announced: it only appears after a submit.
 *
 * It sits at the top of the form while the submit button is at the bottom, so
 * on a phone the reason appeared off-screen and the button just seemed to do
 * nothing. It scrolls itself into view when it appears or changes.
 */
export const FormError = ({ children }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (children && ref.current?.scrollIntoView) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [children]);
  return children ? (
    <div
      ref={ref}
      role="alert"
      className="rounded-[10px] border border-vermilion-600/30 bg-vermilion-50 px-4 py-3 text-sm font-medium text-vermilion-800"
    >
      {children}
    </div>
  ) : null;
};

// Mirrors the kit's own field styling. Duplicated deliberately: the kit does
// not export its base classes, and a password input has to be rendered here to
// sit next to the toggle.
const FIELD_CLASS =
  'block w-full rounded-[10px] border bg-[#FFFDF8] px-3.5 py-2.5 pr-11 text-sm text-ink-950 ' +
  'placeholder:text-ink-500 transition-colors duration-150 focus:outline-none focus:ring-2';

export const PasswordField = ({ label, error, help, id, className = '', ...rest }) => {
  const auto = useId();
  const fieldId = id || `pw-${auto}`;
  const [shown, setShown] = useState(false);

  return (
    <Field label={label} htmlFor={fieldId} error={error} help={help}>
      <div className="relative">
        <input
          id={fieldId}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}
          className={cx(
            FIELD_CLASS,
            error
              ? 'border-vermilion-600 focus:border-vermilion-600 focus:ring-vermilion-600/25'
              : 'border-ink-950/20 hover:border-ink-950/40 focus:border-ink-950 focus:ring-saffron-500/30',
            className
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-[10px] px-3 text-ink-500 transition-colors hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
        >
          {shown ? (
            <EyeSlashIcon aria-hidden="true" className="h-5 w-5" />
          ) : (
            <EyeIcon aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      </div>
    </Field>
  );
};
