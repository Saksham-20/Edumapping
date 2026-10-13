// client/src/pages/tpo/Students.js
//
// The placement cell's student roster: who is in the batch, whether their
// academic record has been checked against marksheets, where each student
// stands in the season, and the actions a cell takes on them — verify, send
// back, unlock, record an outcome that is not a job.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AcademicCapIcon,
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  CheckIcon,
  LockOpenIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
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
  Tr,
  Textarea,
  Tabs,
  cx
} from '../../components/ui';
import placementService from '../../services/placement';
import { useAuth } from '../../contexts/AuthContext';
import { formatSalary } from '../../utils/helpers';
import openProtectedFile from '../../utils/openProtectedFile';
import { Stamp } from '../../components/brand';
import ImportStudentsModal from '../../components/placement/ImportStudentsModal';

const VERIFICATION_TONES = { verified: 'attest', pending: 'warning', rejected: 'danger', unverified: 'neutral' };
const VERIFICATION_LABELS = { verified: 'Verified', pending: 'Awaiting review', rejected: 'Sent back', unverified: 'Not submitted' };
const OUTCOME_TONES = { placed: 'success', unplaced: 'neutral', deferred: 'warning', higher_studies: 'info', opted_out: 'neutral' };
const OUTCOME_LABELS = {
  placed: 'Placed',
  unplaced: 'Unplaced',
  deferred: 'Deferred',
  higher_studies: 'Higher studies',
  opted_out: 'Opted out'
};

const currentYear = new Date().getFullYear();
const BATCHES = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

const Students = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ students: [], pagination: {}, verificationSummary: {} });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [review, setReview] = useState(null); // { student, action }
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [importOpen, setImportOpen] = useState(false);

  const filters = useMemo(
    () => ({
      verificationStatus: searchParams.get('verificationStatus') || '',
      placementStatus: searchParams.get('placementStatus') || '',
      graduationYear: searchParams.get('graduationYear') || '',
      branch: searchParams.get('branch') || '',
      search: searchParams.get('search') || '',
      sort: searchParams.get('sort') || 'name',
      page: searchParams.get('page') || '1'
    }),
    [searchParams]
  );

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await placementService.getStudents({ ...filters, limit: 25 });
      setData(res);
      setSelected(new Set());
    } catch {
      setData({ students: [], pagination: {}, verificationSummary: {} });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data.verificationSummary || {};
  const tabs = [
    { value: '', label: 'All students' },
    { value: 'pending', label: 'Awaiting review', count: summary.pending || 0 },
    { value: 'verified', label: 'Verified', count: summary.verified || 0 },
    { value: 'rejected', label: 'Sent back', count: summary.rejected || 0 },
    { value: 'unverified', label: 'Not submitted', count: summary.unverified || 0 }
  ];

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allOnPage = data.students.length > 0 && data.students.every((s) => selected.has(s.id));

  const runReview = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await placementService.reviewVerification(review.student.id, review.action, notes.trim() || undefined);
      toast.success(
        review.action === 'verify' ? 'Profile verified and locked' : review.action === 'reject' ? 'Sent back to the student' : 'Profile unlocked'
      );
      setReview(null);
      setNotes('');
      load();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  const verifySelected = async () => {
    setBusy(true);
    try {
      const res = await placementService.bulkVerify([...selected]);
      toast.success(res.message);
      load();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  const setOutcome = async (student, placementStatus) => {
    try {
      const res = await placementService.setOutcome(student.id, placementStatus);
      toast.success(`${student.firstName}: ${OUTCOME_LABELS[res.placementStatus] || res.placementStatus}`);
      load();
    } catch {
      // api toasts
    }
  };

  const onSearch = (e) => {
    e.preventDefault();
    setFilter('search', search.trim());
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={user?.organization?.name || 'Placement cell'}
        title="Students"
        lead="Verify academic records against marksheets, track each student's outcome, and keep the batch ready for drives."
        actions={
          <>
            <Button variant="secondary" icon={ArrowUpTrayIcon} onClick={() => setImportOpen(true)}>
              Import students
            </Button>
            <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => placementService.exportStudents(filters)}>
              Export CSV
            </Button>
          </>
        }
      />

      <Tabs tabs={tabs} value={filters.verificationStatus} onChange={(v) => setFilter('verificationStatus', v)} className="mb-5" />

      <Card className="mb-5" padded={false}>
        <form onSubmit={onSearch} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input
              aria-label="Search students"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email or roll number"
              className="pl-10"
            />
          </div>
          <Select aria-label="Batch" value={filters.graduationYear} onChange={(e) => setFilter('graduationYear', e.target.value)}>
            <option value="">All batches</option>
            {BATCHES.map((y) => (
              <option key={y} value={y}>
                {y} batch
              </option>
            ))}
          </Select>
          <Select aria-label="Outcome" value={filters.placementStatus} onChange={(e) => setFilter('placementStatus', e.target.value)}>
            <option value="">Any outcome</option>
            {Object.entries(OUTCOME_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            <option value="name">Sort by name</option>
            <option value="cgpa">Sort by CGPA</option>
            <option value="recent">Recently added</option>
          </Select>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {selected.size > 0 && (
        <div className="sticky top-20 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-950 bg-ink-950 px-4 py-3 text-white shadow-lift-lg">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="flex gap-2">
            <Button size="sm" variant="light" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="saffron" icon={CheckBadgeIcon} loading={busy} onClick={verifySelected}>
              Verify selected
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data.students.length === 0 ? (
        <EmptyState
          icon={AcademicCapIcon}
          title="No students match"
          description={
            filters.search || filters.verificationStatus || filters.placementStatus || filters.graduationYear
              ? 'Try clearing a filter.'
              : 'Import your batch from a spreadsheet to get started.'
          }
          action={
            <Button icon={ArrowUpTrayIcon} onClick={() => setImportOpen(true)}>
              Import students
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPage}
                    onChange={() =>
                      setSelected(allOnPage ? new Set() : new Set(data.students.map((s) => s.id)))
                    }
                    className="rounded border-ink-950/30 text-ink-950 focus:ring-ink-950"
                  />
                </Th>
                <Th>Student</Th>
                <Th>Programme</Th>
                <Th className="text-right">CGPA</Th>
                <Th>Record</Th>
                <Th>Season</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {data.students.map((s) => (
                <Tr key={s.id} className={cx(selected.has(s.id) && 'bg-saffron-50/60')}>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.firstName} ${s.lastName}`}
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="rounded border-ink-950/30 text-ink-950 focus:ring-ink-950"
                    />
                  </Td>
                  <Td>
                    <Link to={`/users/${s.id}`} className="font-semibold text-ink-950 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                    <p className="font-mono text-xs text-ink-500">{s.rollNumber || 'No roll number'}</p>
                  </Td>
                  <Td>
                    <p className="max-w-[16rem] truncate">{s.branch || '—'}</p>
                    <p className="text-xs text-ink-500">{s.graduationYear ? `${s.graduationYear} batch` : 'Batch not set'}</p>
                  </Td>
                  <Td className="text-right font-mono tabular-nums">
                    {s.cgpa != null ? s.cgpa.toFixed(2) : '—'}
                    {s.activeBacklogs > 0 && <p className="text-xs text-red-700">{s.activeBacklogs} backlog(s)</p>}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      {s.verificationStatus === 'verified' ? (
                        <Stamp size="sm" rotate={-3}>
                          Verified
                        </Stamp>
                      ) : (
                        <Badge tone={VERIFICATION_TONES[s.verificationStatus]} dot>
                          {VERIFICATION_LABELS[s.verificationStatus]}
                        </Badge>
                      )}
                      {s.hasMarksheet && (
                        <button
                          type="button"
                          onClick={() => openProtectedFile(s.marksheetUrl)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-azure-700 hover:underline"
                        >
                          <DocumentTextIcon className="h-3.5 w-3.5" aria-hidden="true" /> Marksheets
                        </button>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={OUTCOME_TONES[s.placementStatus]}>{OUTCOME_LABELS[s.placementStatus] || s.placementStatus}</Badge>
                      <span className="text-xs text-ink-500">
                        {s.applications} applied
                        {s.liveOffers > 0 && ` · ${s.liveOffers} offer${s.liveOffers > 1 ? 's' : ''} (best ${formatSalary(s.bestOfferCtc, s.bestOfferCtc)})`}
                      </span>
                      {s.placementSanction !== 'none' && <Badge tone="danger">{s.placementSanction === 'removed' ? 'Removed' : 'Blocked'}</Badge>}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {s.verificationStatus !== 'verified' ? (
                        <>
                          <Button size="sm" variant="attest" icon={CheckIcon} disabled={!s.hasProfile} onClick={() => setReview({ student: s, action: 'verify' })}>
                            Verify
                          </Button>
                          {s.verificationStatus === 'pending' && (
                            <Button size="sm" variant="secondary" icon={ArrowUturnLeftIcon} onClick={() => setReview({ student: s, action: 'reject' })}>
                              Send back
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" icon={LockOpenIcon} onClick={() => setReview({ student: s, action: 'unlock' })}>
                          Unlock
                        </Button>
                      )}
                      <Select
                        aria-label={`Record outcome for ${s.firstName}`}
                        value=""
                        onChange={(e) => e.target.value && setOutcome(s, e.target.value)}
                        className="w-36 !py-1.5 text-xs"
                        disabled={!s.hasProfile}
                      >
                        <option value="">Set outcome…</option>
                        <option value="higher_studies">Higher studies</option>
                        <option value="opted_out">Opted out</option>
                        <option value="deferred">Deferred</option>
                        <option value="auto">From offers (auto)</option>
                      </Select>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {data.pagination?.totalPages > 1 && (
            <Pagination
              className="mt-6"
              page={data.pagination.currentPage}
              pages={data.pagination.totalPages}
              onChange={(p) => setFilter('page', String(p))}
            />
          )}
          <p className="mt-3 text-xs text-ink-500">{data.pagination?.totalItems} students</p>
        </>
      )}

      <ImportStudentsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />

      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={
          review?.action === 'verify'
            ? 'Verify academic record'
            : review?.action === 'reject'
              ? 'Send back for corrections'
              : 'Unlock academic record'
        }
        description={
          review &&
          (review.action === 'verify'
            ? `Confirm ${review.student.firstName}'s CGPA, Class X/XII and backlogs match their marksheets. The record is then locked against edits.`
            : review.action === 'reject'
              ? `Tell ${review.student.firstName} what to correct. They can edit and resubmit.`
              : `${review.student.firstName} will be able to edit their academic details again and must resubmit them.`)
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>
              Cancel
            </Button>
            <Button
              variant={review?.action === 'verify' ? 'attest' : 'primary'}
              loading={busy}
              disabled={review?.action === 'reject' && !notes.trim()}
              onClick={runReview}
            >
              {review?.action === 'verify' ? 'Verify and lock' : review?.action === 'reject' ? 'Send back' : 'Unlock'}
            </Button>
          </>
        }
      >
        {review && (
          <dl className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-ink-950/10 bg-bone-50 p-4 text-sm">
            {[
              ['Roll number', review.student.rollNumber],
              ['Branch', review.student.branch],
              ['Batch', review.student.graduationYear],
              ['CGPA', review.student.cgpa],
              ['Class X', review.student.class10Percentage != null ? `${review.student.class10Percentage}%` : null],
              ['Class XII', review.student.class12Percentage != null ? `${review.student.class12Percentage}%` : null],
              ['Active backlogs', review.student.activeBacklogs]
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-[0.07em] text-ink-500">{k}</dt>
                <dd className="font-medium text-ink-950">{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
        <Textarea
          label={review?.action === 'reject' ? 'What needs fixing' : 'Note (optional)'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          required={review?.action === 'reject'}
          placeholder={review?.action === 'reject' ? 'e.g. Class XII percentage does not match the marksheet (78.4%).' : ''}
        />
      </Modal>
    </PageShell>
  );
};

export default Students;
