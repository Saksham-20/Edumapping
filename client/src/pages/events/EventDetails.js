// client/src/pages/events/EventDetails.js
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { openMeetingLink, shareUrl } from '../../utils/helpers';
import AttendeesPanel from '../../components/events/AttendeesPanel';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  Divider,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  PageShell,
  PageLoader,
  StatusBadge
} from '../../components/ui';
import {
  CalendarIcon,
  UserGroupIcon,
  PencilSquareIcon,
  ShareIcon,
  LinkIcon,
  CheckIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

/** Event type → badge tone. Mirrors the table on the events list. */
const TYPE_TONES = {
  campus_drive: 'info',
  info_session: 'success',
  workshop: 'purple',
  seminar: 'warning',
  job_fair: 'danger',
  other: 'neutral'
};

const formatEventTime = (startTime, endTime) => {
  if (!startTime || !endTime) return { dateStr: '', timeStr: '' };
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dateStr = start.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = `${start.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  })} – ${end.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
  return { dateStr, timeStr };
};

const EventDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // 'missing' (404) or 'failed' (network/server). The page used to toast
  // "Event not found" and bounce to the list for both, so a dropped
  // connection on a phone read as a deleted event.
  const [loadError, setLoadError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchEvent = useCallback(async ({ quiet = false } = {}) => {
    try {
      // A refresh after registering keeps the page on screen instead of
      // flashing the loader.
      if (!quiet) setIsLoading(true);
      setLoadError(null);
      const response = await api.get(`/events/${id}`, { silent: true });
      setEvent(response.event || null);
      setIsRegistered(Boolean(response.event?.userRegistration));
    } catch (error) {
      setLoadError(error?.status === 404 ? 'missing' : 'failed');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchEvent();
  }, [id, fetchEvent]);

  const isEventFull = () =>
    Boolean(event?.maxParticipants && (event.registrationCount || 0) >= event.maxParticipants);

  // Same rule as the server: published events only, until the deadline or
  // (without one) the start.
  const isRegistrationOpen = () => {
    if (!event) return false;
    if (event.status && event.status !== 'scheduled') return false;
    if (event.registrationDeadline) return new Date() <= new Date(event.registrationDeadline);
    return new Date() < new Date(event.startTime);
  };

  // Who runs this event and may take its register: an admin, or non-student
  // staff of the organizing organization (TPO, school staff, the recruiter
  // whose company is hosting). Mirrors the server's own check on
  // /events/:id/registrations — which, unlike `canEdit` above, does not let
  // an admin-less account with no organization through.
  // Editing and deleting follow the same rule. The old `canEdit` let any
  // non-student without an organization through and showed them a button the
  // server then refused.
  const canManageAttendance = Boolean(
    user &&
      event &&
      (user.role === 'admin' ||
        (user.role !== 'student' && user.organizationId && event.organizationId === user.organizationId))
  );

  const canEdit = canManageAttendance;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/events/${event.id}`, { silent: true });
      toast.success('Event deleted');
      navigate('/events');
    } catch (error) {
      // 409 carries the useful instruction (cancel instead of delete).
      toast.error(error?.message || 'Could not delete the event. Try again.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleRegister = async (register = true) => {
    if (!event?.id || actionLoading) return;
    try {
      setActionLoading(true);
      if (register) {
        // `silent`: the catch below shows the one toast (the server's reason,
        // e.g. "Event Full"), instead of the interceptor's plus ours.
        await api.post(`/events/${event.id}/register`, {}, { silent: true });
        setIsRegistered(true);
        toast.success('Successfully registered for this event!');
      } else {
        await api.post(`/events/${event.id}/cancel`, {}, { silent: true });
        setIsRegistered(false);
        toast.success('Registration cancelled');
      }
      fetchEvent({ quiet: true });
    } catch (error) {
      toast.error(
        error?.message ||
          (register ? 'Could not register. Try again.' : 'Could not cancel your registration. Try again.')
      );
      fetchEvent({ quiet: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${event?.id}`;
    const result = await shareUrl({
      title: event?.title || 'Campus Event',
      text: event?.title ? `Join: ${event.title}` : 'Check out this event',
      url
    });
    if (result?.shared) toast.success('Shared');
    else if (result?.copied) toast.success('Link copied');
    else toast.error('Could not share');
  };

  const handleJoinMeeting = () => {
    if (!event?.virtualLink) return;
    const ok = openMeetingLink(event.virtualLink);
    if (!ok) toast.error('Invalid meeting link');
  };

  if (!isLoading && loadError === 'missing') {
    return (
      <PageShell width="narrow">
        <EmptyState
          title="Event not found"
          description="It may have been deleted, or it belongs to an institution you are not part of."
          action={
            <Button variant="secondary" onClick={() => navigate('/events')}>
              See all events
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (!isLoading && loadError === 'failed') {
    return (
      <PageShell width="narrow">
        <ErrorState
          title="Could not load this event"
          description="Check your internet connection and try again."
          onRetry={() => fetchEvent()}
        />
      </PageShell>
    );
  }

  if (isLoading || !event) {
    return (
      <PageShell width="narrow">
        <PageLoader label="Loading event" />
      </PageShell>
    );
  }

  const { dateStr, timeStr } = formatEventTime(event.startTime, event.endTime);
  const full = isEventFull();
  const registrationOpen = isRegistrationOpen();
  const canRegister = user?.role === 'student' && registrationOpen && !full;
  const ended = Boolean(event.endTime) && new Date(event.endTime) < new Date();
  const cancelled = event.status === 'cancelled';
  // Why a student cannot register, in words, instead of a missing button.
  const closedReason =
    user?.role === 'student' && !isRegistered && !canRegister
      ? cancelled
        ? 'This event has been cancelled.'
        : ended
        ? 'This event is over.'
        : full && registrationOpen
        ? 'This event is full. All seats have been taken.'
        : 'Registration for this event has closed.'
      : null;
  const isGlobal = (event.organization?.name || '').toLowerCase() === 'edumapping';

  return (
    <PageShell width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: 'Events', to: '/events' },
          { label: event.title }
        ]}
        eyebrow={event.organization?.name || 'Event'}
        title={event.title}
        actions={
          canEdit && (
            <>
              <Button
                variant="secondary"
                icon={PencilSquareIcon}
                onClick={() => navigate(`/events/${event.id}/edit`)}
              >
                Edit event
              </Button>
              <Button variant="secondary" icon={TrashIcon} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONES[event.eventType] || 'neutral'}>
            {String(event.eventType || 'other').replace(/_/g, ' ')}
          </Badge>
          {isGlobal && <Badge tone="purple">Global</Badge>}
          {event.status && <StatusBadge status={event.status} />}
          {isRegistered && (
            <Badge tone="success">
              <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
              You are registered
            </Badge>
          )}
        </div>

        <Divider className="my-5" />

        <dl>
          {dateStr && (
            <DetailRow label="When">
              <span className="flex items-center gap-2">
                <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
                <span>
                  {dateStr}
                  {timeStr && <span className="block text-ink-600">{timeStr}</span>}
                </span>
              </span>
            </DetailRow>
          )}
          {event.location && <DetailRow label="Where">{event.location}</DetailRow>}
          <DetailRow label="Registrations">
            <span className="flex items-center gap-2 tabular-nums">
              <UserGroupIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
              {event.registrationCount ?? 0}
              {event.maxParticipants ? ` / ${event.maxParticipants}` : ''} registered
              {full && <span className="font-semibold text-red-700">Full</span>}
            </span>
          </DetailRow>
          {event.registrationDeadline && (
            <DetailRow label="Registration closes">
              {new Date(event.registrationDeadline).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </DetailRow>
          )}
          {event.contactEmail && (
            <DetailRow label="Contact">
              <a className="underline hover:text-ink-950" href={`mailto:${event.contactEmail}`}>
                {event.contactEmail}
              </a>
            </DetailRow>
          )}
          {event.contactPhone && <DetailRow label="Phone">{event.contactPhone}</DetailRow>}
        </dl>

        {event.description && (
          <>
            <Divider className="my-5" />
            <h2 className="text-[11px] font-medium uppercase tracking-[0.07em] text-ink-500">
              About this event
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
              {event.description}
            </p>
          </>
        )}

        {closedReason && <p className="mt-6 text-sm font-medium text-ink-700">{closedReason}</p>}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-ink-950/10 pt-5">
          {canRegister && (
            <Button
              onClick={() => handleRegister(true)}
              loading={actionLoading && !isRegistered}
              disabled={isRegistered}
            >
              {isRegistered ? 'Registered' : 'Register for this event'}
            </Button>
          )}
          {user?.role === 'student' && isRegistered && registrationOpen && (
            <Button variant="secondary" onClick={() => handleRegister(false)} loading={actionLoading}>
              Cancel registration
            </Button>
          )}
          {event.virtualLink && !ended && !cancelled && (
            <Button variant="saffron" icon={LinkIcon} onClick={handleJoinMeeting}>
              Join meeting
            </Button>
          )}
          <Button variant="secondary" icon={ShareIcon} onClick={handleShare}>
            Share
          </Button>
        </div>
      </Card>

      {canManageAttendance && <AttendeesPanel event={event} />}

      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        title="Delete this event?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Keep event
            </Button>
            {event.registrationCount ? (
              <Button onClick={() => navigate(`/events/${event.id}/edit`)}>Edit and cancel instead</Button>
            ) : (
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete event
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-700">
          {event.registrationCount
            ? `${event.registrationCount} ${event.registrationCount === 1 ? 'person has' : 'people have'} registered. You cannot delete an event people signed up for. Edit it and set the status to Cancelled instead, so they can see it is not happening.`
            : 'It will be removed for everyone. This cannot be undone.'}
        </p>
      </Modal>
    </PageShell>
  );
};

export default EventDetails;
