// client/src/pages/events/Events.js
//
// The events list. Search and pagination are driven by the URL rather than
// local state: the app header's search box navigates to `/events?search=…`,
// so anything that only lived in component state was invisible to it — the
// header search silently did nothing.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { openMeetingLink, shareUrl } from '../../utils/helpers';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  Pagination,
  SkeletonCard,
  StatusBadge,
  Tabs,
  Toolbar
} from '../../components/ui';
import {
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  ClockIcon,
  BuildingOfficeIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ShareIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 12;

/** Event type → badge tone. One table so the card and the filter agree. */
const TYPE_TONES = {
  campus_drive: 'info',
  info_session: 'success',
  workshop: 'purple',
  seminar: 'warning',
  job_fair: 'danger',
  other: 'neutral'
};

const EVENT_TIPS = [
  'Prepare questions about the company and the roles on offer',
  'Bring copies of your resume and dress professionally',
  'Network with recruiters and with other students',
  'Follow up with the connections you make',
  'Take notes during presentations and workshops',
  'Register early — popular events fill up quickly'
];

const TYPE_ICONS = {
  campus_drive: BuildingOfficeIcon,
  info_session: UserGroupIcon,
  workshop: ClockIcon,
  seminar: CalendarIcon,
  job_fair: BuildingOfficeIcon,
  other: CalendarIcon
};

const formatEventTime = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeStr = `${start.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })} – ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  return { dateStr, timeStr };
};

const isEventFull = (event) =>
  Boolean(event.maxParticipants && (event.registrationCount || 0) >= event.maxParticipants);

const isRegistrationOpen = (event) => {
  if (event.registrationDeadline) return new Date() <= new Date(event.registrationDeadline);
  return new Date() < new Date(event.startTime);
};

const EventCard = ({ event, isStudent, isRegistered, onRegister, onCancel }) => {
  const { dateStr, timeStr } = formatEventTime(event.startTime, event.endTime);
  const TypeIcon = TYPE_ICONS[event.eventType] || TYPE_ICONS.other;
  const full = isEventFull(event);
  const open = isRegistrationOpen(event);
  const canRegister = open && !full;
  const isGlobal = (event.organization?.name || '').toLowerCase() === 'edumapping';

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${event.id}`;
    const result = await shareUrl({
      title: event.title || 'Campus Event',
      text: event.title ? `Join: ${event.title}` : 'Check out this event',
      url
    });
    if (result.shared) toast.success('Shared');
    else if (result.copied) toast.success('Link copied');
    else toast.error('Could not share');
  };

  const handleJoin = () => {
    if (!event.virtualLink) return;
    const ok = openMeetingLink(event.virtualLink);
    if (!ok) toast.error('Invalid meeting link');
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONES[event.eventType] || 'neutral'}>
            {String(event.eventType || 'other').replace(/_/g, ' ')}
          </Badge>
          {isGlobal && <Badge tone="purple">Global</Badge>}
          {event.status && event.status !== 'scheduled' && <StatusBadge status={event.status} />}
        </div>
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-950/15 bg-bone-100 text-ink-700"
        >
          <TypeIcon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      </div>

      <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-ink-950">
        <Link
          to={`/events/${event.id}`}
          className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
        >
          {event.title}
        </Link>
      </h3>

      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
        <BuildingOfficeIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
        <span className="truncate">{event.organization?.name || 'Unknown organization'}</span>
      </p>

      {event.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-600">{event.description}</p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-1.5 text-sm text-ink-700 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Date</dt>
          <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
          <dd className="truncate">{dateStr}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Time</dt>
          <ClockIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
          <dd className="truncate">{timeStr}</dd>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <dt className="sr-only">Location</dt>
            <MapPinIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
            <dd className="truncate">{event.location}</dd>
          </div>
        )}
        <div className="flex items-center gap-2 sm:col-span-2">
          <dt className="sr-only">Registrations</dt>
          <UserGroupIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
          <dd className="tabular-nums">
            {event.registrationCount || 0}
            {event.maxParticipants ? ` / ${event.maxParticipants}` : ''} registered
            {full && <span className="ml-2 font-semibold text-red-700">Full</span>}
          </dd>
        </div>
        {event.registrationDeadline && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <dt className="sr-only">Registration deadline</dt>
            <ClockIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-saffron-600" />
            <dd className="text-saffron-800">
              Registration closes {new Date(event.registrationDeadline).toLocaleDateString()}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-ink-950/10 pt-4">
        <div>
          {isRegistered && (
            <Badge tone="success">
              <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
              Registered
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="secondary" icon={ShareIcon} onClick={handleShare}>
            Share
          </Button>

          {isStudent &&
            (isRegistered ? (
              <Button
                size="sm"
                variant="secondary"
                icon={XMarkIcon}
                onClick={() => onCancel(event.id)}
              >
                Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                icon={PlusIcon}
                disabled={!canRegister}
                onClick={() => onRegister(event.id)}
              >
                {full ? 'Full' : !open ? 'Closed' : 'Register'}
              </Button>
            ))}

          {event.virtualLink && (
            <Button size="sm" variant="saffron" icon={VideoCameraIcon} onClick={handleJoin}>
              Join
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const Events = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [events, setEvents] = useState([]);
  const [pageCount, setPageCount] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [registeredEvents, setRegisteredEvents] = useState(new Set());
  // The visible value of the search box. It leads the URL by one debounce
  // interval, so typing stays responsive while the fetch does not fire per key.
  const [searchDraft, setSearchDraft] = useState(search);

  const isStudent = user?.role === 'student';

  // A search arriving from elsewhere (the header's box, a shared link, the back
  // button) has to show up in the field as well as in the query.
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  /** Rewrites the query string, always resetting to page 1 unless paging. */
  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === '' || value == null) next.delete(key);
            else next.set(key, String(value));
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (searchDraft === search) return undefined;
    const t = setTimeout(() => updateParams({ search: searchDraft, page: null }), 350);
    return () => clearTimeout(t);
  }, [searchDraft, search, updateParams]);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Students should only see scheduled events in Upcoming.
      // Non-students may create drafts; include them in Upcoming so creators can
      // find their events.
      const statusParam = filter === 'upcoming' ? (isStudent ? 'scheduled' : 'all') : 'all';

      const params = new URLSearchParams({
        upcoming: filter === 'upcoming' ? 'true' : 'false',
        status: statusParam,
        page: String(page),
        limit: String(PAGE_SIZE)
      });
      if (search) params.set('search', search);

      const response = await api.get(`/events?${params}`, { silent: true });
      const list = response.events || [];
      setEvents(list);

      // `totalPages` is derived server-side from a join-inflated row count, so
      // it can claim pages that come back empty. A short page is always the
      // last one, whatever the server says.
      const reported = Number(response.pagination?.totalPages) || 1;
      setPageCount(list.length < PAGE_SIZE ? page : Math.max(reported, page));

      const registered = new Set();
      list.forEach((event) => {
        if (event.userRegistration) registered.add(event.id);
      });
      setRegisteredEvents(registered);
    } catch (err) {
      // The axios interceptor rejects with a plain `{ message, status, data }`,
      // not an axios error — there is no `err.response` to read here.
      setError(err?.message || 'Something went wrong loading events.');
    } finally {
      setIsLoading(false);
    }
  }, [filter, page, search, isStudent]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleEventRegistration = async (eventId, isRegistering = true) => {
    try {
      if (isRegistering) {
        await api.post(`/events/${eventId}/register`);
        setRegisteredEvents((prev) => new Set([...prev, eventId]));
        toast.success('Successfully registered for event!');
      } else {
        await api.post(`/events/${eventId}/cancel`);
        setRegisteredEvents((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
        toast.success('Registration cancelled successfully');
      }
      // Refresh so the registration count on the card is current.
      fetchEvents();
    } catch (err) {
      toast.error(isRegistering ? 'Failed to register for event' : 'Failed to cancel registration');
    }
  };

  const tabs = useMemo(() => {
    const base = [
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'all', label: 'All events' }
    ];
    if (isStudent) base.push({ value: 'registered', label: 'My events' });
    return base;
  }, [isStudent]);

  const onFilterChange = (value) => {
    setFilter(value);
    updateParams({ page: null });
  };

  const emptyCopy = search
    ? `Nothing matches “${search}”.`
    : filter === 'upcoming'
    ? 'There are no upcoming events at the moment.'
    : filter === 'registered'
    ? "You haven't registered for any events yet."
    : 'No events match your current filter.';

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Campus"
        title="Events"
        lead="Campus drives, workshops, info sessions and career fairs."
        actions={
          !isStudent && (
            <Button icon={PlusIcon} onClick={() => navigate('/events/new')}>
              Create event
            </Button>
          )
        }
      />

      <Toolbar>
        <div className="w-full sm:max-w-sm">
          <Input
            type="search"
            label="Search events"
            icon={MagnifyingGlassIcon}
            placeholder="Title, description or location"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <div className="sm:ml-auto sm:self-end sm:pb-0.5">
          <Tabs tabs={tabs} value={filter} onChange={onFilterChange} />
        </div>
      </Toolbar>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <ErrorState title="Could not load events" description={error} onRetry={fetchEvents} />
      )}

      {!isLoading && !error && events.length === 0 && (
        <EmptyState
          icon={CalendarIcon}
          title={search ? 'No matching events' : 'No events found'}
          description={emptyCopy}
          action={
            search ? (
              <Button variant="secondary" onClick={() => updateParams({ search: null, page: null })}>
                Clear search
              </Button>
            ) : filter !== 'upcoming' ? (
              <Button variant="secondary" onClick={() => onFilterChange('upcoming')}>
                Browse upcoming events
              </Button>
            ) : !isStudent ? (
              <Button icon={PlusIcon} onClick={() => navigate('/events/new')}>
                Create the first event
              </Button>
            ) : (
              <Button as={Link} to="/dashboard" variant="secondary">
                Back to dashboard
              </Button>
            )
          }
        />
      )}

      {!isLoading && !error && events.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isStudent={isStudent}
                isRegistered={registeredEvents.has(event.id)}
                onRegister={(id) => handleEventRegistration(id, true)}
                onCancel={(id) => handleEventRegistration(id, false)}
              />
            ))}
          </div>
          <Pagination
            className="mt-8"
            page={page}
            pages={pageCount}
            onChange={(next) => updateParams({ page: next })}
          />

          {isStudent && (
            <Card className="mt-10 border-ink-950/20 bg-bone-100">
              <h2 className="font-display text-lg font-bold tracking-tight text-ink-950">
                Make the most of an event
              </h2>
              <ul className="mt-4 grid gap-2.5 text-sm text-ink-700 sm:grid-cols-2">
                {EVENT_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5">
                    <CheckIcon
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-india-600"
                      strokeWidth={2}
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
};

export default Events;
