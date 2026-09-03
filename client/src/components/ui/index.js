// client/src/components/ui/index.js
//
// The signed-in app's design system.
//
// The landing page owns `components/landing/primitives.js`; this is its
// counterpart for every screen behind the login. Same visual language — warm
// bone canvas, near-black ink type, saffron as the single hot accent, india
// green as the positive signal, hard 1px borders instead of soft drop shadows —
// but tuned for density: smaller radii, tighter padding, no decorative motion.
//
// Nothing here fetches data or makes routing decisions. Pages compose these.
import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/* =============================================================== primitives */

/** Join class names, dropping falsy values. */
export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* =================================================================== layout */

/**
 * PageShell — the outer wrapper every app page starts with.
 *
 * Owns the ground colour and the vertical rhythm, so a page can never ship
 * with its own one-off `bg-gray-50 min-h-screen py-8` combination.
 */
export const PageShell = ({ children, className = '', width = 'default' }) => {
  const widths = {
    default: 'max-w-content',
    wide: 'max-w-[1440px]',
    narrow: 'max-w-4xl'
  };
  return (
    <div className={cx('min-h-screen bg-bone-50', className)}>
      <div className={cx('mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8', widths[width])}>
        {children}
      </div>
    </div>
  );
};

/**
 * PageHeader — the title block at the top of every page.
 *
 * `actions` sits on the same row on desktop and wraps beneath on mobile, so a
 * long title never squeezes the primary action into an unreadable column.
 */
export const PageHeader = ({
  eyebrow,
  title,
  lead,
  actions,
  breadcrumbs,
  className = ''
}) => (
  <div className={cx('mb-8', className)}>
    {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-4" />}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
          {title}
        </h1>
        {lead && <p className="mt-2 max-w-prose text-sm text-ink-600 sm:text-base">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </div>
);

/** Breadcrumb trail. The last item is the current page and is not a link. */
export const Breadcrumbs = ({ items = [], className = '' }) => (
  <nav aria-label="Breadcrumb" className={className}>
    <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-500">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {item.to && !last ? (
              <Link
                to={item.to}
                className="rounded px-1 py-0.5 font-medium hover:text-ink-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? 'page' : undefined} className={last ? 'text-ink-700' : ''}>
                {item.label}
              </span>
            )}
            {!last && <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5 text-ink-500" />}
          </li>
        );
      })}
    </ol>
  </nav>
);

/** A titled band inside a page — groups related cards under one heading. */
export const SectionBlock = ({ title, description, actions, children, className = '' }) => (
  <section className={cx('mb-10', className)}>
    {(title || actions) && (
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {title && (
            <h2 className="font-display text-lg font-bold tracking-tight text-ink-950">{title}</h2>
          )}
          {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

/* ================================================================= surfaces */

/**
 * Card — the standard app surface.
 *
 * Hard 1px border, no blur, no soft shadow. `interactive` shifts the border and
 * adds the offset block shadow; deliberately no transform, so hovering a card
 * never nudges the grid around it.
 */
export const Card = ({
  as: Tag = 'div',
  interactive = false,
  padded = true,
  className = '',
  children,
  ...rest
}) => (
  <Tag
    className={cx(
      'rounded-2xl border border-ink-950/15 bg-white transition-all duration-200',
      padded && 'p-5 sm:p-6',
      interactive &&
        'cursor-pointer hover:border-ink-950/40 hover:shadow-block-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2 focus-visible:ring-offset-bone-50',
      className
    )}
    {...rest}
  >
    {children}
  </Tag>
);

export const CardHeader = ({ title, description, actions, className = '' }) => (
  <div className={cx('flex flex-wrap items-start justify-between gap-3', className)}>
    <div className="min-w-0">
      {title && <h3 className="font-display text-base font-bold text-ink-950">{title}</h3>}
      {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </div>
);

/* ================================================================= controls */

const BUTTON_BASE =
  'group relative inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap ' +
  'rounded-full font-semibold transition-all duration-200 focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bone-50 ' +
  'disabled:pointer-events-none disabled:opacity-50';

const BUTTON_SIZES = {
  // `sm` is for controls that live inside a table row or a card footer; `md`
  // is the default everywhere else.
  sm: 'min-h-[36px] px-3.5 py-1.5 text-xs',
  md: 'min-h-[42px] px-4 py-2 text-sm',
  lg: 'min-h-[50px] px-6 py-3 text-base'
};

const BUTTON_VARIANTS = {
  primary:
    'border border-ink-950 bg-ink-950 text-white shadow-block-sm hover:-translate-x-[1px] ' +
    'hover:-translate-y-[1px] hover:shadow-[4px_4px_0_0_#FF9933] active:translate-x-0 ' +
    'active:translate-y-0 active:shadow-none focus-visible:ring-ink-950',
  saffron:
    'border border-ink-950 bg-saffron-500 text-ink-950 shadow-block-sm hover:-translate-x-[1px] ' +
    'hover:-translate-y-[1px] hover:shadow-[4px_4px_0_0_#0B0C0E] active:translate-x-0 ' +
    'active:translate-y-0 active:shadow-none focus-visible:ring-ink-950',
  secondary:
    'border border-ink-950/20 bg-white text-ink-950 hover:border-ink-950 hover:bg-bone-100 ' +
    'focus-visible:ring-ink-950',
  ghost:
    'border border-transparent bg-transparent text-ink-700 hover:bg-ink-950/[0.06] ' +
    'hover:text-ink-950 focus-visible:ring-ink-950',
  danger:
    'border border-red-700 bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700',
  success:
    'border border-india-700 bg-india-700 text-white hover:bg-india-800 focus-visible:ring-india-700',
  // Sits on the inverted ink bands (dashboard hero strips, the conference UI).
  light:
    'border border-white bg-white text-ink-950 hover:bg-saffron-500 hover:border-saffron-500 ' +
    'focus-visible:ring-white focus-visible:ring-offset-ink-950'
};

/**
 * Button — every action in the app.
 *
 * Pass `as={Link}` for navigation. `loading` swaps in a spinner and disables
 * the control, so no caller has to hand-roll a pending state.
 */
export const Button = forwardRef(
  (
    {
      as: Tag = 'button',
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconRight: IconRight,
      fullWidth = false,
      className = '',
      children,
      disabled,
      ...rest
    },
    ref
  ) => (
    <Tag
      ref={ref}
      // A native <button> defaults to type="submit"; inside a form that turns
      // every unmarked button into an accidental submit.
      {...(Tag === 'button' ? { type: rest.type || 'button' } : {})}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cx(
        BUTTON_BASE,
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          // An arc rather than a ring: `border-current` inherits the button's
          // own text colour on every variant, and two transparent sides make
          // the spin visible without needing a second, alpha-modified colour
          // (currentColor cannot take a Tailwind opacity modifier).
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-b-transparent border-r-transparent"
        />
      ) : (
        Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
      )}
    </Tag>
  )
);
Button.displayName = 'Button';

/**
 * IconButton — square, icon-only.
 *
 * `label` is required and becomes both the accessible name and the tooltip: an
 * icon button with no label is silent to a screen reader.
 *
 * Its own flat variant table rather than a reduced `BUTTON_VARIANTS` entry —
 * the offset block shadow and hover nudge read as a glitch on a 40px square.
 */
const ICON_BUTTON_VARIANTS = {
  ghost: 'border border-transparent text-ink-600 hover:bg-ink-950/[0.06] hover:text-ink-950',
  secondary: 'border border-ink-950/20 bg-white text-ink-800 hover:border-ink-950 hover:bg-bone-100',
  primary: 'border border-ink-950 bg-ink-950 text-white hover:bg-ink-800',
  danger: 'border border-transparent text-red-700 hover:bg-red-50'
};

export const IconButton = forwardRef(
  ({ icon: Icon, label, variant = 'ghost', size = 'md', className = '', ...rest }, ref) => {
    const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2',
          'focus-visible:ring-offset-bone-50 disabled:pointer-events-none disabled:opacity-50',
          sizes[size],
          ICON_BUTTON_VARIANTS[variant] || ICON_BUTTON_VARIANTS.ghost,
          className
        )}
        {...rest}
      >
        <Icon aria-hidden="true" className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2} />
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';

/* =================================================================== fields */

const FIELD_BASE =
  'block w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-950 ' +
  'placeholder:text-ink-500 transition-colors duration-150 focus:outline-none focus:ring-2 ' +
  'disabled:cursor-not-allowed disabled:bg-bone-100 disabled:text-ink-500';

const fieldTone = (invalid) =>
  invalid
    ? 'border-red-600 focus:border-red-600 focus:ring-red-600/25'
    : 'border-ink-950/20 hover:border-ink-950/40 focus:border-ink-950 focus:ring-ink-950/15';

/**
 * Field — label + control + help/error, wired together.
 *
 * The label's `htmlFor`, the error's `id` and the control's `aria-describedby`
 * are generated here so no caller can ship an input that a screen reader
 * announces without its label or its error.
 */
export const Field = ({ label, htmlFor, required, error, help, children, className = '' }) => (
  <div className={cx('w-full', className)}>
    {label && (
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
    )}
    {children}
    {error && (
      <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
        {error}
      </p>
    )}
    {help && !error && (
      <p id={`${htmlFor}-help`} className="mt-1.5 text-xs text-ink-500">
        {help}
      </p>
    )}
  </div>
);

export const Input = forwardRef(
  ({ label, error, help, required, className = '', id, icon: Icon, ...rest }, ref) => {
    const auto = useId();
    const fieldId = id || `in-${auto}`;
    const control = (
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}
        className={cx(FIELD_BASE, fieldTone(error), Icon && 'pl-10', className)}
        {...rest}
      />
    );
    return (
      <Field label={label} htmlFor={fieldId} required={required} error={error} help={help}>
        {Icon ? (
          <div className="relative">
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
            />
            {control}
          </div>
        ) : (
          control
        )}
      </Field>
    );
  }
);
Input.displayName = 'Input';

export const Textarea = forwardRef(
  ({ label, error, help, required, rows = 4, className = '', id, ...rest }, ref) => {
    const auto = useId();
    const fieldId = id || `ta-${auto}`;
    return (
      <Field label={label} htmlFor={fieldId} required={required} error={error} help={help}>
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}
          className={cx(FIELD_BASE, fieldTone(error), 'resize-y', className)}
          {...rest}
        />
      </Field>
    );
  }
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef(
  ({ label, error, help, required, options, children, className = '', id, ...rest }, ref) => {
    const auto = useId();
    const fieldId = id || `sel-${auto}`;
    return (
      <Field label={label} htmlFor={fieldId} required={required} error={error} help={help}>
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fieldId}-error` : help ? `${fieldId}-help` : undefined}
          className={cx(FIELD_BASE, fieldTone(error), 'pr-9', className)}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
      </Field>
    );
  }
);
Select.displayName = 'Select';

export const Checkbox = forwardRef(({ label, description, className = '', id, ...rest }, ref) => {
  const auto = useId();
  const fieldId = id || `cb-${auto}`;
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input
        ref={ref}
        type="checkbox"
        id={fieldId}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-950/30 text-ink-950 focus:ring-2 focus:ring-ink-950/40"
        {...rest}
      />
      <label htmlFor={fieldId} className="cursor-pointer text-sm text-ink-800">
        {label}
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </label>
    </div>
  );
});
Checkbox.displayName = 'Checkbox';

/* ================================================================== status */

const BADGE_TONES = {
  neutral: 'border-ink-950/15 bg-bone-100 text-ink-700',
  ink: 'border-ink-950 bg-ink-950 text-white',
  success: 'border-india-600/30 bg-india-50 text-india-800',
  warning: 'border-saffron-500/40 bg-saffron-50 text-saffron-800',
  danger: 'border-red-600/25 bg-red-50 text-red-800',
  info: 'border-azure-500/30 bg-azure-500/10 text-azure-700',
  purple: 'border-purple-500/25 bg-purple-50 text-purple-800'
};

/**
 * Badge — a status pill.
 *
 * Every tone pairs a tinted ground with a dark text value from the same hue so
 * the label clears AA contrast; never set the text colour separately.
 */
export const Badge = ({ tone = 'neutral', dot = false, className = '', children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      BADGE_TONES[tone] || BADGE_TONES.neutral,
      className
    )}
  >
    {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

/**
 * Maps a domain status string onto a badge tone. One table, used everywhere.
 *
 * The keys are the actual Postgres ENUM values, read off the database rather
 * than guessed — `applications.status` is applied/screening/shortlisted/
 * interviewed/selected/rejected/withdrawn, and there is no "under_review" or
 * "offered" anywhere in the schema. A status with no entry here renders
 * neutral, which is a silent mislabel, so this list has to track the enums.
 */
export const STATUS_TONES = {
  // applications
  applied: 'info',
  screening: 'warning',
  shortlisted: 'warning',
  interviewed: 'warning',
  selected: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
  // jobs
  draft: 'neutral',
  active: 'success',
  closed: 'neutral',
  cancelled: 'danger',
  // events
  scheduled: 'info',
  ongoing: 'warning',
  completed: 'success',
  // conferences
  live: 'danger',
  ended: 'neutral',
  // event registrations
  registered: 'success',
  attended: 'success',
  no_show: 'danger',
  // approval workflow (users and organizations)
  pending: 'warning',
  approved: 'success',
  // account state
  inactive: 'neutral',
  suspended: 'danger'
};

/** Renders a raw status string as a correctly-toned, human-readable badge. */
export const StatusBadge = ({ status, className = '' }) => {
  if (!status) return null;
  const key = String(status).toLowerCase();
  return (
    <Badge tone={STATUS_TONES[key] || 'neutral'} dot className={className}>
      {String(status).replace(/_/g, ' ')}
    </Badge>
  );
};

/* ================================================================== stats */

/**
 * StatTile — one number in a dashboard grid.
 *
 * The label sits above the number: on a dense grid the eye scans labels first
 * to find the metric it wants, then reads the value.
 */
export const StatTile = ({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'ink',
  to,
  loading = false,
  className = ''
}) => {
  const accents = {
    ink: 'border-ink-950/15 bg-ink-950 text-white',
    saffron: 'border-saffron-500/35 bg-saffron-50 text-saffron-800',
    india: 'border-india-600/30 bg-india-50 text-india-700',
    azure: 'border-azure-500/25 bg-azure-500/10 text-azure-700'
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
          {label}
        </p>
        {Icon && (
          <span
            aria-hidden="true"
            className={cx(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              accents[accent]
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-9 w-20 animate-pulse rounded-lg bg-bone-200" />
      ) : (
        <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-ink-950">
          {value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </>
  );

  if (to) {
    return (
      <Card as={Link} to={to} interactive className={className}>
        {body}
      </Card>
    );
  }
  return <Card className={className}>{body}</Card>;
};

/* ================================================================== states */

/**
 * EmptyState — what a list renders when it has nothing.
 *
 * Always takes an action: an empty screen with no way forward is a dead end.
 */
export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div
    className={cx(
      'flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-950/20 bg-white px-6 py-14 text-center',
      className
    )}
  >
    {Icon && (
      <span
        aria-hidden="true"
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-950/15 bg-bone-100 text-ink-600"
      >
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
    )}
    <h3 className="font-display text-lg font-bold text-ink-950">{title}</h3>
    {description && <p className="mt-1.5 max-w-md text-sm text-ink-600">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/** Inline error panel for a failed fetch, with a retry affordance. */
export const ErrorState = ({ title = 'Something went wrong', description, onRetry, className = '' }) => (
  <div
    role="alert"
    className={cx('rounded-2xl border border-red-600/25 bg-red-50 px-5 py-6 text-center', className)}
  >
    <h3 className="font-display text-base font-bold text-red-900">{title}</h3>
    {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-red-800">{description}</p>}
    {onRetry && (
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

/**
 * Skeleton — the loading placeholder.
 *
 * Preferred over a centred spinner for lists and cards: it holds the layout
 * still, so content does not jump when it arrives.
 */
export const Skeleton = ({ className = '' }) => (
  <div aria-hidden="true" className={cx('animate-pulse rounded-lg bg-bone-200', className)} />
);

export const SkeletonCard = ({ lines = 3, className = '' }) => (
  <Card className={className}>
    <Skeleton className="h-5 w-1/3" />
    <div className="mt-4 space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  </Card>
);

/** Full-page loader. `label` is announced; the spinner itself is decorative. */
export const PageLoader = ({ label = 'Loading' }) => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <span
        aria-hidden="true"
        className="h-9 w-9 animate-spin rounded-full border-2 border-ink-950/15 border-t-saffron-500"
      />
      <span className="text-sm text-ink-600">{label}…</span>
    </div>
  </div>
);

/* =================================================================== tables */

/**
 * Table — a horizontally scrollable data table.
 *
 * The scroll container is focusable so a keyboard user can reach the overflow;
 * a table that only scrolls by dragging is unusable without a pointer.
 */
export const Table = ({ children, className = '' }) => (
  <div
    tabIndex={0}
    role="region"
    aria-label="Data table"
    className={cx(
      'overflow-x-auto rounded-2xl border border-ink-950/15 bg-white',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950',
      className
    )}
  >
    <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
  </div>
);

export const Thead = ({ children }) => (
  <thead className="border-b border-ink-950/15 bg-bone-100">{children}</thead>
);

export const Th = ({ children, className = '', ...rest }) => (
  <th
    scope="col"
    className={cx(
      'px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600',
      className
    )}
    {...rest}
  >
    {children}
  </th>
);

export const Tbody = ({ children }) => (
  <tbody className="divide-y divide-ink-950/10">{children}</tbody>
);

export const Tr = ({ children, className = '', ...rest }) => (
  <tr className={cx('transition-colors hover:bg-bone-50', className)} {...rest}>
    {children}
  </tr>
);

export const Td = ({ children, className = '', ...rest }) => (
  <td className={cx('px-4 py-3.5 align-middle text-ink-800', className)} {...rest}>
    {children}
  </td>
);

/* ==================================================================== tabs */

/**
 * Tabs — a horizontal tab bar.
 *
 * Real <button role="tab"> elements with arrow-key roving focus, so the bar
 * behaves the way assistive tech expects rather than being styled <div>s.
 */
export const Tabs = ({ tabs, value, onChange, className = '' }) => {
  const listRef = useRef(null);

  const onKeyDown = (e) => {
    const idx = tabs.findIndex((t) => t.value === value);
    if (idx < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].value);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cx(
        'flex gap-1 overflow-x-auto rounded-full border border-ink-950/15 bg-white p-1',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cx(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950',
              active ? 'bg-ink-950 text-white' : 'text-ink-600 hover:bg-bone-100 hover:text-ink-950'
            )}
          >
            {tab.icon && <tab.icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />}
            {tab.label}
            {tab.count != null && (
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-bone-200 text-ink-700'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* =================================================================== modal */

/**
 * Modal — a focus-trapped dialog.
 *
 * Escape closes it, the page behind is frozen while it is open, and focus is
 * returned to whatever opened it on close.
 */
export const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // Trap Tab inside the panel. Without this, tabbing walks onto the
      // page behind the overlay, which is inert to the mouse but not to a
      // keyboard.
      const focusables = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // Defer so the panel exists before we move focus into it.
    const t = setTimeout(() => panelRef.current?.querySelector('button, input, a')?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      clearTimeout(t);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden border border-ink-950/15 bg-white',
          'rounded-t-3xl sm:rounded-3xl',
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-950/10 px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-bold text-ink-950">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
          </div>
          <IconButton icon={XMarkIcon} label="Close dialog" onClick={onClose} size="sm" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-950/10 bg-bone-50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* =============================================================== pagination */

/** Page control for server-paginated lists. Hidden when there is one page. */
export const Pagination = ({ page, pages, onChange, className = '' }) => {
  if (!pages || pages <= 1) return null;
  const current = Number(page) || 1;
  const total = Number(pages);

  // A compact window around the current page: first, last, and the two
  // neighbours. Long result sets must not render 200 buttons.
  const numbers = [];
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) numbers.push(i);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }

  return (
    <nav aria-label="Pagination" className={cx('flex items-center justify-center gap-1.5', className)}>
      <Button
        size="sm"
        variant="secondary"
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      >
        Previous
      </Button>
      {numbers.map((n, i) =>
        n === '…' ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1.5 text-sm text-ink-500">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === current ? 'page' : undefined}
            onClick={() => onChange(n)}
            className={cx(
              'h-9 min-w-[36px] rounded-full px-2 text-sm font-medium tabular-nums transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950',
              n === current
                ? 'bg-ink-950 text-white'
                : 'border border-ink-950/15 bg-white text-ink-700 hover:border-ink-950/40'
            )}
          >
            {n}
          </button>
        )
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={current >= total}
        onClick={() => onChange(current + 1)}
      >
        Next
      </Button>
    </nav>
  );
};

/* ==================================================================== misc */

/**
 * Avatar — initials, with the picture layered over them when one loads.
 *
 * The initials are the base layer rather than an either/or fallback. Seeded
 * accounts point at via.placeholder.com, a host that no longer resolves, and a
 * request to a dead host can hang instead of erroring — so an `onError`-only
 * fallback left an empty box for as long as the load was pending. This way the
 * tile always shows something, and the image simply covers it once decoded.
 */
export const Avatar = ({ src, name = '', size = 'md', className = '' }) => {
  const sizes = {
    xs: 'h-7 w-7 text-[10px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-16 w-16 text-lg'
  };
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt, otherwise one broken image would
  // permanently suppress every later one on the same mounted component.
  useEffect(() => setFailed(false), [src]);

  const initials = String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <span
      role="img"
      aria-label={name ? `${name}'s profile picture` : 'Profile picture'}
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl',
        'border border-ink-950/15 bg-ink-950 font-semibold text-white',
        sizes[size],
        className
      )}
    >
      {initials || '—'}
      {src && !failed && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
};

/** Definition row — a label/value pair, used across detail pages. */
export const DetailRow = ({ label, children, className = '' }) => (
  <div className={cx('flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4', className)}>
    <dt className="w-44 shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500 sm:pt-0.5">
      {label}
    </dt>
    <dd className="min-w-0 flex-1 text-sm text-ink-800">{children ?? '—'}</dd>
  </div>
);

/** Hairline separator. */
export const Divider = ({ className = '' }) => (
  <hr aria-hidden="true" className={cx('h-px border-0 bg-ink-950/10', className)} />
);

/** Toolbar above a list: search, filters, then actions. */
export const Toolbar = ({ children, className = '' }) => (
  <div
    className={cx(
      'mb-6 flex flex-col gap-3 rounded-2xl border border-ink-950/15 bg-white p-4 sm:flex-row sm:items-center',
      className
    )}
  >
    {children}
  </div>
);
