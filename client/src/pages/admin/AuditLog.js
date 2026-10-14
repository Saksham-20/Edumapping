// client/src/pages/admin/AuditLog.js
//
// The activity trail, as its own page.
//
// GET /api/audit was built and scoped (see server auditController) but only
// ever surfaced as a 40-row tab on the approvals screen. Scope is decided on
// the server, not here:
//
//   * an admin sees the whole platform;
//   * a TPO sees their own staff's actions plus every time an outside
//     recruiter was shown one of their students — the disclosures the
//     placement cell is accountable for.
//
// Filtering is by action; paging is server-side.
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import approvalService from '../../services/approvals';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Pagination,
  Select,
  SkeletonCard,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr
} from '../../components/ui';
import { ArrowPathIcon, ClipboardDocumentCheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';

// Grouped so the dropdown reads as a list of questions rather than raw codes.
// Anything not listed still appears in the unfiltered log.
const ACTION_GROUPS = [
  {
    label: 'Approvals',
    actions: [
      ['organization_approved', 'Organization approved'],
      ['organization_rejected', 'Organization rejected'],
      ['organization_verified', 'Organization verified'],
      ['recruiter_approved', 'Recruiter approved'],
      ['recruiter_rejected', 'Recruiter rejected'],
      ['user_approved', 'Account approved'],
      ['user_rejected', 'Account rejected'],
      ['job_posting_approved', 'Job posting approved'],
      ['job_posting_rejected', 'Job posting sent back']
    ]
  },
  {
    label: 'Accounts and organizations',
    adminOnly: true,
    actions: [
      ['admin_user_created', 'Account created (incl. placement officers)'],
      ['admin_user_updated', 'Account updated'],
      ['admin_user_deactivated', 'Account deactivated'],
      ['organization_created', 'Organization created'],
      ['organization_updated', 'Organization updated'],
      ['organization_deactivated', 'Organization deactivated'],
      ['organization_unverified', 'Organization verification removed'],
      ['recruiter_allowed_organizations_updated', 'Recruiter institutions changed']
    ]
  },
  {
    label: 'Student data access',
    actions: [
      ['recruiter_candidate_access', 'Recruiter viewed candidates'],
      ['recruiter_student_list_access', 'Recruiter searched students'],
      ['recruiter_profile_access', 'Recruiter opened a profile'],
      ['recruiter_file_access', 'Recruiter opened a file']
    ]
  },
  {
    label: 'Placement operations',
    actions: [
      ['announcement_sent', 'Announcement sent'],
      ['application_bulk_status_by_identifier', 'Bulk application update'],
      ['placement_sanction_changed', 'Placement sanction changed'],
      ['placement_policy_updated', 'Placement policy updated'],
      ['students_bulk_imported', 'Students imported'],
      ['student_verification_verify', 'Student record verified'],
      ['student_verification_bulk', 'Student records verified in bulk'],
      ['student_verification_reject', 'Student record sent back'],
      ['student_verification_unlock', 'Student record unlocked'],
      ['student_outcome_set', 'Student outcome recorded'],
      ['offer_raised', 'Offer raised'],
      ['offer_revoked', 'Offer revoked'],
      ['offer_accepted', 'Offer accepted'],
      ['offer_declined', 'Offer declined'],
      ['offer_letter_verified', 'Offer letter verified'],
      ['round_created', 'Selection round created'],
      ['round_updated', 'Selection round changed'],
      ['round_deleted', 'Selection round deleted'],
      ['round_participants_added', 'Students added to a round'],
      ['round_results_recorded', 'Round results recorded']
    ]
  }
];

/** Which entries are a recruiter seeing student data — highlighted in the table. */
const ACCESS_ACTIONS = new Set(ACTION_GROUPS.find((g) => g.label === 'Student data access').actions.map(([value]) => value));

const ROLE_TONES = { admin: 'ink', tpo: 'info', recruiter: 'purple', student: 'neutral' };

const PAGE_SIZE = 25;

const AuditLog = () => {
  const { user } = useAuth();
  const allowed = user?.role === 'admin' || user?.role === 'tpo';

  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await approvalService.getAuditLog(
        { page, limit: PAGE_SIZE, ...(action ? { action } : {}) },
        { silent: true }
      );
      setEntries(body.entries || []);
      setPagination(body.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 });
    } catch (err) {
      setEntries([]);
      setError(err?.message || 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <PageShell>
        <EmptyState
          icon={LockClosedIcon}
          title="Staff only"
          description="The audit log is available to placement officers and administrators."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Accountability"
        title="Audit log"
        lead={
          user.role === 'admin'
            ? 'Every recorded action on the platform, newest first.'
            : `Actions by ${user.organization?.name || 'your institution'}'s staff, and every time a recruiter was shown one of your students.`
        }
        actions={
          <Button variant="secondary" icon={ArrowPathIcon} loading={loading} onClick={load}>
            Refresh
          </Button>
        }
      />

      <Toolbar className="flex-wrap">
        <div className="w-full sm:w-80">
          <Select
            label="Action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {ACTION_GROUPS.filter((group) => !group.adminOnly || user?.role === 'admin').map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.actions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <p className="text-sm text-ink-600 sm:ml-auto sm:self-end sm:pb-2.5">
          {loading ? 'Loading…' : `${pagination.totalItems ?? entries.length} entr${(pagination.totalItems ?? entries.length) === 1 ? 'y' : 'ies'}`}
        </p>
      </Toolbar>

      {loading && <SkeletonCard lines={8} />}

      {!loading && error && <ErrorState title="Could not load the audit log" description={error} onRetry={load} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon={ClipboardDocumentCheckIcon}
          title={action ? 'No entries for this action' : 'Nothing recorded yet'}
          description="Approvals, posting decisions, announcements, offers and recruiter access to student records are recorded here as they happen."
          action={
            action ? (
              <Button variant="secondary" onClick={() => setAction('')}>
                Show all actions
              </Button>
            ) : undefined
          }
        />
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <Table>
            <Thead>
              <Tr className="hover:bg-transparent">
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th>Record</Th>
              </Tr>
            </Thead>
            <Tbody>
              {entries.map((e) => (
                <Tr key={e.id}>
                  <Td className="whitespace-nowrap tabular-nums text-ink-600">
                    <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
                  </Td>
                  <Td>
                    {e.by ? (
                      <div className="min-w-0">
                        <p className="font-medium text-ink-950">{e.by.name || e.by.email}</p>
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                          <Badge tone={ROLE_TONES[e.by.role] || 'neutral'}>
                            {String(e.by.role).replace(/_/g, ' ')}
                          </Badge>
                          {e.by.organization}
                        </p>
                      </div>
                    ) : (
                      <span className="text-ink-500">System</span>
                    )}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-2">
                      {ACCESS_ACTIONS.has(e.action) && <Badge tone="warning">data access</Badge>}
                      <span className="font-medium text-ink-900">{e.description}</span>
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-ink-500">
                    {e.entityName ? (
                      <span className="text-ink-800">{e.entityName}</span>
                    ) : e.entityType ? (
                      `${String(e.entityType).replace(/_/g, ' ')}${e.entityId ? ` #${e.entityId}` : ''}`
                    ) : (
                      '—'
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination
            className="mt-6"
            page={pagination.currentPage}
            pages={pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </PageShell>
  );
};

export default AuditLog;
