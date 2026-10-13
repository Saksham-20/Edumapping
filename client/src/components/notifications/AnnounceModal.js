// client/src/components/notifications/AnnounceModal.js
//
// "Send announcement" — a placement officer or admin telling people something
// through the platform rather than a WhatsApp group.
//
// The audience is resolved on the server (POST /notifications/announce/preview)
// and the count is shown before sending, so "this reaches 412 students" is
// known before the button is pressed, not after. A TPO's audience is always
// their own students; the organisation and role controls are admin-only and
// the server ignores them for a TPO anyway.
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Badge, Button, Checkbox, Input, Modal, Select, Textarea } from '../ui';
import { MegaphoneIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

const ADMIN_ROLES = [
  { value: 'all', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'tpo', label: 'Placement officers' },
  { value: 'recruiter', label: 'Recruiters' },
  { value: 'principal', label: 'Principals' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'school_admin', label: 'School admins' },
  { value: 'career_counselor', label: 'Career counsellors' }
];

const EMPTY = {
  title: '',
  message: '',
  priority: 'medium',
  sendEmail: false,
  graduationYear: '',
  branch: '',
  organizationId: '',
  role: 'all'
};

const AnnounceModal = ({ open, onClose, role }) => {
  const isAdmin = role === 'admin';
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setErrors({});
    setPreview(null);
  }, [open]);

  useEffect(() => {
    if (!open || !isAdmin || organizations.length) return;
    api
      .get('/admin/organizations', { params: { limit: 500 }, silent: true })
      .then((body) => setOrganizations(body.organizations || []))
      .catch(() => setOrganizations([]));
  }, [open, isAdmin, organizations.length]);

  const audience = useMemo(() => {
    const a = {};
    if (form.graduationYear) a.graduationYear = Number(form.graduationYear);
    if (form.branch.trim()) a.branch = form.branch.trim();
    if (isAdmin) {
      if (form.organizationId) a.organizationId = Number(form.organizationId);
      a.role = form.role;
    }
    return a;
  }, [form.graduationYear, form.branch, form.organizationId, form.role, isAdmin]);

  // Re-resolve the audience a moment after the filters settle.
  useEffect(() => {
    if (!open) return undefined;
    if (form.graduationYear && !/^\d{4}$/.test(form.graduationYear)) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    setPreviewing(true);
    const t = setTimeout(() => {
      api
        .post('/notifications/announce/preview', { audience }, { silent: true })
        .then((body) => !cancelled && setPreview(body))
        .catch((err) => !cancelled && setPreview({ error: err?.message || 'Could not resolve the audience' }))
        .finally(() => !cancelled && setPreviewing(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, audience, form.graduationYear]);

  const set = (name) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.title.trim().length < 3) next.title = 'At least 3 characters.';
    if (form.title.trim().length > 120) next.title = '120 characters at most.';
    if (form.message.trim().length < 3) next.message = 'At least 3 characters.';
    if (form.message.trim().length > 2000) next.message = '2000 characters at most.';
    if (form.graduationYear && !/^\d{4}$/.test(form.graduationYear)) next.graduationYear = 'A four-digit year.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const send = async () => {
    if (!validate()) return;
    if (preview && preview.recipients === 0) {
      toast.error('Nobody matches this audience.');
      return;
    }
    setSending(true);
    try {
      const body = await api.post(
        '/notifications/announce',
        {
          title: form.title.trim(),
          message: form.message.trim(),
          priority: form.priority,
          sendEmail: form.sendEmail,
          audience
        },
        { silent: true }
      );
      toast.success(body.message || 'Announcement sent');
      if (form.sendEmail && body.email?.skipped) toast(body.email.skipped);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not send the announcement.');
    } finally {
      setSending(false);
    }
  };

  const recipients = preview?.recipients;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Send announcement"
      description={
        isAdmin
          ? 'An in-app notification to everyone, an organization, or one role.'
          : 'An in-app notification to your students. Narrow it by batch or branch.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={MegaphoneIcon}
            loading={sending}
            disabled={previewing || recipients === 0 || Boolean(preview?.error)}
            onClick={send}
          >
            {typeof recipients === 'number'
              ? `Send to ${recipients} ${recipients === 1 ? 'person' : 'people'}`
              : 'Send'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          required
          maxLength={120}
          value={form.title}
          onChange={set('title')}
          error={errors.title}
          placeholder="e.g. TCS drive moved to 10:00 on Friday"
        />
        <Textarea
          label="Message"
          required
          rows={5}
          maxLength={2000}
          value={form.message}
          onChange={set('message')}
          error={errors.message}
          help={`${form.message.length}/2000`}
        />

        <fieldset className="rounded-2xl border border-ink-950/15 p-4">
          <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-500">
            Audience
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {isAdmin && (
              <>
                <Select
                  label="Who"
                  value={form.role}
                  onChange={set('role')}
                  options={ADMIN_ROLES}
                  help={form.graduationYear || form.branch ? 'Batch and branch filters apply to students only.' : undefined}
                />
                <Select
                  label="Organization"
                  value={form.organizationId}
                  onChange={set('organizationId')}
                  options={[
                    { value: '', label: 'All organizations' },
                    ...organizations.map((o) => ({ value: String(o.id), label: `${o.name} (${o.type})` }))
                  ]}
                />
              </>
            )}
            <Input
              label="Graduation year"
              inputMode="numeric"
              placeholder="Any"
              value={form.graduationYear}
              onChange={set('graduationYear')}
              error={errors.graduationYear}
            />
            <Input label="Branch" placeholder="Any, e.g. Mechanical" value={form.branch} onChange={set('branch')} />
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-700" aria-live="polite">
            <UserGroupIcon aria-hidden="true" className="h-4 w-4 text-ink-500" />
            {previewing ? (
              'Counting recipients…'
            ) : preview?.error ? (
              <span className="text-red-700">{preview.error}</span>
            ) : preview ? (
              <>
                <Badge tone={recipients ? 'info' : 'danger'}>{recipients}</Badge>
                <span>{preview.description}</span>
              </>
            ) : (
              'Enter a valid year to count recipients.'
            )}
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Priority" value={form.priority} onChange={set('priority')} options={PRIORITIES} />
          <div className="sm:pt-7">
            <Checkbox
              checked={form.sendEmail}
              onChange={set('sendEmail')}
              label="Also send by email"
              description="Only if email delivery is configured on the server."
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AnnounceModal;
