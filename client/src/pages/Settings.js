// client/src/pages/Settings.js
//
// The header has linked to /settings since before this page existed, so the
// link silently bounced to the landing page via the catch-all. This gives it a
// destination, and gives the app a home for the account controls that the API
// already supported but nothing surfaced — password change in particular.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { describeApiError, fieldErrorsFrom } from '../services/api';
import { PasswordField } from './auth/authKit';
import { useAuth } from '../contexts/AuthContext';
import {
  Button,
  Card,
  CardHeader,
  DetailRow,
  Divider,
  PageHeader,
  PageShell,
  SectionBlock,
  Badge
} from '../components/ui';
import { KeyIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { formatRole } from '../components/common/navigation';

/** Mirrors the server's rule in routes/auth.js so the UI fails fast and local. */
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const STATUS_LABELS = {
  approved: 'Approved',
  pending: 'Waiting for approval',
  rejected: 'Not approved'
};

const Settings = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setField = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validate = () => {
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter your current password';
    if (!PASSWORD_RULE.test(form.newPassword)) {
      next.newPassword =
        'At least 8 characters, with an uppercase letter, a lowercase letter and a number';
    }
    if (form.newPassword && form.newPassword === form.currentPassword) {
      next.newPassword = 'Choose a password different from your current one';
    }
    if (form.confirmPassword !== form.newPassword) {
      next.confirmPassword = 'Passwords do not match';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      // Each reason goes under the field it is about. Everything used to land
      // under "Current password", so a too-weak new password read as if the
      // current one were wrong. A wrong current password has no field in the
      // response (it is not a validation failure), so it is placed there.
      //
      // A server or network failure is not about the current password, and
      // the API layer has already said so in a toast; printing it under the
      // field as well read as "your current password is wrong".
      const status = err?.status || err?.response?.status;
      if (!status || status >= 500) {
        setErrors({});
        return;
      }
      const fields = fieldErrorsFrom(err);
      setErrors(
        Object.keys(fields).length
          ? fields
          : { currentPassword: describeApiError(err) || 'Could not change your password. Try again.' }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        lead="Manage how you sign in and what the platform knows about you."
      />

      <SectionBlock title="Account">
        <Card>
          <CardHeader
            title="Your details"
            description="Edit these on your profile."
            actions={
              <Button as={Link} to="/profile" variant="secondary" size="sm" icon={UserCircleIcon}>
                Edit profile
              </Button>
            }
          />
          <Divider className="my-4" />
          <dl>
            <DetailRow label="Name">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
            </DetailRow>
            <DetailRow label="Email">{user?.email}</DetailRow>
            <DetailRow label="Phone">{user?.phone}</DetailRow>
            {/* The shared label ("TPO", "Career counselor"). CSS capitalize
                turned the raw role into "Tpo". */}
            <DetailRow label="Role">{formatRole(user?.role)}</DetailRow>
            <DetailRow label="Organization">{user?.organization?.name}</DetailRow>
            <DetailRow label="Status">
              <Badge tone={user?.approvalStatus === 'approved' ? 'success' : 'warning'} dot>
                {STATUS_LABELS[user?.approvalStatus] || 'Unknown'}
              </Badge>
            </DetailRow>
          </dl>
        </Card>
      </SectionBlock>

      <SectionBlock title="Security">
        <Card>
          <CardHeader
            title="Change password"
            description="You will stay signed in on this device."
          />
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            {/*
              A hidden username field so a password manager can associate the
              new credentials with the right account. Without it, browsers
              either skip the save prompt or file it under the wrong entry.
            */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user?.email || ''}
              readOnly
              hidden
            />
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={setField('currentPassword')}
              error={errors.currentPassword}
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
            <div className="flex justify-end pt-1">
              <Button type="submit" loading={saving} icon={KeyIcon}>
                Change password
              </Button>
            </div>
          </form>
        </Card>
      </SectionBlock>
    </PageShell>
  );
};

export default Settings;
