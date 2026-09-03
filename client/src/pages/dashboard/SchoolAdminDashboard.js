// client/src/pages/dashboard/SchoolAdminDashboard.js
//
// The school administrator's screen.
//
// It administers the school's own events and their registration numbers, its
// live classes, its people, and its organization record.
//
// The People tab used to be an empty state asserting that `GET /api/users` was
// "restricted to admins and placement officers" and that no organization-scoped
// alternative existed. That is no longer true — `routes/users.js` allows
// `principal`, `school_admin` and `career_counselor`, and the controller pins
// the organization filter for them — so the panel was withholding a roster the
// role can genuinely read. Verified against the running API: this role gets 200
// and the school's own users. `/api/approvals` really is still TPO/admin only,
// so nothing here offers to approve anyone.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  EVENT_TYPE_LABELS,
  formatEventWhen,
  SCHOOL_ROLE_LABELS,
  countByRole,
  fullName,
  getOrganization,
  isUpcomingEvent,
  listConferences,
  listEvents,
  listOrganizationUsers,
  sortByRoleThenName,
  toErrorState
} from '../../services/school';
import {
  Avatar,
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
  AcademicCapIcon,
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
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [eventsRes, confRes, orgRes, peopleRes] = await Promise.allSettled([
      listEvents({ limit: 100, ...(orgId ? { organizationId: orgId } : {}) }),
      listConferences(),
      orgId ? getOrganization(orgId) : Promise.resolve(null),
      orgId ? listOrganizationUsers(orgId) : Promise.resolve(null)
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

    if (peopleRes.status === 'fulfilled') {
      setPeople(sortByRoleThenName(peopleRes.value?.users || []));
    } else {
      nextErrors.people = toErrorState(peopleRes.reason, 'Could not load the people at your school');
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
  const roleCounts = useMemo(() => countByRole(people), [people]);
  const studentCount = roleCounts.student || 0;
  const staffCount = people.length - studentCount;

  // Both lists are filtered locally: each is already loaded whole in one
  // request, so a round trip per keystroke would buy nothing.
  const visiblePeople = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase();
    return people.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return fullName(u).toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    });
  }, [people, peopleSearch, roleFilter]);

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

  const peoplePanel = () => {
    if (errors.people) return <ErrorState {...errors.people} onRetry={load} />;
    if (!people.length) {
      return (
        <EmptyState
          icon={UserGroupIcon}
          title="No accounts at your school yet"
          description="Everyone who registers against your school — students, teachers and leadership — appears here."
        />
      );
    }
    // Only the roles actually present get a filter chip, so the row never
    // offers a filter that would empty the table.
    const presentRoles = Object.keys(SCHOOL_ROLE_LABELS).filter((r) => roleCounts[r]);
    return (
      <>
        <Toolbar>
          <Input
            className="w-full sm:max-w-sm"
            aria-label="Search people"
            icon={MagnifyingGlassIcon}
            placeholder="Search by name or email"
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {['all', ...presentRoles].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={roleFilter === r}
                onClick={() => setRoleFilter(r)}
                className={
                  roleFilter === r
                    ? 'rounded-full border border-ink-950 bg-ink-950 px-3 py-1.5 text-xs font-semibold text-bone-50'
                    : 'rounded-full border border-ink-950/15 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-950/40'
                }
              >
                {r === 'all' ? `Everyone (${people.length})` : `${SCHOOL_ROLE_LABELS[r]} (${roleCounts[r]})`}
              </button>
            ))}
          </div>
        </Toolbar>
        {visiblePeople.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlassIcon}
            title="Nobody matches that search"
            description="Try a different name or email address."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setPeopleSearch('');
                  setRoleFilter('all');
                }}
              >
                Clear the filters
              </Button>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last signed in</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visiblePeople.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar src={u.profilePicture} name={fullName(u)} size="sm" />
                      <div className="min-w-0">
                        <span className="block font-semibold text-ink-950">
                          {fullName(u) || 'Unnamed account'}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{u.email}</span>
                      </div>
                    </div>
                  </Td>
                  <Td>{SCHOOL_ROLE_LABELS[u.role] || u.role?.replace(/_/g, ' ')}</Td>
                  <Td>
                    {u.isActive ? (
                      <StatusBadge status={u.approvalStatus || 'approved'} />
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td className="text-ink-600">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        {/* Approving or deactivating an account is genuinely out of reach:
            /api/approvals and PUT /api/users/:id/status are both TPO/admin
            only, so this table reads rather than administers. */}
        <p className="mt-4 text-xs text-ink-500">
          Read-only. Activating, deactivating or approving an account still needs an
          admin or placement officer — <code className="text-ink-700">/api/approvals</code> is
          not open to this role.
        </p>
      </>
    );
  };

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
            label="Students"
            value={errors.people ? '—' : studentCount}
            icon={AcademicCapIcon}
            loading={loading}
            hint={errors.people ? 'Unavailable' : 'Accounts at your school'}
          />
          <StatTile
            label="Staff"
            value={errors.people ? '—' : staffCount}
            icon={UserGroupIcon}
            accent="saffron"
            loading={loading}
            hint={errors.people ? 'Unavailable' : 'Teaching and leadership'}
          />
          <StatTile
            label="Upcoming events"
            value={errors.events ? '—' : upcoming.length}
            icon={CalendarIcon}
            accent="india"
            loading={loading}
            hint={errors.events ? 'Unavailable' : `${events.length} on record, ${totalSignups} sign-ups`}
            to="/events"
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
