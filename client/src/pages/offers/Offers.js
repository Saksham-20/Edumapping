// client/src/pages/offers/Offers.js
//
// Offers, from both sides of the table.
//
// A student sees what they have been offered and answers it. A recruiter or
// placement officer sees what has been raised and can withdraw one, with a
// reason. The same list serves both because the server already scopes it — a
// student only ever receives their own rows.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  PageShell,
  SkeletonCard,
  StatTile,
  StatusBadge,
  Textarea
} from '../../components/ui';
import { BanknotesIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

// Indian salary conventions: a package is spoken about in lakhs, and the digit
// grouping is 2-2-3 rather than 3-3-3. `en-IN` gets the grouping right; the
// lakh figure is what a student actually compares offers on.
const formatCtc = (value, currency = 'INR') => {
  if (value === null || value === undefined) return 'Not disclosed';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Not disclosed';
  const grouped = n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  if (currency !== 'INR') return `${currency} ${grouped}`;
  const lakhs = n / 100000;
  return `₹${grouped}${lakhs >= 1 ? ` · ${Number(lakhs.toFixed(2))} LPA` : ''}`;
};

const Offers = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const [offers, setOffers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statsBody] = await Promise.all([
        api.get('/offers', { params: { limit: 100 }, silent: true }),
        isStudent
          ? Promise.resolve(null)
          : api.get('/offers/stats', { silent: true }).catch(() => null)
      ]);
      setOffers(list.offers || []);
      setStats(statsBody?.stats || null);
    } catch (err) {
      setError(err?.message || 'Could not load offers.');
    } finally {
      setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (offer, action) => {
    setBusyId(offer.id);
    try {
      await api.patch(`/offers/${offer.id}/respond`, { action }, { silent: true });
      toast.success(action === 'accept' ? 'Offer accepted' : 'Offer declined');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record your response');
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async () => {
    setBusyId(revoking.id);
    try {
      await api.patch(`/offers/${revoking.id}/revoke`, { reason }, { silent: true });
      toast.success('Offer withdrawn');
      setRevoking(null);
      setReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not withdraw the offer');
    } finally {
      setBusyId(null);
    }
  };

  const live = useMemo(
    () => offers.filter((o) => o.status === 'offered' || o.status === 'accepted'),
    [offers]
  );

  if (loading) {
    return (
      <PageShell>
        <PageHeader eyebrow="Offers" title="Offers" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Offers"
        title={isStudent ? 'My offers' : 'Offers raised'}
        lead={
          isStudent
            ? 'Every offer made to you, and what you have said about it.'
            : 'Packages raised against applications, and their outcomes.'
        }
      />

      {!isStudent && stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Live offers" value={stats.total} hint="Outstanding and accepted" />
          <StatTile
            label="Median package"
            value={stats.medianCtc === null ? '—' : formatCtc(stats.medianCtc)}
            hint={
              stats.withCtc === 0
                ? 'No packages recorded yet'
                : `From ${stats.withCtc} offer${stats.withCtc === 1 ? '' : 's'} with a package`
            }
          />
          <StatTile
            label="Highest"
            value={stats.highestCtc === null ? '—' : formatCtc(stats.highestCtc)}
          />
          <StatTile label="Accepted" value={stats.accepted} hint={`${stats.ppo} PPO`} />
        </div>
      )}

      {error ? (
        <ErrorState title="Could not load offers" description={error} onRetry={load} />
      ) : offers.length === 0 ? (
        <EmptyState
          icon={BanknotesIcon}
          title={isStudent ? 'No offers yet' : 'No offers raised yet'}
          description={
            isStudent
              ? 'When a company makes you an offer it will appear here, with the package and your response.'
              : 'Raise an offer from an application once a candidate has been selected.'
          }
          action={
            isStudent ? (
              <Button as={Link} to="/jobs">
                Browse jobs
              </Button>
            ) : (
              <Button as={Link} to="/applications">
                Go to applications
              </Button>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {offers.map((offer) => (
            <li key={offer.id}>
              <Card className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Avatar
                    src={offer.organization?.logoUrl}
                    name={offer.organization?.name || 'Company'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-ink-950">
                      {offer.roleTitle || offer.job?.title}
                    </h2>
                    <p className="truncate text-sm text-ink-600">
                      {offer.organization?.name}
                      {offer.location ? ` · ${offer.location}` : ''}
                      {offer.isPPO ? ' · PPO' : ''}
                    </p>
                    {!isStudent && offer.student && (
                      <p className="truncate text-xs text-ink-500">
                        {offer.student.firstName} {offer.student.lastName}
                        {offer.student.studentProfile?.studentId
                          ? ` · ${offer.student.studentProfile.studentId}`
                          : ''}
                      </p>
                    )}
                    <p className="mt-1.5 font-semibold text-ink-950">
                      {formatCtc(offer.ctc, offer.currency)}
                    </p>
                    {offer.status === 'revoked' && offer.revokedReason && (
                      <p className="mt-1 text-sm text-ink-700">
                        Withdrawn: {offer.revokedReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <StatusBadge status={offer.status} />
                  {isStudent && offer.status === 'offered' && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        loading={busyId === offer.id}
                        onClick={() => respond(offer, 'accept')}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === offer.id}
                        onClick={() => respond(offer, 'decline')}
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {!isStudent && offer.status !== 'revoked' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setReason('');
                        setRevoking(offer);
                      }}
                    >
                      Withdraw
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {isStudent && live.length > 1 && (
        <Card className="mt-6 border-saffron-500/40 bg-saffron-50">
          <div className="flex gap-3">
            <BriefcaseIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-saffron-800" />
            <p className="text-sm text-ink-700">
              You are holding {live.length} offers. Most placement cells allow only one — check
              your institution&rsquo;s policy before accepting a second.
            </p>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        size="sm"
        title="Withdraw this offer?"
        description="The student is told immediately, and is counted as unplaced again unless they hold another offer."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyId === revoking?.id}
              disabled={reason.trim().length < 3}
              onClick={revoke}
            >
              Withdraw offer
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Headcount freeze for the quarter"
          help="Sent to the student and recorded against the offer. Required."
        />
      </Modal>
    </PageShell>
  );
};

export default Offers;
