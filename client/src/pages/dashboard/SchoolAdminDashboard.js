// client/src/pages/dashboard/SchoolAdminDashboard.js
//
// The school administrator's screen.
//
// This is the dashboard most constrained by the API. Roster administration —
// the whole point of the role — needs a user listing scoped to one school, and
// no such endpoint exists: `GET /api/users` and `GET /api/users/role/:role` are
// both `requireRole('admin', 'tpo', …)`, so a `school_admin` gets a 403
// (verified against the running API), and there is no organization-scoped
// alternative. `/api/approvals` is likewise TPO/admin only.
//
// So the page administers what a school admin *can* administer through the API:
// the school's own events and their registration numbers, its live classes, and
// its organization record. The roster panel states the gap instead of faking a
// table of people.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  EVENT_TYPE_LABELS,
  formatEventWhen,
  getOrganization,
  isUpcomingEvent,
  listConferences,
  listEvents,
  toErrorState
} from '../../services/school';
import {
  Badge,
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  SectionBlock,
  SkeletonCard,
  StatTile,
  StatusBadge,
  Table,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr
} from '../../components/ui';
import {
  BuildingOffice2Icon,
  CalendarIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { value: 'events', label: 'Events', icon: CalendarIcon },
  { value: 'live', label: 'Live classes', icon: VideoCameraIcon },
  { value: 'people', label: 'People', icon: UserGroupIcon },
  { value: 'school', label: 'School record', icon: BuildingOffice2Icon }
];

const SchoolAdminDashboard = () => {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [tab, setTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [events, setEvents] = useState([]);
  const [conferences, setConferences] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [eventsRes, confRes, orgRes] = await Promise.allSettled([
      listEvents({ limit: 100, ...(orgId ? { organizationId: orgId } : {}) }),
      listConferences(),
      orgId ? getOrganization(orgId) : Promise.resolve(null)
    ]);

    const nextErrors = {};

    if (eventsRes.status === 'fulfilled') {
      setEvents(
        (eventsRes.value.events || []).sort(
          (a, b) => new Date(b.startTime) - new Date(a.startTime)
        )
      );
    } else {
      nextErrors.events = toErrorState(eventsRes.reason, 'Could not load events');
    }

    if (confRes.status === 'fulfilled') {
      setConferences(confRes.value.conferences || []);
    } else {
      nextErrors.live =
        confRes.reason?.response?.status === 503
          ? {
              title: 'Live classes are not switched on yet',
              description: 'This server has no LiveKit connection configured.'
            }
          : toErrorState(confRes.reason, 'Could not load live classes');
    }

    if (orgRes.status === 'fulfilled') {
      setOrganization(orgRes.value?.organization || null);
    } else {
      nextErrors.school = toErrorState(orgRes.reason, 'Could not load the school record');
    }

    setErrors(nextErrors);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(() => events.filter(isUpcomingEvent), [events]);
  const totalSignups = useMemo(
    () => events.reduce((sum, e) => sum + (e.registrationCount || 0), 0),
    [events]
  );
  // Filtering happens locally: the whole school's event list is already loaded
  // in one request, so a round trip per keystroke would buy nothing.
  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q) ||
        e.eventType?.toLowerCase().includes(q)
    );
  }, [events, search]);

  const eventsPanel = () => {
    if (errors.events) return <ErrorState {...errors.events} onRetry={load} />;
    if (!events.length) {
      return (
        <EmptyState
          icon={CalendarIcon}
          title="No events under your school"
          description="Everything scheduled under your school will be listed here with its registration count."
          action={
            <Button as={Link} to="/events/new" icon={PlusIcon}>
              Create an event
            </Button>
          }
        />
      );
    }
    return (
      <>
        <Toolbar>
          <Input
            className="w-full sm:max-w-sm"
            aria-label="Search events"
            icon={MagnifyingGlassIcon}
            placeholder="Search by title, type or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Toolbar>
        {visibleEvents.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlassIcon}
            title="No event matches that search"
            description="Try a different title, event type or location."
            action={
              <Button variant="secondary" onClick={() => setSearch('')}>
                Clear the search
              </Button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Event</Th>
                <Th>Type</Th>
                <Th>Starts</Th>
                <Th>Status</Th>
                <Th className="text-right">Registered</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibleEvents.map((e) => (
                <Tr key={e.id}>
                  <Td>
                    <span className="font-semibold text-ink-950">{e.title}</span>
                    {e.location && (
                      <span className="block text-xs text-ink-500">{e.location}</span>
                    )}
                  </Td>
                  <Td>{EVENT_TYPE_LABELS[e.eventType] || e.eventType}</Td>
                  <Td>{formatEventWhen(e.startTime) || '—'}</Td>
                  <Td>
                    <StatusBadge status={e.status} />
                  </Td>
                  <Td className="text-right tabular-nums">
                    {e.registrationCount}
                    {e.maxParticipants ? ` / ${e.maxParticipants}` : ''}
                  </Td>
                  <Td>
                    <Button as={Link} to={`/events/${e.id}`} size="sm" variant="secondary">
                      Open
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </>
    );
  };

  const livePanel = () => {
    if (errors.live) return <ErrorState {...errors.live} onRetry={load} />;
    if (!conferences.length) {
      return (
        <EmptyState
          icon={VideoCameraIcon}
          title="No live classes"
          description="Sessions hosted by staff at your school appear here."
          action={
            <Button as={Link} to="/conferences" variant="secondary">
              Open live classes
            </Button>
          }
        />
      );
    }
    return (
      <Table>
        <Thead>
          <Tr>
            <Th>Session</Th>
            <Th>Host</Th>
            <Th>Scheduled</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {conferences.map((c) => (
            <Tr key={c.id}>
              <Td>
                <span className="font-semibold text-ink-950">{c.title}</span>
              </Td>
              <Td>{c.host ? `${c.host.firstName} ${c.host.lastName}` : '—'}</Td>
              <Td>{formatEventWhen(c.scheduledStart) || '—'}</Td>
              <Td>
                <Badge
                  tone={c.status === 'live' ? 'danger' : c.status === 'ended' ? 'neutral' : 'info'}
                  dot
                >
                  {c.status}
                </Badge>
              </Td>
              <Td>
                <Button
                  as={Link}
                  to={`/conference/${c.id}`}
                  size="sm"
                  variant="secondary"
                  disabled={c.status === 'ended'}
                >
                  Open
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    );
  };

  const peoplePanel = () => (
    <EmptyState
      icon={UserGroupIcon}
      title="Roster administration needs a school-scoped user endpoint"
      description={
        'Listing, searching or deactivating the accounts at your school is not possible from this ' +
        'role today. GET /api/users and GET /api/users/role/:role are both restricted to admins ' +
        'and placement officers, and there is no organization-scoped alternative — so this panel ' +
        'shows nothing rather than a list it cannot actually fetch.'
      }
      action={
        <Button as={Link} to="/profile" variant="secondary">
          Manage your own account
        </Button>
      }
    />
  );

  const schoolPanel = () => {
    if (errors.school) return <ErrorState {...errors.school} onRetry={load} />;
    if (!organization) {
      return (
        <EmptyState
          icon={BuildingOffice2Icon}
          title="No school record"
          description="Your account is not attached to an organization, so there is nothing to show."
        />
      );
    }
    return (
      <Card>
        <dl className="divide-y divide-ink-950/10">
          <DetailRow label="Name">{organization.name}</DetailRow>
          <DetailRow label="Type">{organization.type}</DetailRow>
          <DetailRow label="Verified">
            <StatusBadge status={organization.isVerified ? 'approved' : 'pending'} />
          </DetailRow>
          <DetailRow label="Domain">{organization.domain}</DetailRow>
          <DetailRow label="Contact email">{organization.contactEmail}</DetailRow>
          <DetailRow label="Contact phone">{organization.contactPhone}</DetailRow>
          <DetailRow label="Address">{organization.address}</DetailRow>
          <DetailRow label="On EduMapping since">
            {organization.createdAt ? new Date(organization.createdAt).toLocaleDateString() : null}
          </DetailRow>
        </dl>
      </Card>
    );
  };

  const panels = {
    events: eventsPanel,
    live: livePanel,
    people: peoplePanel,
    school: schoolPanel
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={organization?.name || user?.organization?.name || 'School'}
        title="School administration"
        lead="The events, live classes and organization record you can manage from this role."
        actions={
          <Button as={Link} to="/events/new" icon={PlusIcon}>
            New event
          </Button>
        }
      />

      <SectionBlock>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Events on record"
            value={errors.events ? '—' : events.length}
            icon={CalendarIcon}
            loading={loading}
            to="/events"
          />
          <StatTile
            label="Upcoming"
            value={errors.events ? '—' : upcoming.length}
            icon={CalendarIcon}
            accent="saffron"
            loading={loading}
          />
          <StatTile
            label="Event sign-ups"
            value={errors.events ? '—' : totalSignups}
            icon={UserGroupIcon}
            accent="india"
            loading={loading}
            hint="Registrations, not distinct students"
          />
          <StatTile
            label="Live classes"
            value={errors.live ? '—' : conferences.length}
            icon={VideoCameraIcon}
            accent="azure"
            loading={loading}
            to="/conferences"
          />
        </div>
      </SectionBlock>

      <Tabs className="mb-6 w-fit" value={tab} onChange={setTab} tabs={TABS} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        panels[tab]()
      )}
    </PageShell>
  );
};

export default SchoolAdminDashboard;
