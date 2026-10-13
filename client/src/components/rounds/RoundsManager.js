// client/src/components/rounds/RoundsManager.js
//
// A drive's selection rounds, for the people running it: schedule each round,
// put students into it (everyone who applied, everyone who cleared the round
// before, or a pasted list of roll numbers), and record who cleared. Every
// step notifies the students concerned.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MapPinIcon,
  VideoCameraIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, Input, Modal, Select, Textarea, cx } from '../ui';
import placementService from '../../services/placement';

export const ROUND_TYPES = {
  aptitude: 'Aptitude / online test',
  coding: 'Coding test',
  group_discussion: 'Group discussion',
  technical: 'Technical interview',
  hr: 'HR interview',
  other: 'Other'
};
const RESULT_TONES = { pending: 'neutral', cleared: 'success', not_cleared: 'danger', absent: 'warning' };
const RESULT_LABELS = { pending: 'Pending', cleared: 'Cleared', not_cleared: 'Not cleared', absent: 'Absent' };

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
export const formatWhen = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : 'Time to be announced';

const EMPTY_ROUND = { name: '', roundType: 'aptitude', scheduledAt: '', endsAt: '', mode: 'on_campus', venue: '', meetingLink: '', instructions: '' };
const splitList = (text) => text.split(/[\s,;]+/).map((v) => v.trim()).filter(Boolean);

const RoundsManager = ({ jobId }) => {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // round object or EMPTY_ROUND
  const [adding, setAdding] = useState(null); // round
  const [resulting, setResulting] = useState(null); // round
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [addMode, setAddMode] = useState('all');
  const [resultValue, setResultValue] = useState('cleared');
  const [rejectOthers, setRejectOthers] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await placementService.getRounds(jobId);
      setRounds(res.rounds || []);
    } catch {
      setRounds([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRound = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      ...editing,
      scheduledAt: fromLocalInput(editing.scheduledAt),
      endsAt: fromLocalInput(editing.endsAt),
      meetingLink: editing.meetingLink || null
    };
    delete payload.participants;
    delete payload.counts;
    try {
      if (editing.id) {
        await placementService.updateRound(editing.id, payload);
        toast.success('Round updated — students in it were notified of any change');
      } else {
        await placementService.createRound({ ...payload, jobId });
        toast.success('Round scheduled');
      }
      setEditing(null);
      load();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  const removeRound = async (round) => {
    if (!window.confirm(`Delete ${round.name}? Its participant list and results are removed too.`)) return;
    try {
      await placementService.deleteRound(round.id);
      toast.success('Round deleted');
      load();
    } catch {
      // api toasts
    }
  };

  const submitAdd = async () => {
    setBusy(true);
    const body =
      addMode === 'all'
        ? { allApplicants: true }
        : addMode === 'previous'
          ? { fromPreviousRound: true }
          : { identifiers: splitList(paste) };
    try {
      const res = await placementService.addParticipants(adding.id, body);
      toast.success(res.message);
      if (res.unknown?.length) toast(`Not found: ${res.unknown.slice(0, 5).join(', ')}${res.unknown.length > 5 ? '…' : ''}`);
      setAdding(null);
      setPaste('');
      setOpen((o) => ({ ...o, [adding.id]: true }));
      load();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  const submitResults = async () => {
    setBusy(true);
    try {
      const res = await placementService.recordResults(resulting.id, {
        result: resultValue,
        identifiers: splitList(paste),
        rejectOthers
      });
      toast.success(`${res.message}${res.markedNotCleared ? `, ${res.markedNotCleared} marked not cleared` : ''}`);
      setResulting(null);
      setPaste('');
      setRejectOthers(false);
      load();
    } catch {
      // api toasts
    } finally {
      setBusy(false);
    }
  };

  const setOne = async (round, participant, result) => {
    try {
      await placementService.updateParticipant(round.id, participant.id, { result });
      load();
    } catch {
      // api toasts
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader
        title="Selection rounds"
        description="Schedule the drive's rounds, shortlist into each, and record results. Students are notified at every step."
        actions={
          <Button size="sm" icon={PlusIcon} onClick={() => setEditing({ ...EMPTY_ROUND, name: rounds.length ? '' : 'Online assessment' })}>
            Add round
          </Button>
        }
      />

      {loading ? (
        <p className="mt-6 text-sm text-ink-500">Loading rounds…</p>
      ) : rounds.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={ClipboardDocumentListIcon}
          title="No rounds yet"
          description="A typical drive: online test → technical interview → HR interview."
        />
      ) : (
        <ol className="relative mt-6 space-y-4 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-ink-950/15">
          {rounds.map((r) => {
            const c = r.counts || {};
            const expanded = open[r.id];
            return (
              <li key={r.id} className="relative pl-11">
                <span
                  className={cx(
                    'absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold',
                    r.status === 'completed' ? 'border-india-700 bg-india-600 text-white' : r.status === 'cancelled' ? 'border-red-700 bg-red-50 text-red-700' : 'border-ink-950 bg-white text-ink-950'
                  )}
                >
                  {r.sequence}
                </span>
                <div className="rounded-2xl border border-ink-950/15 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-950">
                        {r.name}
                        <Badge>{ROUND_TYPES[r.roundType]}</Badge>
                        {r.status !== 'scheduled' && <Badge tone={r.status === 'cancelled' ? 'danger' : 'success'}>{r.status.replace('_', ' ')}</Badge>}
                        {r.organization && <Badge tone="info">{r.organization.name} only</Badge>}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" aria-hidden="true" />
                          {formatWhen(r.scheduledAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          {r.mode === 'online' ? <VideoCameraIcon className="h-4 w-4" aria-hidden="true" /> : <MapPinIcon className="h-4 w-4" aria-hidden="true" />}
                          {r.mode === 'online' ? 'Online' : r.venue || 'Venue TBA'}
                        </span>
                      </p>
                    </div>
                    {r.canEdit && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="secondary" icon={UserPlusIcon} onClick={() => { setAddMode(r.sequence > 1 ? 'previous' : 'all'); setAdding(r); }}>
                          Add students
                        </Button>
                        <Button size="sm" variant="secondary" icon={CheckCircleIcon} disabled={!c.total} onClick={() => { setResultValue('cleared'); setResulting(r); }}>
                          Results
                        </Button>
                        <IconButton
                          icon={PencilSquareIcon}
                          label="Edit round"
                          size="sm"
                          onClick={() => setEditing({ ...r, scheduledAt: toLocalInput(r.scheduledAt), endsAt: toLocalInput(r.endsAt) })}
                        />
                        <IconButton icon={TrashIcon} label="Delete round" size="sm" variant="danger" onClick={() => removeRound(r)} />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                    aria-expanded={Boolean(expanded)}
                    className="mt-3 flex w-full items-center gap-2 rounded-xl bg-bone-50 px-3 py-2 text-left text-sm text-ink-700 hover:bg-bone-100"
                  >
                    <span className="font-semibold text-ink-950">{c.total || 0} in round</span>
                    {c.cleared ? <Badge tone="success">{c.cleared} cleared</Badge> : null}
                    {c.not_cleared ? <Badge tone="danger">{c.not_cleared} not cleared</Badge> : null}
                    {c.absent ? <Badge tone="warning">{c.absent} absent</Badge> : null}
                    {c.pending ? <Badge>{c.pending} pending</Badge> : null}
                    <ChevronDownIcon className={cx('ml-auto h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                  </button>

                  {expanded && (
                    <ul className="mt-2 divide-y divide-ink-950/10">
                      {r.participants.length === 0 && <li className="py-3 text-sm text-ink-500">Nobody added yet.</li>}
                      {r.participants.map((p) => {
                        const st = p.application?.student;
                        return (
                          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                            <span className="min-w-0 flex-1">
                              <span className="font-medium text-ink-950">
                                {st?.firstName} {st?.lastName}
                              </span>
                              <span className="ml-2 font-mono text-xs text-ink-500">{st?.studentProfile?.studentId || st?.email}</span>
                              {p.slotAt && <span className="ml-2 text-xs text-ink-500">· slot {formatWhen(p.slotAt)}</span>}
                            </span>
                            <Badge tone={RESULT_TONES[p.result]}>{RESULT_LABELS[p.result]}</Badge>
                            {r.canEdit && (
                              <span className="flex gap-1">
                                <IconButton icon={CheckCircleIcon} label="Cleared" size="sm" onClick={() => setOne(r, p, 'cleared')} />
                                <IconButton icon={XCircleIcon} label="Not cleared" size="sm" variant="danger" onClick={() => setOne(r, p, 'not_cleared')} />
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* schedule / edit */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit round' : 'Schedule a round'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="round-form" loading={busy}>
              {editing?.id ? 'Save changes' : 'Schedule round'}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="round-form" onSubmit={saveRound} className="grid gap-4 sm:grid-cols-2">
            <Input label="Round name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Technical interview" />
            <Select label="Type" value={editing.roundType} onChange={(e) => setEditing({ ...editing, roundType: e.target.value })}>
              {Object.entries(ROUND_TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Input label="Starts" type="datetime-local" value={editing.scheduledAt} onChange={(e) => setEditing({ ...editing, scheduledAt: e.target.value })} />
            <Input label="Ends" type="datetime-local" value={editing.endsAt} onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })} />
            <Select label="Mode" value={editing.mode} onChange={(e) => setEditing({ ...editing, mode: e.target.value })}>
              <option value="on_campus">On campus</option>
              <option value="online">Online</option>
            </Select>
            {editing.mode === 'online' ? (
              <Input label="Meeting / test link" type="url" value={editing.meetingLink || ''} onChange={(e) => setEditing({ ...editing, meetingLink: e.target.value })} placeholder="https://" />
            ) : (
              <Input label="Venue" value={editing.venue || ''} onChange={(e) => setEditing({ ...editing, venue: e.target.value })} placeholder="e.g. Seminar Hall B, Block 3" />
            )}
            {editing.id && (
              <Select label="Status" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            )}
            <Textarea
              className="sm:col-span-2"
              label="Instructions for students"
              rows={3}
              value={editing.instructions || ''}
              onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
              placeholder="Carry college ID and two copies of your resume. Report 30 minutes early."
            />
          </form>
        )}
      </Modal>

      {/* add participants */}
      <Modal
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
        title={`Add students to ${adding?.name || 'round'}`}
        description="Students are shortlisted and notified with the round's time and place."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={addMode === 'paste' && !paste.trim()} onClick={submitAdd}>
              Add students
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {[
            ['all', 'Everyone who applied', 'All live applications to this job.'],
            ['previous', 'Everyone who cleared the previous round', 'Use for round 2 onwards.'],
            ['paste', 'Paste roll numbers or emails', 'The shortlist the company sent back.']
          ].map(([v, t, d]) => (
            <label key={v} className={cx('flex cursor-pointer gap-3 rounded-xl border p-3', addMode === v ? 'border-ink-950 bg-bone-50' : 'border-ink-950/15')}>
              <input type="radio" name="addMode" checked={addMode === v} onChange={() => setAddMode(v)} className="mt-1 text-ink-950 focus:ring-ink-950" />
              <span>
                <span className="block text-sm font-semibold text-ink-950">{t}</span>
                <span className="block text-xs text-ink-600">{d}</span>
              </span>
            </label>
          ))}
          {addMode === 'paste' && (
            <Textarea aria-label="Roll numbers or emails" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'22CSE001\n22CSE014\npriya@college.edu.in'} />
          )}
        </div>
      </Modal>

      {/* results */}
      <Modal
        open={Boolean(resulting)}
        onClose={() => setResulting(null)}
        title={`Results — ${resulting?.name || ''}`}
        description="Paste the roll numbers or emails the company sent back."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResulting(null)}>
              Cancel
            </Button>
            <Button loading={busy} disabled={!paste.trim()} onClick={submitResults}>
              Record results
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="These students" value={resultValue} onChange={(e) => setResultValue(e.target.value)}>
            <option value="cleared">Cleared the round</option>
            <option value="not_cleared">Did not clear</option>
            <option value="absent">Were absent</option>
          </Select>
          <Textarea aria-label="Roll numbers or emails" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'22CSE001\n22CSE014'} />
          {resultValue === 'cleared' && (
            <label className="flex items-start gap-3 text-sm text-ink-700">
              <input type="checkbox" checked={rejectOthers} onChange={(e) => setRejectOthers(e.target.checked)} className="mt-0.5 rounded text-ink-950 focus:ring-ink-950" />
              <span>Mark everyone else still pending in this round as not cleared (their applications move to rejected).</span>
            </label>
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default RoundsManager;
