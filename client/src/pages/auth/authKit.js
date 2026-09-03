// client/src/pages/auth/authKit.js
//
// The three pieces every signed-out screen needs and `components/ui` does not
// ship. They live here rather than in the app kit because they only make sense
// without the app header: a brand lockup instead of a PageHeader, and a
// password field with a reveal toggle — the kit's Input owns its own <input>
// element, so a trailing adornment has to be composed alongside it.
import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Field, cx } from '../../components/ui';

/** Centred, full-viewport ground. Not PageShell: there is no header above it. */
export const AuthShell = ({ width = 'max-w-md', children }) => (
  <main className="flex min-h-screen items-center justify-center bg-bone-50 px-5 py-12">
    <div className={cx('w-full', width)}>{children}</div>
  </main>
);

/** Logo + wordmark, linking home. The wordmark carries the accessible name. */
export const AuthBrand = ({ tagline }) => (
  <Link
    to="/"
    className="mb-6 flex flex-col items-center gap-1.5 rounded-2xl text-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-bone-50"
  >
    <img src="/logo.svg" alt="" aria-hidden="true" className="h-14 w-auto" />
    <span className="font-display text-2xl font-bold tracking-tight text-ink-950">EduMapping</span>
    {tagline && (
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
        {tagline}
      </span>
    )}
  </Link>
);

/** Submit-level failure banner. Announced: it only appears after a submit. */
export const FormError = ({ children }) =>
  children ? (
    <div
      role="alert"
      className="rounded-xl border border-red-600/25 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
    >
      {children}
    </div>
  ) : null;

// Mirrors the kit's own field styling. Duplicated deliberately: the kit does
// not export its base classes, and a password input has to be rendered here to
// sit next to the toggle.
const FIELD_CLASS =
  'block w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-ink-950 ' +
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
              ? 'border-red-600 focus:border-red-600 focus:ring-red-600/25'
              : 'border-ink-950/20 hover:border-ink-950/40 focus:border-ink-950 focus:ring-ink-950/15',
            className
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-ink-500 transition-colors hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
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
