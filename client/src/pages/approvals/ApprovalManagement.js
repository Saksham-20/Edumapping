// client/src/pages/approvals/ApprovalManagement.js
//
// The approval queue, for both kinds of reviewer:
//
//   * a TPO vets companies and recruiters asking to recruit from campus, and
//     the job postings they submit;
//   * an admin vets everything — new universities, colleges and schools, the
//     TPOs and school staff who registered them, companies, every pending
//     account, and the posting queue.
//
// The server scopes each list to the caller (`/api/approvals/*`), so this page
// only changes labels and filters by role; it never decides what a TPO may
// see. Every list is paginated server-side — the old screen loaded the first
// 100 postings and 40 activity rows and silently dropped the rest.
//
// Errors: every request here is `silent` and the catch toasts exactly once.
// The shared axios instance toasts on its own otherwise, which is how this
// page used to show two identical error toasts for one failure.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import approvalService from '../../services/approvals';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  Pagination,
  Select,
  SkeletonCard,
  StatStrip,
  StatTile,
  StatusBadge,
  Tabs,
  Textarea,
  Toolbar,
  Modal
} from '../../components/ui';
import {
  BriefcaseIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  InboxStackIcon,
  CheckIcon,
  XMarkIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { formatJobType, formatSalary } from '../../utils/helpers';

/**
 * What a reviewer needs to decide on a drive: the package and who may apply.
 * The card used to show only the title and description.
 */
const postingTerms = (j) => {
  const e = j.eligibilityCriteria || {};
  const minCgpa = e.minCGPA ?? e.min_cgpa;
  const branches = e.allowedBranches || e.allowed_branches || [];
  const batches = e.graduationYear || e.graduation_year || [];
  const backlogs = e.maxBacklogs ?? e.max_backlogs;
  return [
    `CTC ${formatSalary(j.salaryMin, j.salaryMax)}`,
    j.totalPositions ? `${j.totalPositions} opening${Number(j.totalPositions) === 1 ? '' : 's'}` : null,
    minCgpa != null && minCgpa !== '' ? `Min CGPA ${minCgpa}` : 'No CGPA cut-off',
    branches.length ? `Branches: ${branches.join(', ')}` : 'All branches',
    batches.length ? `Batch ${[].concat(batches).join(', ')}` : 'Any batch',
    backlogs != null && backlogs !== '' ? `Max ${backlogs} backlog${Number(backlogs) === 1 ? '' : 's'}` : null,
    j.applicationDeadline ? `Apply by ${formatDate(j.applicationDeadline)}` : null
  ].filter(Boolean);
};

/**
 * Past tense of an action, for the confirmation toast. `${action}d` reads
 * correctly for "approve" and produced "rejectd" for the other one.
 */
const PAST_TENSE = { approve: 'approved', reject: 'rejected' };

const PAGE_SIZE = 20;

/** Pulls one status count out of the `[{ approvalStatus, count }]` shape. */
const countFor = (rows, status) => {
  const hit = (rows || []).find((r) => r.approvalStatus === status);
  return hit ? Number(hit.count) : 0;
};

const ORG_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'university', label: 'Universities' },
  { value: 'college', label: 'Colleges' },
  { value: 'school', label: 'Schools' },
  { value: 'company', label: 'Companies' }
];

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'tpo', label: 'TPOs' },
  { value: 'recruiter', label: 'Recruiters' },
  { value: 'principal', label: 'Principals' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'school_admin', label: 'School admins' },
  { value: 'career_counselor', label: 'Career counsellors' },
  { value: 'student', label: 'Students' }
];

const ORG_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

const USER_STATUS_OPTIONS_ADMIN = [
  ...ORG_STATUS_OPTIONS,
  // Accounts marked approved that still cannot sign in — what the old
  // approval path left behind. Re-approving one repairs it.
  { value: 'stuck', label: 'Approved, cannot sign in' }
];

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

const humanRole = (role) => String(role || '').replace(/_/g, ' ');

/** Debounces a value so a search box does not fire one request per keystroke. */
const useDebounced = (value, ms = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

const ApprovalManagement = () => {
  const { user } = useAuth();
  const isTpo = user?.role === 'tpo';
  const isAdmin = user?.role === 'admin';
  const allowed = isTpo || isAdmin;

  const [tab, setTab] = useState('organizations');
  // Once the officer picks a tab themselves, the counts stop steering it.
  const [tabChosen, setTabChosen] = useState(false);
  const chooseTab = (value) => {
    setTabChosen(true);
    setTab(value);
  };
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);

  // One paginated list per tab: `{ rows, pagination, loading, error }`.
  const emptyList = { rows: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0 }, loading: true, error: null };
  const [orgList, setOrgList] = useState(emptyList);
  const [userList, setUserList] = useState(emptyList);
  const [jobList, setJobList] = useState(emptyList);
  const [activityList, setActivityList] = useState(emptyList);

  const [orgFilters, setOrgFilters] = useState({ status: 'pending', type: '', search: '', page: 1 });
  const [userFilters, setUserFilters] = useState({ status: 'pending', role: '', search: '', page: 1 });
  const [jobPage, setJobPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const orgSearch = useDebounced(orgFilters.search);
  const userSearch = useDebounced(userFilters.search);

  const [selected, setSelected] = useState([]);
  // `{ action, scope: 'bulk' | 'one', type: 'organization'|'user'|'posting', item }`
  const [confirm, setConfirm] = useState(null);
  const [notes, setNotes] = useState('');
  const [working, setWorking] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    try {
      const body = await approvalService.getApprovalStats({ silent: true });
      setStats(body.stats || null);
    } catch (err) {
      setStatsError(err?.message || 'Could not load the approval queue.');
    }
  }, []);

  const loadOrgs = useCallback(async () => {
    setOrgList((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const body = await approvalService.listOrganizations(
        {
          status: orgFilters.status,
          ...(orgFilters.type ? { type: orgFilters.type } : {}),
          ...(orgSearch ? { search: orgSearch } : {}),
          page: orgFilters.page,
          limit: PAGE_SIZE
        },
        { silent: true }
      );
      setOrgList({ rows: body.organizations || [], pagination: body.pagination || emptyList.pagination, loading: false, error: null });
    } catch (err) {
      setOrgList({ ...emptyList, loading: false, error: err?.message || 'Could not load organizations.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgFilters.status, orgFilters.type, orgFilters.page, orgSearch]);

  const loadUsers = useCallback(async () => {
    setUserList((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const body = await approvalService.listUsers(
        {
          status: userFilters.status,
          ...(userFilters.role ? { role: userFilters.role } : {}),
          ...(userSearch ? { search: userSearch } : {}),
          page: userFilters.page,
          limit: PAGE_SIZE
        },
        { silent: true }
      );
      setUserList({ rows: body.users || [], pagination: body.pagination || emptyList.pagination, loading: false, error: null });
    } catch (err) {
      setUserList({ ...emptyList, loading: false, error: err?.message || 'Could not load accounts.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilters.status, userFilters.role, userFilters.page, userSearch]);

  const loadJobs = useCallback(async () => {
    setJobList((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const body = await approvalService.listPendingJobs({ page: jobPage, limit: PAGE_SIZE }, { silent: true });
      setJobList({ rows: body.jobs || [], pagination: body.pagination || emptyList.pagination, loading: false, error: null });
    } catch (err) {
      setJobList({ ...emptyList, loading: false, error: err?.message || 'Could not load postings.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobPage]);

  const loadActivity = useCallback(async () => {
    setActivityList((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const body = await approvalService.getAuditLog({ page: activityPage, limit: 25 }, { silent: true });
      setActivityList({ rows: body.entries || [], pagination: body.pagination || emptyList.pagination, loading: false, error: null });
    } catch (err) {
      setActivityList({ ...emptyList, loading: false, error: err?.message || 'Could not load activity.' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityPage]);

  useEffect(() => {
    if (allowed) loadStats();
  }, [allowed, loadStats]);

  // Only the open tab loads, and reloads when its own filters change.
  useEffect(() => {
    if (!allowed) return;
    if (tab === 'organizations') loadOrgs();
    if (tab === 'users') loadUsers();
    if (tab === 'postings') loadJobs();
    if (tab === 'activity') loadActivity();
  }, [allowed, tab, loadOrgs, loadUsers, loadJobs, loadActivity]);

  // A selection never survives a change of page or filter: approving "3
  // selected" must mean the three rows on screen.
  useEffect(() => {
    setSelected([]);
  }, [orgFilters.status, orgFilters.type, orgFilters.page, orgSearch]);

  const orgs = orgList.rows;
  const bulkable = orgFilters.status === 'pending';
  const allSelected = orgs.length > 0 && selected.length === orgs.length;
  const toggleOne = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setSelected(allSelected ? [] : orgs.map((o) => o.id));

  const openConfirm = (action, scope, type, item) => {
    setNotes('');
    setConfirm({ action, scope, type, item });
  };

  const runConfirmed = async () => {
    const { action, scope, type, item } = confirm;
    setWorking(true);
    try {
      if (scope === 'one' && type === 'posting') {
        // A posting review lives on the job itself, not under /approvals, since
        // approving it publishes the job and fans the alert out to students.
        await approvalService.reviewJob(item.id, action, notes, { silent: true });
        toast.success(action === 'approve' ? 'Posting published' : 'Posting sent back');
        await loadJobs();
      } else if (scope === 'one' && type === 'organization') {
        const body = await approvalService.approveOrganization(item.id, action, notes, { silent: true });
        const staff = body?.usersUpdated || 0;
        toast.success(
          `${item.name} ${PAST_TENSE[action]}${staff ? ` with ${staff} staff account${staff === 1 ? '' : 's'}` : ''}`
        );
        await loadOrgs();
      } else if (scope === 'one') {
        await approvalService.approveUser(item.id, action, notes, { silent: true });
        toast.success(`${item.firstName} ${item.lastName} ${PAST_TENSE[action]}`);
        await loadUsers();
      } else {
        // One request for the whole selection: the server applies it in a
        // single transaction, so the batch cannot land half-applied the way a
        // request-per-organization loop can.
        const body = await approvalService.bulkApproveOrganizations(selected, action, notes, { silent: true });
        const count = body?.updatedCount ?? selected.length;
        // When part of the selection was already decided by someone else, the
        // server's message says how many were skipped.
        if (body?.skipped) toast(body.message, { duration: 6000 });
        else toast.success(`${count} ${count === 1 ? orgNoun : orgNoun === 'company' ? 'companies' : 'organizations'} ${PAST_TENSE[action]}`);
        setSelected([]);
        await loadOrgs();
      }
      setConfirm(null);
      loadStats();
    } catch (err) {
      toast.error(err?.message || `Could not ${action} that record.`);
    } finally {
      setWorking(false);
    }
  };

  const pendingOrgs = countFor(stats?.organizations, 'pending');
  const pendingUsers = countFor(stats?.users || stats?.recruiters, 'pending');
  const pendingJobs = Number(stats?.pendingJobs || 0);
  const stuckUsers = Number(stats?.stuckUsers || 0);

  // Open on the first tab with something waiting: a TPO with one drive to
  // review used to land on an empty Companies tab.
  useEffect(() => {
    if (!stats || tabChosen) return;
    if (pendingOrgs > 0) setTab('organizations');
    else if (pendingUsers > 0) setTab('users');
    else if (pendingJobs > 0) setTab('postings');
  }, [stats, tabChosen, pendingOrgs, pendingUsers, pendingJobs]);

  const tabs = useMemo(
    () => [
      {
        value: 'organizations',
        label: isAdmin ? 'Organizations' : 'Companies',
        icon: BuildingOfficeIcon,
        count: stats ? pendingOrgs : undefined
      },
      {
        value: 'users',
        label: isAdmin ? 'Accounts' : 'Recruiters',
        icon: UserGroupIcon,
        count: stats ? pendingUsers : undefined
      },
      { value: 'postings', label: 'Job postings', icon: BriefcaseIcon, count: stats ? pendingJobs : undefined },
      { value: 'activity', label: 'Activity', icon: ClockIcon }
    ],
    [isAdmin, stats, pendingOrgs, pendingUsers, pendingJobs]
  );

  if (!allowed) {
    return (
      <PageShell>
        <PageHeader eyebrow="Approvals" title="Approval queue" />
        <EmptyState
          icon={LockClosedIcon}
          title="Reviewers only"
          description="The approval queue is for placement officers and administrators."
        />
      </PageShell>
    );
  }

  const setOrgFilter = (name) => (e) =>
    setOrgFilters((prev) => ({ ...prev, [name]: e.target.value, page: 1 }));
  const setUserFilter = (name) => (e) =>
    setUserFilters((prev) => ({ ...prev, [name]: e.target.value, page: 1 }));

  const orgNoun = isAdmin ? 'organization' : 'company';
  // A posting sent back with no reason reached the recruiter as just "was not
  // published", with nothing to fix.
  const needsReason = confirm?.type === 'posting' && confirm?.action === 'reject';

  const confirmTitle = () => {
    if (!confirm) return '';
    const verb = confirm.action === 'approve' ? 'Approve' : 'Reject';
    if (confirm.scope === 'bulk') {
      const plural = orgNoun === 'company' ? 'companies' : 'organizations';
      return `${verb} ${selected.length} ${selected.length === 1 ? orgNoun : plural}?`;
    }
    if (confirm.type === 'organization') return `${verb} ${confirm.item?.name}?`;
    if (confirm.type === 'posting') {
      return `${confirm.action === 'approve' ? 'Publish' : 'Send back'} ${confirm.item?.title}?`;
    }
    return `${verb} ${confirm.item?.firstName} ${confirm.item?.lastName}?`;
  };

  const confirmDescription = () => {
    if (!confirm) return '';
    const approve = confirm.action === 'approve';
    if (confirm.type === 'posting') {
      return approve
        ? 'The posting goes live and every eligible student is notified.'
        : 'The posting returns to the recruiter as a draft. Your note is sent with it.';
    }
    if (confirm.scope === 'bulk') {
      return approve
        ? 'Each goes live, and the staff waiting on it are approved with it and can sign in.'
        : 'Each is marked rejected, and the staff waiting on it are rejected with it. A reason helps.';
    }
    if (confirm.type === 'organization') {
      const type = confirm.item?.type;
      const staff =
        type === 'company' || !isAdmin
          ? 'any recruiters waiting on it'
          : type === 'school'
          ? 'any school staff waiting on it'
          : 'any placement officer waiting on it';
      // "any recruiters … is rejected" — the verb follows the noun.
      const be = staff.startsWith('any placement officer') ? 'is' : 'are';
      return approve
        ? `It goes live, and ${staff} can sign in from now on.`
        : `It is marked rejected, and ${staff} ${be} rejected with it. A reason helps.`;
    }
    return approve
      ? 'They can sign in immediately.'
      : 'Their account is rejected and they cannot sign in. A reason helps.';
  };

  /* ------------------------------------------------------------- sections */

  const listState = (list, retry, emptyProps) => {
    if (list.loading) {
      return (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      );
    }
    if (list.error) return <ErrorState title="Could not load this list" description={list.error} onRetry={retry} />;
    if (list.rows.length === 0) return <EmptyState {...emptyProps} />;
    return null;
  };

  const renderOrganizations = () => (
    <>
      <Toolbar className="flex-wrap">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Search"
            icon={MagnifyingGlassIcon}
            placeholder="Name, domain or contact email"
            value={orgFilters.search}
            onChange={setOrgFilter('search')}
          />
        </div>
        {isAdmin && (
          <div className="w-full sm:w-44">
            <Select label="Type" value={orgFilters.type} onChange={setOrgFilter('type')} options={ORG_TYPE_OPTIONS} />
          </div>
        )}
        <div className="w-full sm:w-40">
          <Select label="Status" value={orgFilters.status} onChange={setOrgFilter('status')} options={ORG_STATUS_OPTIONS} />
        </div>
      </Toolbar>

      {bulkable && orgs.length > 0 && !orgList.loading && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 py-3">
          <Checkbox
            checked={allSelected}
            onChange={toggleAll}
            label={`Select all on this page (${selected.length}/${orgs.length})`}
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" icon={CheckIcon} onClick={() => openConfirm('approve', 'bulk')}>
                Approve {selected.length}
              </Button>
              <Button size="sm" variant="danger" icon={XMarkIcon} onClick={() => openConfirm('reject', 'bulk')}>
                Reject {selected.length}
              </Button>
            </div>
          )}
        </Card>
      )}

      {listState(orgList, loadOrgs, {
        icon: BuildingOfficeIcon,
        title: orgFilters.status === 'pending' ? `No ${orgNoun === 'company' ? 'companies' : 'organizations'} waiting` : 'Nothing here',
        description:
          orgFilters.status === 'pending'
            ? `Every ${orgNoun} that asked for access has been reviewed.`
            : 'No records match these filters.'
      }) || (
        <ul className="space-y-3">
          {orgs.map((org) => {
            const staff = (org.users || []).filter((u) => u.role !== 'student');
            return (
              <li key={org.id}>
                <Card className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {bulkable && (
                      <Checkbox
                        checked={selected.includes(org.id)}
                        onChange={() => toggleOne(org.id)}
                        label={<span className="sr-only">Select {org.name}</span>}
                      />
                    )}
                    <Avatar src={org.logoUrl} name={org.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-ink-950">{org.name}</h3>
                        <Badge tone={org.type === 'company' ? 'info' : 'purple'}>{org.type}</Badge>
                      </div>
                      <p className="truncate text-sm text-ink-600">
                        {[org.domain, org.contactEmail, org.contactPhone].filter(Boolean).join(' · ')}
                      </p>
                      {org.website && (
                        <p className="truncate text-sm">
                          <a
                            href={/^https?:\/\//i.test(org.website) ? org.website : `https://${org.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-azure-700 underline-offset-2 hover:underline"
                          >
                            {org.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                          </a>
                        </p>
                      )}
                      {(org.city || org.state || org.address) && (
                        <p className="truncate text-xs text-ink-500">
                          {[org.city, org.state].filter(Boolean).join(', ') || org.address}
                        </p>
                      )}
                      {staff.length > 0 && (
                        <p className="mt-1 text-xs text-ink-600">
                          Registered by{' '}
                          {staff
                            .slice(0, 3)
                            .map((u) => `${u.firstName} ${u.lastName} (${humanRole(u.role)}, ${u.email})`)
                            .join('; ')}
                          {staff.length > 3 ? ` and ${staff.length - 3} more` : ''}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ink-500">
                        {org.approvalStatus === 'pending'
                          ? `Requested ${formatDate(org.createdAt)}`
                          : `${org.approvalStatus === 'approved' ? 'Approved' : 'Rejected'} ${formatDate(org.approvedAt)}${
                              org.approver ? ` by ${org.approver.firstName} ${org.approver.lastName}` : ''
                            }${org.approvalNotes ? ` — “${org.approvalNotes}”` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusBadge status={org.approvalStatus} />
                    {org.approvalStatus === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          icon={CheckIcon}
                          onClick={() => openConfirm('approve', 'one', 'organization', org)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={XMarkIcon}
                          onClick={() => openConfirm('reject', 'one', 'organization', org)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        className="mt-6"
        page={orgList.pagination.currentPage}
        pages={orgList.pagination.totalPages}
        onChange={(page) => setOrgFilters((prev) => ({ ...prev, page }))}
      />
    </>
  );

  const renderUsers = () => (
    <>
      <Toolbar className="flex-wrap">
        <div className="min-w-[200px] flex-1">
          <Input
            label="Search"
            icon={MagnifyingGlassIcon}
            placeholder="Name or email"
            value={userFilters.search}
            onChange={setUserFilter('search')}
          />
        </div>
        {isAdmin && (
          <div className="w-full sm:w-48">
            <Select label="Role" value={userFilters.role} onChange={setUserFilter('role')} options={ROLE_OPTIONS} />
          </div>
        )}
        <div className="w-full sm:w-56">
          <Select
            label="Status"
            value={userFilters.status}
            onChange={setUserFilter('status')}
            options={isAdmin ? USER_STATUS_OPTIONS_ADMIN : ORG_STATUS_OPTIONS}
          />
        </div>
      </Toolbar>

      {isAdmin && stuckUsers > 0 && userFilters.status !== 'stuck' && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-saffron-500/40 bg-saffron-50 py-3">
          <p className="flex items-center gap-2 text-sm text-saffron-900">
            <ExclamationTriangleIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {stuckUsers} account{stuckUsers === 1 ? ' is' : 's are'} marked approved but cannot sign in.
          </p>
          <Button
            size="sm"
            variant="secondary"
            iconRight={ArrowRightIcon}
            onClick={() => setUserFilters((prev) => ({ ...prev, status: 'stuck', page: 1 }))}
          >
            Review
          </Button>
        </Card>
      )}

      {listState(userList, loadUsers, {
        icon: UserGroupIcon,
        title: userFilters.status === 'pending' ? `No ${isAdmin ? 'accounts' : 'recruiters'} waiting` : 'Nothing here',
        description:
          userFilters.status === 'pending'
            ? 'Every account that asked for access has been reviewed.'
            : 'No accounts match these filters.'
      }) || (
        <ul className="space-y-3">
          {userList.rows.map((u) => {
            const decidable = u.approvalStatus === 'pending' || (u.approvalStatus === 'approved' && !u.isActive);
            const orgBlocked =
              u.organization && u.organization.approvalStatus !== 'approved' && u.role !== 'student';
            return (
              <li key={u.id}>
                <Card className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar src={u.profilePicture} name={`${u.firstName} ${u.lastName}`} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-ink-950">
                          {u.firstName} {u.lastName}
                        </h3>
                        <Badge tone="neutral">{humanRole(u.role)}</Badge>
                      </div>
                      <p className="truncate text-sm text-ink-600">
                        {[u.email, u.phone].filter(Boolean).join(' · ')}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {[u.organization?.name, u.recruiterProfile?.position].filter(Boolean).join(' · ') ||
                          'No organization on record'}
                        {` · Signed up ${formatDate(u.createdAt)}`}
                      </p>
                      {orgBlocked && (
                        <p className="mt-1 text-xs font-medium text-saffron-800">
                          {u.organization.name} is {u.organization.approvalStatus}. Approve the organization —
                          its waiting staff are approved with it.
                        </p>
                      )}
                      {u.approvalNotes && u.approvalStatus !== 'pending' && (
                        <p className="mt-1 text-xs text-ink-500">Note: “{u.approvalNotes}”</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {u.approvalStatus === 'approved' && !u.isActive ? (
                      <Badge tone="warning" dot>
                        cannot sign in
                      </Badge>
                    ) : (
                      <StatusBadge status={u.approvalStatus} />
                    )}
                    {decidable && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          icon={CheckIcon}
                          disabled={orgBlocked}
                          onClick={() => openConfirm('approve', 'one', 'user', u)}
                        >
                          {u.approvalStatus === 'approved' ? 'Re-approve' : 'Approve'}
                        </Button>
                        {u.approvalStatus === 'pending' && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={XMarkIcon}
                            onClick={() => openConfirm('reject', 'one', 'user', u)}
                          >
                            Reject
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        className="mt-6"
        page={userList.pagination.currentPage}
        pages={userList.pagination.totalPages}
        onChange={(page) => setUserFilters((prev) => ({ ...prev, page }))}
      />
    </>
  );

  const renderPostings = () => (
    <>
      {listState(jobList, loadJobs, {
        icon: BriefcaseIcon,
        title: 'No postings waiting',
        description:
          'Every job a recruiter submitted has been reviewed. Approved postings go live to eligible students immediately.'
      }) || (
        <ul className="space-y-3">
          {jobList.rows.map((j) => (
            <li key={j.id}>
              <Card className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-bold text-ink-950">
                    <Link to={`/jobs/${j.id}`} className="underline-offset-2 hover:underline">
                      {j.title}
                    </Link>
                  </h3>
                  <p className="truncate text-sm text-ink-600">
                    {j.organization?.name}
                    {j.location ? ` · ${j.location}` : ''}
                    {j.jobType ? ` · ${formatJobType(j.jobType)}` : ''}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    Submitted by {j.creator?.firstName} {j.creator?.lastName}
                    {j.createdAt ? ` on ${formatDate(j.createdAt)}` : ''}
                  </p>
                  <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label="Terms and eligibility">
                    {postingTerms(j).map((t) => (
                      <li key={t} className="max-w-full">
                        <Badge tone="neutral" className="max-w-full !whitespace-normal break-words">
                          {t}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-700">{j.description}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button size="sm" variant="success" icon={CheckIcon} onClick={() => openConfirm('approve', 'one', 'posting', j)}>
                    Publish
                  </Button>
                  <Button size="sm" variant="danger" icon={XMarkIcon} onClick={() => openConfirm('reject', 'one', 'posting', j)}>
                    Send back
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        className="mt-6"
        page={jobList.pagination.currentPage}
        pages={jobList.pagination.totalPages}
        onChange={setJobPage}
      />
    </>
  );

  const renderActivity = () => (
    <>
      {listState(activityList, loadActivity, {
        icon: ClockIcon,
        title: 'Nothing recorded yet',
        description:
          'Approvals, posting decisions, announcements, bulk status changes and recruiter access to student records all appear here.'
      }) || (
        <Card>
          <ul className="divide-y divide-ink-950/10">
            {activityList.rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-950">
                    {e.description}
                    {e.entityName && <span className="font-normal text-ink-700"> · {e.entityName}</span>}
                  </p>
                  <p className="text-sm text-ink-600">
                    {e.by ? `${e.by.name} · ${humanRole(e.by.role)}` : 'System'}
                    {e.by?.organization ? ` · ${e.by.organization}` : ''}
                  </p>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-ink-500" dateTime={e.at}>
                  {new Date(e.at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Pagination
          page={activityList.pagination.currentPage}
          pages={activityList.pagination.totalPages}
          onChange={setActivityPage}
        />
        <Button as={Link} to="/audit" size="sm" variant="ghost" iconRight={ArrowRightIcon}>
          Full audit log
        </Button>
      </div>
    </>
  );

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Approvals"
        title="Approval queue"
        lead={
          isAdmin
            ? 'Institutions, companies, accounts and job postings waiting on the platform.'
            : user?.organization?.name
            ? `Companies, recruiters and job postings waiting on ${user.organization.name}.`
            : 'Companies, recruiters and job postings waiting on your institution.'
        }
      />

      {statsError && (
        <ErrorState className="mb-6" title="Could not load the queue counts" description={statsError} onRetry={loadStats} />
      )}

      <StatStrip>
        <StatTile
          label="Waiting"
          // The postings queue is part of this queue, so it belongs in the
          // headline count.
          value={pendingOrgs + pendingUsers + pendingJobs}
          hint={isAdmin ? 'Organizations, accounts and postings' : 'Companies, recruiters and postings'}
          icon={InboxStackIcon}
          accent="saffron"
          loading={!stats && !statsError}
        />
        <StatTile
          label={isAdmin ? 'Organizations pending' : 'Companies pending'}
          value={pendingOrgs}
          icon={BuildingOfficeIcon}
          accent="ink"
          loading={!stats && !statsError}
        />
        <StatTile
          label={isAdmin ? 'Accounts pending' : 'Recruiters pending'}
          value={pendingUsers}
          hint={isAdmin && stuckUsers > 0 ? `${stuckUsers} approved but cannot sign in` : undefined}
          icon={UserGroupIcon}
          accent="azure"
          loading={!stats && !statsError}
        />
        <StatTile
          label="Approved to date"
          value={
            stats?.approvedToDate ??
            countFor(stats?.organizations, 'approved') + countFor(stats?.users || stats?.recruiters, 'approved')
          }
          hint={isAdmin ? 'Organizations and accounts' : 'Companies and recruiters your cell approved'}
          icon={CheckCircleIcon}
          accent="india"
          loading={!stats && !statsError}
        />
      </StatStrip>

      <Tabs className="mb-6 mt-8 w-fit max-w-full" tabs={tabs} value={tab} onChange={chooseTab} />

      {tab === 'organizations' && renderOrganizations()}
      {tab === 'users' && renderUsers()}
      {tab === 'postings' && renderPostings()}
      {tab === 'activity' && renderActivity()}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirmTitle()}
        description={confirmDescription()}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.action === 'approve' ? 'success' : 'danger'}
              loading={working}
              disabled={needsReason && !notes.trim()}
              onClick={runConfirmed}
            >
              {confirm?.type === 'posting'
                ? confirm?.action === 'approve'
                  ? 'Publish'
                  : 'Send back'
                : confirm?.action === 'approve'
                ? 'Approve'
                : 'Reject'}
            </Button>
          </>
        }
      >
        <Textarea
          label="Notes"
          rows={4}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required={needsReason}
          placeholder={
            needsReason
              ? 'e.g. Add the CTC break-up and the bond terms, then resubmit.'
              : confirm?.action === 'approve'
              ? 'Optional'
              : 'Why is this being declined?'
          }
          help={
            needsReason
              ? 'Sent to the recruiter with the posting, so they know what to change.'
              : 'Stored on the record for the audit trail.'
          }
        />
        {confirm?.scope === 'bulk' && (
          <Badge tone="warning" className="mt-3">
            Applies to all {selected.length} selected
          </Badge>
        )}
      </Modal>
    </PageShell>
  );
};

export default ApprovalManagement;
