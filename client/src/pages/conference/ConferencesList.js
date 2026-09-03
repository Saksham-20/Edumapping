// client/src/pages/conference/ConferencesList.js
//
// The way into a live class. The whole conferencing backend — 15 endpoints,
// two tables, a LiveKit SFU — shipped with no UI that could list a session or
// create one, so `/conference/:id` was reachable only by typing an ID you had
// no way to obtain. This is that missing surface.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import conferenceService, { canHostConferences } from '../../services/conferences';
import { useAuth } from '../../contexts/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  PageShell,
  Select,
  SkeletonCard,
  Tabs,
  Textarea,
  cx
} from '../../components/ui';
import {
  VideoCameraIcon,
  PlusIcon,
  UserCircleIcon,
  CalendarIcon,
  SignalIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'upcoming', label: 'Upcoming & live' },
  { value: 'ended', label: 'Past' },
  { value: 'all', label: 'All' }
];

const STATUS_TONES = { live: 'danger', scheduled: 'info', ended: 'neutral' };

/** Formats a scheduled time, or says it is unscheduled. */
const formatWhen = (iso) => {
  if (!iso) return 'No scheduled time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No scheduled time';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const ConferenceCard = ({ conference, onJoin }) => {
  const isLive = conference.status === 'live';
  const hostName = conference.host
    ? `${conference.host.firstName} ${conference.host.lastName}`
    : 'Unknown host';

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink-950">{conference.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
            <UserCircleIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {hostName}
            {conference.organization ? ` · ${conference.organization.name}` : ''}
          </p>
        </div>
        <Badge tone={STATUS_TONES[conference.status] || 'neutral'} dot>
          {conference.status}
        </Badge>
      </div>

      {conference.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-600">{conference.description}</p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        <CalendarIcon aria-hidden="true" className="h-3.5 w-3.5" />
        {formatWhen(conference.scheduledStart)}
      </p>

      <div className="mt-5 flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant={isLive ? 'saffron' : 'secondary'}
          icon={isLive ? SignalIcon : VideoCameraIcon}
          onClick={() => onJoin(conference)}
          disabled={conference.status === 'ended'}
        >
          {isLive ? 'Join now' : conference.status === 'ended' ? 'Ended' : 'Open room'}
        </Button>
      </div>
    </Card>
  );
};

const ConferencesList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canHost = canHostConferences(user?.role);

  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduledStart: '',
    access: 'organization',
    maxParticipants: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `silent` so the shared axios interceptor does not also toast: this page
      // renders its own error state, and two notices for one failure is noise.
      const data = await conferenceService.list({}, { silent: true });
      setConferences(data.conferences || []);
    } catch (err) {
      // 503 is the documented "conferencing not provisioned" response, not a
      // fault — it deserves an explanation rather than a generic error.
      setError(
        err?.response?.status === 503
          ? {
              title: 'Live classes are not switched on yet',
              description:
                err?.response?.data?.message ||
                'This server has no LiveKit connection configured, so live sessions cannot run.'
            }
          : {
              title: 'Could not load live classes',
              description: err?.response?.data?.message || 'Something went wrong. Try again.'
            }
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (tab === 'all') return conferences;
    if (tab === 'ended') return conferences.filter((c) => c.status === 'ended');
    return conferences.filter((c) => c.status === 'scheduled' || c.status === 'live');
  }, [conferences, tab]);

  const counts = useMemo(
    () => ({
      upcoming: conferences.filter((c) => c.status !== 'ended').length,
      ended: conferences.filter((c) => c.status === 'ended').length,
      all: conferences.length
    }),
    [conferences]
  );

  const onCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.title.trim().length < 3) errs.title = 'Give the class a title of at least 3 characters';
    if (form.maxParticipants && Number(form.maxParticipants) < 2) {
      errs.maxParticipants = 'A session needs room for at least 2 people';
    }
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setCreating(true);
    try {
      const payload = {
        title: form.title.trim(),
        access: form.access
      };
      // Only send the optional fields when filled: the validators accept them
      // as absent or valid, but not as an empty string.
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.scheduledStart) payload.scheduledStart = new Date(form.scheduledStart).toISOString();
      if (form.maxParticipants) payload.maxParticipants = Number(form.maxParticipants);

      const data = await conferenceService.create(payload);
      toast.success('Live class created');
      setCreateOpen(false);
      setForm({ title: '', description: '', scheduledStart: '', access: 'organization', maxParticipants: '' });
      if (data?.conference?.id) navigate(`/conference/${data.conference.id}`);
      else load();
    } catch (err) {
      setFormErrors({
        title: err?.response?.data?.message || 'Could not create the class'
      });
    } finally {
      setCreating(false);
    }
  };

  const setField = (name) => (e) => {
    const { value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFormErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Live"
        title="Live classes"
        lead="Scheduled and in-progress sessions you can join."
        actions={
          canHost && (
            <Button icon={PlusIcon} onClick={() => setCreateOpen(true)}>
              New live class
            </Button>
          )
        }
      />

      {!loading && !error && conferences.length > 0 && (
        <Tabs
          className="mb-6 w-fit"
          value={tab}
          onChange={setTab}
          tabs={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
        />
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState title={error.title} description={error.description} onRetry={load} />
      )}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          icon={VideoCameraIcon}
          title={conferences.length === 0 ? 'No live classes yet' : 'Nothing in this view'}
          description={
            conferences.length === 0
              ? canHost
                ? 'Create one to start teaching. Students in your organization will see it here.'
                : 'When your institution schedules a live class, it will appear here.'
              : 'Try another tab.'
          }
          action={
            canHost && conferences.length === 0 ? (
              <Button icon={PlusIcon} onClick={() => setCreateOpen(true)}>
                New live class
              </Button>
            ) : (
              <Button as={Link} to="/dashboard" variant="secondary">
                Back to dashboard
              </Button>
            )
          }
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className={cx('grid gap-4 sm:grid-cols-2 lg:grid-cols-3')}>
          {visible.map((c) => (
            <ConferenceCard
              key={c.id}
              conference={c}
              onJoin={(conf) => navigate(`/conference/${conf.id}`)}
            />
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New live class"
        description="Students in your organization will be able to join."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-conference" loading={creating}>
              Create and open
            </Button>
          </>
        }
      >
        <form id="create-conference" onSubmit={onCreate} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={setField('title')}
            error={formErrors.title}
            placeholder="Aptitude prep — session 3"
          />
          <Textarea
            label="Description"
            rows={3}
            value={form.description}
            onChange={setField('description')}
            help="Optional. What you'll cover."
          />
          <Input
            label="Scheduled start"
            type="datetime-local"
            value={form.scheduledStart}
            onChange={setField('scheduledStart')}
            help="Leave empty to start immediately."
          />
          <Select
            label="Who can join"
            value={form.access}
            onChange={setField('access')}
            options={[
              { value: 'organization', label: 'Anyone in my organization' },
              { value: 'registered', label: 'Only students registered for the linked event' },
              { value: 'invite', label: 'Invite only' },
              { value: 'public', label: 'Anyone with the link' }
            ]}
          />
          <Input
            label="Participant limit"
            type="number"
            min={2}
            max={200}
            value={form.maxParticipants}
            onChange={setField('maxParticipants')}
            error={formErrors.maxParticipants}
            help="Optional. This server is sized for roughly 25–30 people at once."
          />
        </form>
      </Modal>
    </PageShell>
  );
};

export default ConferencesList;
