// client/src/pages/auth/registerKit.js
//
// Checks and error mapping shared by the three registration screens
// (Register, CollegeRegister, SchoolRegister). They used to carry their own
// copies, which drifted from what the server accepts: an email with the
// trailing space a phone keyboard adds passed here and failed there, and the
// server's reason never reached the form.
import { fieldErrorsFrom } from '../../services/api';

/** An email address, ignoring surrounding whitespace. */
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

/**
 * A phone number as people write it: "+91 98765 43210", "98765-43210",
 * "09876543210". Separators and the trunk 0 are ignored, as on the server.
 */
export const isPhone = (value) => {
  let digits = String(value || '').replace(/[\s\-().]/g, '');
  if (/^0\d{10}$/.test(digits)) digits = digits.slice(1);
  return /^[+]?[1-9]\d{5,15}$/.test(digits);
};

/** Trims every string in a payload except passwords. */
export const trimPayload = (data) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === 'string' && !/password/i.test(k) ? v.trim() : v
    ])
  );

// Server field names on the organization endpoint → this form's field names.
const ORG_FIELDS = {
  name: 'organizationName',
  domain: 'organizationDomain',
  contactEmail: 'organizationContactEmail',
  contactPhone: 'organizationContactPhone',
  website: 'organizationWebsite',
  address: 'organizationAddress'
};

/** Marks an error from creating the institution, so its fields map correctly. */
export const asOrgError = (error, fallback) => {
  const wrapped = new Error(error?.message || fallback);
  wrapped.fieldErrors = Object.fromEntries(
    Object.entries(fieldErrorsFrom(error)).map(([k, v]) => [ORG_FIELDS[k] || k, v])
  );
  return wrapped;
};

/** Form errors for a failed submit: each field's message plus a summary line. */
export const submitErrors = (error, fallback = 'Registration failed. Please try again.') => ({
  ...(error?.fieldErrors || fieldErrorsFrom(error)),
  submit: error?.message || fallback
});
