// client/src/pages/auth/EmailCodeField.js
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button, Input } from '../../components/ui';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Whether the server wants an emailed code before it will create an account.
 *
 * Registration never asked for one, so anybody could sign up with an address
 * they do not own — including one at a college's domain. The server now
 * requires the code whenever it can actually deliver email, and says so at
 * `GET /auth/config`; while email is not configured it still lets signup
 * through, so this screen must not insist on a code nobody can receive.
 *
 * Fails open to `false`: if the lookup itself fails, the server still enforces
 * the rule and its error message tells the user what is missing.
 */
export const useEmailVerificationRequired = () => {
  const [required, setRequired] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/config', { silent: true })
      .then((res) => {
        if (!cancelled) setRequired(Boolean(res?.emailVerificationRequired));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return required;
};

/** True when `code` looks like the six-digit code the server sends. */
export const isValidEmailCode = (code) => /^\d{6}$/.test(String(code || '').trim());

/**
 * "Send code" button plus the six-digit input for the registration OTP.
 * Rendered only when `useEmailVerificationRequired()` is true.
 */
const EmailCodeField = ({ email, value, onChange, error }) => {
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const emailLooksValid = /\S+@\S+\.\S+/.test(email || '');

  const sendCode = async () => {
    if (!emailLooksValid) {
      toast.error('Enter your email address first');
      return;
    }
    setSending(true);
    try {
      await api.post('/auth/register/send-otp', { email: email.trim() });
      setSentTo(email.trim());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('We sent a 6-digit code to your email');
    } catch (err) {
      // The api interceptor has already shown the server's message.
    } finally {
      setSending(false);
    }
  };

  // A code is bound to the address it was sent to; changing the email means
  // the earlier code will not verify.
  const sentToCurrent = sentTo && sentTo.toLowerCase() === (email || '').trim().toLowerCase();

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Email verification code"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={error}
            placeholder="6-digit code"
            className="tracking-widest"
          />
        </div>
        <Button
          variant="secondary"
          onClick={sendCode}
          disabled={sending || cooldown > 0}
          className="mt-7 shrink-0"
        >
          {sending
            ? 'Sending…'
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : sentToCurrent
                ? 'Resend code'
                : 'Send code'}
        </Button>
      </div>
      <p className="text-xs text-ink-500">
        {sentToCurrent
          ? `Code sent to ${sentTo}. It expires in a few minutes.`
          : 'We email you a code to confirm the address is yours.'}
      </p>
    </div>
  );
};

export default EmailCodeField;
