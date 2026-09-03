// client/src/pages/approvals/ApprovalManagement.js
//
// A TPO's queue of companies and recruiters waiting to be let into their
// campus. The file never parsed before it was routed, so nothing here had ever
// executed until now.
//
// Both `/approvals/*` list endpoints require the `tpo` role, so an admin gets
// a 403 — this page says so rather than showing an empty queue and implying
// there is nothing to approve.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  SkeletonCard,
  StatTile,
  StatusBadge,
  Tabs,
  Textarea,
  Modal
} from '../../components/ui';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  InboxStackIcon,
  CheckIcon,
  XMarkIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';

/** Pulls one status count out of the `[{ approvalStatus, count }]` shape. */
const countFor = (rows, status) => {
  const hit = (rows || []).find((r) => r.approvalStatus === status);
  return hit ? Number(hit.count) : 0;
};

const ApprovalManagement = () => {
  const { user } = useAuth();
  const isTpo = user?.role === 'tpo';

  const [pending, setPending] = useState({ organizations: [], recruiters: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tab, setTab] = useState('organizations');
  const [selected, setSelected] = useState([]);
  // `{ action, scope: 'bulk' | 'one', type, item }`
  const [confirm, setConfirm] = useState(null);
  const [notes, setNotes] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [approvals, statsBody] = await Promise.all([
        api.get('/approvals/pending', { silent: true }),
        api.get('/approvals/stats', { silent: true })
      ]);
      setPending(approvals.data || { organizations: [], recruiters: [], total: 0 });
      setStats(statsBody.stats || null);
      setSelected([]);
    } catch (err) {
      setError(err?.message || 'Could not load the approval queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isTpo) load();
    else setLoading(false);
  }, [isTpo, load]);

  const orgs = pending.organizations || [];
  const recruiters = pending.recruiters || [];

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
      if (scope === 'one') {
        const path =
          type === 'organization'
            ? `/approvals/organizations/${item.id}`
            : `/approvals/recruiters/${item.id}`;
        await api.patch(path, { action, notes }, { silent: true });
        toast.success(`${type === 'organization' ? 'Company' : 'Recruiter'} ${action}d`);
      } else {
        // One request for the whole selection: the server applies it in a
        // single transaction, so the batch cannot land half-applied the way a
        // request-per-organization loop can.
        const body = await api.patch(
          '/approvals/organizations/bulk',
          { organizationIds: selected, action, notes },
          { silent: true }
        );
        const count = body?.updatedCount ?? selected.length;
        toast.success(`${count} compan${count === 1 ? 'y' : 'ies'} ${action}d`);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(err?.message || `Could not ${action} that record.`);
    } finally {
      setWorking(false);
    }
  };

  const tabs = useMemo(
    () => [
      { value: 'organizations', label: 'Companies', icon: BuildingOfficeIcon, count: orgs.length },
      { value: 'recruiters', label: 'Recruiters', icon: UserGroupIcon, count: recruiters.length }
    ],
    [orgs.length, recruiters.length]
  );

  if (!isTpo) {
    return (
      <PageShell>
        <PageHeader eyebrow="Approvals" title="Approval queue" />
        <EmptyState
          icon={LockClosedIcon}
          title="This queue belongs to a TPO"
          description="Company and recruiter approvals are scoped to one institution's placement officer. Administrators manage organizations from the admin dashboard instead."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Approvals"
        title="Approval queue"
        lead={
          user?.organization?.name
            ? `Companies and recruiters asking for access to ${user.organization.name}.`
            : 'Companies and recruiters asking for access to your institution.'
        }
      />

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Could not load approvals" description={error} onRetry={load} />
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Waiting"
              value={pending.total ?? 0}
              hint="Companies and recruiters combined"
              icon={InboxStackIcon}
              accent="saffron"
            />
            <StatTile
              label="Companies pending"
              value={orgs.length}
              icon={BuildingOfficeIcon}
              accent="ink"
            />
            <StatTile
              label="Recruiters pending"
              value={recruiters.length}
              icon={UserGroupIcon}
              accent="azure"
            />
            <StatTile
              label="Approved to date"
              value={
                countFor(stats?.organizations, 'approved') + countFor(stats?.recruiters, 'approved')
              }
              hint="Companies and recruiters"
              icon={CheckCircleIcon}
              accent="india"
            />
          </div>

          <Tabs className="mb-6 mt-8 w-fit" tabs={tabs} value={tab} onChange={setTab} />

          {tab === 'organizations' && (
            <>
              {orgs.length > 0 && (
                <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 py-3">
                  <Checkbox
                    checked={allSelected}
                    onChange={toggleAll}
                    label={`Select all (${selected.length}/${orgs.length})`}
                  />
                  {selected.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        icon={CheckIcon}
                        onClick={() => openConfirm('approve', 'bulk')}
                      >
                        Approve {selected.length}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={XMarkIcon}
                        onClick={() => openConfirm('reject', 'bulk')}
                      >
                        Reject {selected.length}
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {orgs.length === 0 ? (
                <EmptyState
                  icon={BuildingOfficeIcon}
                  title="No companies waiting"
                  description="Every company that asked for access has been reviewed."
                />
              ) : (
                <ul className="space-y-3">
                  {orgs.map((org) => (
                    <li key={org.id}>
                      <Card className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Checkbox
                            checked={selected.includes(org.id)}
                            onChange={() => toggleOne(org.id)}
                            label={<span className="sr-only">Select {org.name}</span>}
                          />
                          <Avatar src={org.logoUrl} name={org.name} size="md" />
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-bold text-ink-950">
                              {org.name}
                            </h3>
                            {org.contactEmail && (
                              <p className="truncate text-sm text-ink-600">{org.contactEmail}</p>
                            )}
                            {org.address && (
                              <p className="truncate text-xs text-ink-500">{org.address}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <StatusBadge status={org.approvalStatus} />
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
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'recruiters' &&
            (recruiters.length === 0 ? (
              <EmptyState
                icon={UserGroupIcon}
                title="No recruiters waiting"
                description="Every recruiter that asked for access has been reviewed."
              />
            ) : (
              <ul className="space-y-3">
                {recruiters.map((r) => (
                  <li key={r.id}>
                    <Card className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Avatar
                          src={r.profilePicture}
                          name={`${r.firstName} ${r.lastName}`}
                          size="md"
                        />
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold text-ink-950">
                            {r.firstName} {r.lastName}
                          </h3>
                          <p className="truncate text-sm text-ink-600">{r.email}</p>
                          <p className="truncate text-xs text-ink-500">
                            {[r.organization?.name, r.recruiterProfile?.position]
                              .filter(Boolean)
                              .join(' · ') || 'No company on record'}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <StatusBadge status={r.approvalStatus} />
                        <Button
                          size="sm"
                          variant="success"
                          icon={CheckIcon}
                          onClick={() => openConfirm('approve', 'one', 'recruiter', r)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={XMarkIcon}
                          onClick={() => openConfirm('reject', 'one', 'recruiter', r)}
                        >
                          Reject
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        title={
          confirm
            ? `${confirm.action === 'approve' ? 'Approve' : 'Reject'} ${
                confirm.scope === 'bulk'
                  ? `${selected.length} compan${selected.length === 1 ? 'y' : 'ies'}`
                  : confirm.type === 'organization'
                  ? confirm.item?.name
                  : `${confirm.item?.firstName} ${confirm.item?.lastName}`
              }?`
            : ''
        }
        description={
          confirm?.action === 'approve'
            ? 'They will immediately gain access to your institution.'
            : 'They will be told the request was declined. A reason helps.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.action === 'approve' ? 'success' : 'danger'}
              loading={working}
              onClick={runConfirmed}
            >
              {confirm?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <Textarea
          label="Notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={confirm?.action === 'approve' ? 'Optional' : 'Why is this being declined?'}
          help="Stored on the record for the audit trail."
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
