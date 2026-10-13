// client/src/pages/auth/ForgotPassword.js
//
// The login screens have linked to /forgot-password since before this page
// existed, so the link bounced silently to the landing page. The server side
// has been complete the whole time — `POST /auth/forgot-password/send-otp` and
// `/reset-with-otp`, backed by the `otp_verifications` table — with nothing
// calling it. This is that missing UI.
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { describeApiError, fieldErrorsFrom } from '../../services/api';
import { Button, Card, Input } from '../../components/ui';
import { ArrowLeftIcon, EnvelopeIcon, KeyIcon } from '@heroicons/react/24/outline';
import { AuthShell, PasswordField } from './authKit';

const SUPPORT_EMAIL = 'support@edumapping.com';

/**
 * Whether this server can email a code at all. Without SMTP the request
 * "succeeded" and the page promised a code that never came, so a student who
 * forgot their password waited for an email that was never sent. `null` while
 * the lookup is in flight; a failed lookup assumes email works, since the
 * screen is still usable then.
 */
const useEmailEnabled = () => {
  const [enabled, setEnabled] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/config', { silent: true })
      .then((res) => {
        if (!cancelled) setEnabled(res?.emailEnabled ?? res?.emailVerificationRequired ?? true);
      })
      .catch(() => !cancelled && setEnabled(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
};

/** Mirrors the server's password rule so the form fails fast and locally. */
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const ForgotPassword = () => {
  const navigate = useNavigate();
  // Two steps rather than two routes: the OTP is only meaningful alongside the
  // email that requested it, and a route change would lose that pairing on a
  // refresh.
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ otp: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const emailEnabled = useEmailEnabled();
  // On a developer machine the code is written to the API log instead, so
  // the flow stays testable; everywhere else the form is replaced by help.
  const canUseCodes = emailEnabled !== false || process.env.NODE_ENV === 'development';

  const setField = (name) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const sendOtp = async (e) => {
    e?.preventDefault();
    // Phone keyboards add a trailing space after autocomplete.
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setErrors({ email: 'Enter the email address you registered with, such as name@gmail.com' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/forgot-password/send-otp', { email: address });
      setEmail(address);
      // Deliberately not confirming whether the address exists: that would let
      // anyone probe the platform for registered emails.
      toast.success('If that account exists, a code is on its way');
      setStep('reset');
    } catch (err) {
      setErrors({ email: describeApiError(err) || 'Could not send the code. Try again in a moment.' });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^\d{6}$/.test(form.otp)) next.otp = 'Enter the 6-digit code from your email';
    if (!PASSWORD_RULE.test(form.newPassword)) {
      next.newPassword =
        'At least 8 characters, with an uppercase letter, a lowercase letter and a number';
    }
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api.post('/auth/forgot-password/reset-with-otp', {
        email,
        otp: form.otp,
        newPassword: form.newPassword
      });
      toast.success('Password reset. Sign in with your new password.');
      navigate('/login');
    } catch (err) {
      // Put each reason under its own field: a password-rule message used to
      // land under the code box, which made the code look wrong.
      const fields = fieldErrorsFrom(err);
      setErrors(
        Object.keys(fields).length
          ? fields
          : { otp: describeApiError(err) || 'That code is wrong or has expired. Ask for a new one.' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div>
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-950"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          Back to sign in
        </Link>

        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-ink-500">
            {!canUseCodes ? 'Account help' : step === 'request' ? 'Step 1 of 2' : 'Step 2 of 2'}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950">
            {step === 'request' ? 'Reset your password' : 'Enter your code'}
          </h1>
          {emailEnabled !== false && (
            <p className="mt-2 text-sm text-ink-600">
              {step === 'request'
                ? 'We’ll email you a six-digit code to confirm it’s you.'
                : `If ${email} has an EduMapping account, we sent it a six-digit code. It expires in 10 minutes. Check your spam folder too.`}
            </p>
          )}

          {emailEnabled === false && (
            <div
              role="note"
              className="mt-5 rounded-[10px] border border-saffron-500/40 bg-saffron-50 px-4 py-3 text-sm text-saffron-900"
            >
              <p className="font-medium">Reset codes can’t be emailed right now.</p>
              <p className="mt-1">
                Write to{' '}
                <a
                  className="font-medium underline underline-offset-2"
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Please reset my EduMapping password')}`}
                >
                  {SUPPORT_EMAIL}
                </a>{' '}
                from the email address you registered with, and mention your college. We will reset
                your password and reply with a temporary one.
              </p>
              {canUseCodes && (
                <p className="mt-2 text-xs text-saffron-800">
                  Development build: the code is written to the API log instead of being emailed.
                </p>
              )}
            </div>
          )}

          {!canUseCodes ? null : step === 'request' ? (
            <form onSubmit={sendOtp} className="mt-6 space-y-4" noValidate>
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({});
                }}
                error={errors.email}
                icon={EnvelopeIcon}
              />
              <Button type="submit" fullWidth size="lg" loading={busy}>
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="mt-6 space-y-4" noValidate>
              <Input
                label="Six-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={form.otp}
                // Strip anything non-numeric as it is typed, so a pasted code
                // with stray spaces still validates.
                onChange={(e) =>
                  setField('otp')({ target: { value: e.target.value.replace(/\D/g, '') } })
                }
                error={errors.otp}
                className="font-mono tracking-[0.4em]"
              />
              <PasswordField
                label="New password"
                autoComplete="new-password"
                required
                value={form.newPassword}
                onChange={setField('newPassword')}
                error={errors.newPassword}
                help="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
              />
              <PasswordField
                label="Confirm new password"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={setField('confirmPassword')}
                error={errors.confirmPassword}
              />
              <Button type="submit" fullWidth size="lg" loading={busy} icon={KeyIcon}>
                Reset password
              </Button>
              <div className="flex items-center justify-between pt-1 text-sm">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="font-medium text-ink-600 underline-offset-2 hover:text-ink-950 hover:underline"
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={busy}
                  className="font-medium text-ink-600 underline-offset-2 hover:text-ink-950 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </AuthShell>
  );
};

export default ForgotPassword;
