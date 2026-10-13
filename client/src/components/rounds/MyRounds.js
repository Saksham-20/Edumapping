// client/src/components/rounds/MyRounds.js
//
// A student's selection rounds — what is next, when, where — across every
// application, or for one application when `applicationId` is given. The one
// thing students ask the placement cell on drive day.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClockIcon, MapPinIcon, VideoCameraIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { Badge, Card, CardHeader, cx } from '../ui';
import placementService from '../../services/placement';
import { ROUND_TYPES, formatWhen } from './RoundsManager';

const RESULT = {
  cleared: ['success', 'Cleared'],
  not_cleared: ['danger', 'Not cleared'],
  absent: ['warning', 'Absent'],
  pending: ['info', 'You are in this round']
};

const MyRounds = ({ applicationId, title = 'Your selection rounds', limit, compact = false }) => {
  const [rounds, setRounds] = useState(null);

  useEffect(() => {
    placementService
      .getMyRounds(applicationId ? { applicationId } : undefined)
      .then((res) => setRounds(res.rounds || []))
      .catch(() => setRounds([]));
  }, [applicationId]);

  if (!rounds || rounds.length === 0) return null;

  // What the student still has to show up for comes first: rounds they are in
  // with no result yet, then rounds of their drives they have not reached,
  // then rounds already decided; cancelled last. Within a group, by date.
  const now = Date.now();
  const rank = (r) => {
    if (r.status === 'cancelled') return 4;
    if (r.participation?.result === 'pending') return 0;
    if (!r.participation) return 1;
    return 2;
  };
  const sorted = [...rounds].sort(
    (a, b) => rank(a) - rank(b) || new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0)
  );
  const ordered = applicationId ? [...rounds].sort((a, b) => a.sequence - b.sequence) : sorted;
  const shown = limit ? ordered.slice(0, limit) : ordered;

  return (
    <Card className={compact ? '' : 'mb-8'}>
      <CardHeader title={title} description={applicationId ? 'The steps of this drive.' : 'Rounds you have been shortlisted for, and what comes next.'} />
      <ol className="mt-4 space-y-3">
        {shown.map((r) => {
          const p = r.participation;
          const [tone, label] = p ? RESULT[p.result] : ['neutral', 'Not shortlisted yet'];
          const upcoming = p?.result === 'pending' && r.status !== 'cancelled' && r.scheduledAt && new Date(r.scheduledAt) > now;
          return (
            <li
              key={r.id}
              className={cx('rounded-2xl border p-4', upcoming ? 'border-saffron-500/50 bg-saffron-50/60' : 'border-ink-950/15', !p && 'opacity-70')}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {!applicationId && r.job && (
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
                      {r.job.organization?.name} · {r.job.title}
                    </p>
                  )}
                  <p className="mt-0.5 font-semibold text-ink-950">
                    Round {r.sequence}: {r.name}
                    <span className="ml-2 text-xs font-normal text-ink-500">{ROUND_TYPES[r.roundType]}</span>
                  </p>
                </div>
                <Badge tone={r.status === 'cancelled' ? 'danger' : tone}>{r.status === 'cancelled' ? 'Cancelled' : label}</Badge>
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-700">
                <span className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" aria-hidden="true" />
                  {formatWhen(p?.slotAt || r.scheduledAt)}
                  {p?.slotAt && <span className="text-xs text-ink-500">(your slot{p.panel ? `, panel ${p.panel}` : ''})</span>}
                </span>
                {p && (
                  <span className="flex items-center gap-1">
                    {r.mode === 'online' ? <VideoCameraIcon className="h-4 w-4" aria-hidden="true" /> : <MapPinIcon className="h-4 w-4" aria-hidden="true" />}
                    {r.mode === 'online' ? (
                      r.meetingLink ? (
                        <a href={r.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-azure-700 hover:underline">
                          Join link <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        'Online — link to follow'
                      )
                    ) : (
                      r.venue || 'Venue to be announced'
                    )}
                  </span>
                )}
              </p>
              {p && r.instructions && <p className="mt-2 whitespace-pre-line rounded-xl bg-white/70 p-3 text-sm text-ink-700">{r.instructions}</p>}
              {!applicationId && r.applicationId && (
                <Link to={`/applications/${r.applicationId}`} className="mt-2 inline-block text-xs font-semibold text-ink-950 hover:underline">
                  View application →
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
};

export default MyRounds;
