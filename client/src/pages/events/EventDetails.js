// client/src/pages/events/EventDetails.js
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { openMeetingLink, shareUrl } from '../../utils/helpers';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  Divider,
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
  CheckIcon
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
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = `${start.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })} – ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
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

  const fetchEvent = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/events/${id}`);
      setEvent(response.event || null);
      setIsRegistered(Boolean(response.event?.userRegistration));
    } catch (error) {
      toast.error('Event not found');
      navigate('/events');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) fetchEvent();
  }, [id, fetchEvent]);

  const isEventFull = () =>
    Boolean(event?.maxParticipants && (event.registrationCount || 0) >= event.maxParticipants);

  const isRegistrationOpen = () => {
    if (!event) return false;
    if (event.registrationDeadline) return new Date() <= new Date(event.registrationDeadline);
    return new Date() < new Date(event.startTime);
  };

  const canEdit =
    user && user.role !== 'student' && event?.organizationId === (user.organizationId || event?.organizationId);

  const handleRegister = async (register = true) => {
    if (!event?.id) return;
    try {
      setActionLoading(true);
      if (register) {
        await api.post(`/events/${event.id}/register`);
        setIsRegistered(true);
        toast.success('Successfully registered for this event!');
      } else {
        await api.post(`/events/${event.id}/cancel`);
        setIsRegistered(false);
        toast.success('Registration cancelled');
      }
      fetchEvent();
    } catch (error) {
      toast.error(register ? 'Failed to register' : 'Failed to cancel registration');
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
            <Button
              variant="secondary"
              icon={PencilSquareIcon}
              onClick={() => navigate(`/events/${event.id}/edit`)}
            >
              Edit event
            </Button>
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
            <DetailRow label="Closes">
              {new Date(event.registrationDeadline).toLocaleDateString()}
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
            <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
              About this event
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
              {event.description}
            </p>
          </>
        )}

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
          {event.virtualLink && (
            <Button variant="saffron" icon={LinkIcon} onClick={handleJoinMeeting}>
              Join meeting
            </Button>
          )}
          <Button variant="secondary" icon={ShareIcon} onClick={handleShare}>
            Share
          </Button>
        </div>
      </Card>
    </PageShell>
  );
};

export default EventDetails;
