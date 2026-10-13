// client/src/components/forms/salary.js
//
// Pay as Indian recruiters actually write it. The job forms used to be
// `type="number"` inputs in raw rupees, so "6 LPA", "6,00,000" or "₹ 20k" could
// not even be typed (the browser rejects commas), and "6" was silently stored
// as six rupees a year. The API still takes whole rupees; the conversion
// happens here, with a preview under the field so the recruiter sees what will
// be published.

const UNITS = {
  lpa: 100000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  l: 100000,
  k: 1000,
  thousand: 1000,
  cr: 10000000,
  crore: 10000000,
  crores: 10000000
};

/**
 * Parse a pay figure into whole rupees.
 *
 * @param text      what was typed: "600000", "6,00,000", "6 LPA", "6.5L", "20k", "₹ 25,000"
 * @param annual    true for a yearly CTC. A bare number under 1000 is then read
 *                  as lakhs ("6" means 6 LPA, nobody is paid six rupees a year);
 *                  for a monthly stipend a bare number is taken as rupees.
 * @returns { value: number|null, error: string|null } — value null when empty.
 */
export const parseRupees = (text, { annual = true } = {}) => {
  const raw = String(text ?? '').trim();
  if (!raw) return { value: null, error: null };

  const cleaned = raw
    .toLowerCase()
    .replace(/₹|rs\.?|inr/g, '')
    .replace(/\/\s*(yr|year|annum|month|mo)\b/g, '')
    .replace(/\b(per\s*(annum|year|month)|a\s*(year|month))\b/g, '')
    .replace(/\bp\.\s*a\.?/g, '')
    .replace(/,/g, '')
    .trim();

  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (!match) {
    return {
      error: annual
        ? 'Enter an amount like 600000, 6,00,000 or 6 LPA'
        : 'Enter an amount like 20000, 20,000 or 20k',
      value: null
    };
  }

  const amount = parseFloat(match[1]);
  const unit = match[2];
  let multiplier = 1;
  if (unit) {
    if (!UNITS[unit]) {
      return { error: 'Use LPA, lakh, k or crore after the number, or just the rupee amount', value: null };
    }
    multiplier = UNITS[unit];
  } else if (annual && amount < 1000) {
    multiplier = 100000;
  }

  const value = Math.round(amount * multiplier);
  // Mirrors MAX_SALARY on the server (100 crore). Past it is a typo — usually
  // an extra zero — and the database column could not hold much more anyway.
  if (value > 1000000000) {
    return { error: 'That amount looks too large. Check for an extra zero.', value: null };
  }
  return { value, error: null };
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** "6 LPA", "6.5 LPA" — trailing zeros dropped. */
const lpa = (n) => `${Number((n / 100000).toFixed(2))} LPA`;

/**
 * The line shown under a pay field: what the typed text will be saved as.
 * Empty when there is nothing (valid) to preview.
 */
export const describeRupees = (text, { annual = true } = {}) => {
  const { value, error } = parseRupees(text, { annual });
  if (error || value === null) return '';
  return annual ? `Saved as ${inr(value)} a year (${lpa(value)})` : `Saved as ${inr(value)} a month`;
};

/** A stored rupee figure as the form shows it again: "10,00,000". */
export const rupeesForInput = (value) =>
  value === null || value === undefined || value === '' ? '' : Number(value).toLocaleString('en-IN');

/**
 * The first day a new deadline may fall on: tomorrow, as YYYY-MM-DD in the
 * browser's own calendar. The server refuses today or earlier, so offering
 * today in the date picker only produced an error.
 */
export const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
