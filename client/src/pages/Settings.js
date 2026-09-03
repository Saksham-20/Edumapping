// client/src/pages/Settings.js
//
// The header has linked to /settings since before this page existed, so the
// link silently bounced to the landing page via the catch-all. This gives it a
// destination, and gives the app a home for the account controls that the API
// already supported but nothing surfaced — password change in particular.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Button,
  Card,
  CardHeader,
  DetailRow,
  Divider,
  Input,
  PageHeader,
  PageShell,
  SectionBlock,
  Badge
} from '../components/ui';
import { KeyIcon, UserCircleIcon } from '@heroicons/react/24/outline';

/** Mirrors the server's rule in routes/auth.js so the UI fails fast and local. */
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

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
      // The API's own message is the useful one here ("Current password is
      // incorrect"), and the axios interceptor has already toasted it — so
      // surface it against the field rather than toasting a second time.
      const message =
        err?.response?.data?.message || err?.response?.data?.error || 'Could not change password';
      setErrors({ currentPassword: message });
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
            <DetailRow label="Role">
              <span className="capitalize">{user?.role?.replace(/_/g, ' ')}</span>
            </DetailRow>
            <DetailRow label="Organization">{user?.organization?.name}</DetailRow>
            <DetailRow label="Status">
              <Badge tone={user?.approvalStatus === 'approved' ? 'success' : 'warning'} dot>
                {user?.approvalStatus || 'unknown'}
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
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={setField('currentPassword')}
              error={errors.currentPassword}
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
