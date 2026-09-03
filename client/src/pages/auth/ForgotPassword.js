// client/src/pages/auth/ForgotPassword.js
//
// The login screens have linked to /forgot-password since before this page
// existed, so the link bounced silently to the landing page. The server side
// has been complete the whole time — `POST /auth/forgot-password/send-otp` and
// `/reset-with-otp`, backed by the `otp_verifications` table — with nothing
// calling it. This is that missing UI.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button, Card, Input } from '../../components/ui';
import { ArrowLeftIcon, EnvelopeIcon, KeyIcon } from '@heroicons/react/24/outline';

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

  const setField = (name) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Enter a valid email address' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/forgot-password/send-otp', { email });
      // Deliberately not confirming whether the address exists: that would let
      // anyone probe the platform for registered emails.
      toast.success('If that account exists, a code is on its way');
      setStep('reset');
    } catch (err) {
      setErrors({
        email: err?.response?.data?.message || 'Could not send the code. Try again in a moment.'
      });
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
      setErrors({
        otp: err?.response?.data?.message || 'That code is not valid or has expired'
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bone-50 px-5 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-950"
        >
          <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
          Back to sign in
        </Link>

        <Card>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
            {step === 'request' ? 'Step 1 of 2' : 'Step 2 of 2'}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-950">
            {step === 'request' ? 'Reset your password' : 'Enter your code'}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {step === 'request'
              ? 'We’ll email you a six-digit code to confirm it’s you.'
              : `We sent a six-digit code to ${email}. It expires shortly.`}
          </p>

          {step === 'request' ? (
            <form onSubmit={sendOtp} className="mt-6 space-y-4">
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
            <form onSubmit={resetPassword} className="mt-6 space-y-4">
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
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                required
                value={form.newPassword}
                onChange={setField('newPassword')}
                error={errors.newPassword}
                help="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
              />
              <Input
                label="Confirm new password"
                type="password"
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
    </main>
  );
};

export default ForgotPassword;
