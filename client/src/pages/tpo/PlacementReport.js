// client/src/pages/tpo/PlacementReport.js
//
// The batch's placement outcome in the shape NIRF ("Graduation Outcomes") and
// NAAC criterion 5.2 ask for: placed and higher-studies rates over students
// who did not opt out, median and spread of CTC, per programme, with the
// recruiters behind them. Downloadable as an Excel workbook for submission.
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { ArrowDownTrayIcon, DocumentChartBarIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Select,
  SkeletonCard,
  StatStrip,
  StatTile,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '../../components/ui';
import placementService from '../../services/placement';
import { formatSalary } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const currentYear = new Date().getFullYear();
const YEARS = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
const ctc = (v) => (v ? formatSalary(v, v) : '—');

const PlacementReport = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [year, setYear] = useState(String(currentYear));
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  // A failed load used to fall through to "No students in this batch", which
  // reads as a fact about the batch rather than a problem to retry.
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get('/organizations?limit=200')
      .then((res) => {
        const list = (res.organizations || res.data || []).filter((o) => ['university', 'college'].includes(o.type));
        setOrgs(list);
        if (list[0]) setOrgId(String(list[0].id));
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && !orgId) return;
    setLoading(true);
    setLoadError('');
    placementService
      .getReport({ graduationYear: year || undefined, organizationId: isAdmin ? orgId : undefined })
      .then((res) => setReport(res.report))
      .catch((err) => {
        setReport(null);
        setLoadError(err?.message || 'Could not load the report.');
      })
      .finally(() => setLoading(false));
  }, [year, orgId, isAdmin, attempt]);

  const download = async () => {
    setDownloading(true);
    try {
      await placementService.downloadReport({ graduationYear: year || undefined, organizationId: isAdmin ? orgId : undefined });
    } catch {
      // api toasts
    } finally {
      setDownloading(false);
    }
  };

  const s = report?.summary;
  // Students outside this report, so "0 of 1 eligible" for a college with
  // five accounts explains itself.
  const nc = report?.notCounted || {};
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const notCountedParts = [
    nc.otherBatches > 0 && `${plural(nc.otherBatches, 'student is', 'students are')} in other batches`,
    nc.noBatch > 0 && `${plural(nc.noBatch, 'has', 'have')} no graduation year`,
    nc.noProfile > 0 && `${plural(nc.noProfile, 'account has', 'accounts have')} no student profile yet`
  ].filter(Boolean);
  const notCountedNote = notCountedParts.length ? `Not counted here: ${notCountedParts.join('; ')}.` : '';

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow={report?.institution || user?.organization?.name || 'Placement cell'}
        title="Placement report"
        lead="Batch outcomes in the format NIRF and NAAC ask for. Only live offers count, and each student counts once at their best offer."
        actions={
          <>
            {isAdmin && (
              <Select aria-label="Institution" value={orgId} onChange={(e) => setOrgId(e.target.value)} className="w-56">
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            )}
            <Select aria-label="Batch" value={year} onChange={(e) => setYear(e.target.value)} className="w-40">
              <option value="">All batches</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y} batch
                </option>
              ))}
            </Select>
            <Button icon={ArrowDownTrayIcon} loading={downloading} onClick={download} disabled={!s?.students}>
              Excel
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState title="Could not load the report" description={loadError} onRetry={() => setAttempt((n) => n + 1)} />
      ) : !s || s.students === 0 ? (
        <EmptyState
          icon={DocumentChartBarIcon}
          title="No students in this batch"
          description="Students appear here once their profile has a graduation year."
        />
      ) : (
        <>
          <StatStrip className="mb-8">
            <StatTile label="Placement rate" value={`${s.placementRate}%`} hint={`${s.placed} of ${s.eligible} eligible students`} accent="india" />
            <StatTile label="Placed + higher studies" value={`${s.outcomeRate}%`} hint={`${s.higherStudies} went on to higher studies`} accent="azure" />
            <StatTile label="Median CTC" value={ctc(s.medianCtc)} hint={`Average ${ctc(s.averageCtc)}`} accent="saffron" />
            <StatTile label="Highest CTC" value={ctc(s.highestCtc)} hint={`${s.totalOffers} offer${s.totalOffers === 1 ? '' : 's'} · ${s.ppos} PPO${s.ppos === 1 ? '' : 's'}`} />
          </StatStrip>

          {notCountedNote && (
            <p className="-mt-4 mb-8 rounded-xl border border-ink-950/10 bg-bone-50 px-4 py-3 text-sm text-ink-700">
              {notCountedNote}
              {!isAdmin && (
                <>
                  {' '}
                  <Link to="/tpo/students" className="font-medium text-azure-700 underline-offset-2 hover:underline">
                    Review the roster
                  </Link>
                </>
              )}
            </p>
          )}

          <Card padded={false} className="mb-8">
            <div className="p-5 sm:p-6">
              <CardHeader title="By programme" description="Opted-out students are excluded from the denominator, as NIRF requires." />
            </div>
            <Table className="rounded-none border-x-0 border-b-0">
              <Thead>
                <tr>
                  <Th>Programme — branch</Th>
                  <Th className="text-right">Students</Th>
                  <Th className="text-right">Eligible</Th>
                  <Th className="text-right">Placed</Th>
                  <Th className="text-right">Higher studies</Th>
                  <Th className="text-right">Rate</Th>
                  <Th className="text-right">Median</Th>
                  <Th className="text-right">Highest</Th>
                  <Th className="text-right">Lowest</Th>
                </tr>
              </Thead>
              <Tbody>
                {report.byProgramme.map((r) => (
                  <Tr key={r.label}>
                    <Td className="font-medium text-ink-950">{r.label}</Td>
                    <Td className="text-right tabular-nums">{r.students}</Td>
                    <Td className="text-right tabular-nums">{r.eligible}</Td>
                    <Td className="text-right tabular-nums">{r.placed}</Td>
                    <Td className="text-right tabular-nums">{r.higherStudies}</Td>
                    <Td className="text-right">
                      <Badge tone={r.placementRate >= 75 ? 'success' : r.placementRate >= 50 ? 'warning' : 'neutral'}>{r.placementRate}%</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{ctc(r.medianCtc)}</Td>
                    <Td className="text-right tabular-nums">{ctc(r.highestCtc)}</Td>
                    <Td className="text-right tabular-nums">{ctc(r.lowestCtc)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recruiters" description="Companies that made live offers to this batch." />
              <ul className="mt-4 divide-y divide-ink-950/10">
                {report.recruiters.length === 0 && <li className="py-3 text-sm text-ink-500">No offers yet.</li>}
                {report.recruiters.map((r) => (
                  <li key={r.company} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium text-ink-950">{r.company}</span>
                    <span className="text-ink-600">
                      {r.offers} offer{r.offers > 1 ? 's' : ''} · up to {ctc(r.highestCtc)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Evidence" description="NAAC peer teams sample offer letters. Verify them under Offers." />
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.07em] text-ink-500">Offer letters verified</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-ink-950">
                    {s.offerLettersVerified} / {s.placed}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.07em] text-ink-500">Unplaced</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-ink-950">{s.unplaced}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.07em] text-ink-500">Opted out</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-ink-950">{s.optedOut}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.07em] text-ink-500">Deferred</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-ink-950">{s.deferred}</dd>
                </div>
              </dl>
              {Object.keys(report.tiers || {}).length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {Object.entries(report.tiers).map(([name, n]) => (
                    <Badge key={name} tone="info">
                      {name}: {n}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
};

export default PlacementReport;
