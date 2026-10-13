// client/src/components/events/AttendeesPanel.js
//
// The organiser's register for an event: who signed up, who turned up.
//
// GET /events/:id/registrations and PATCH /events/:id/attendance have existed
// on the server for a while, but nothing in the client called them — so an
// organiser could see "42 registered" and had no way to see the 42, take a
// register, or report turnout. The server enforces who may do this (staff of
// the event's organization, or an admin); this panel is only rendered for
// them, but a 403 from the server is handled rather than assumed away.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonCard,
  StatusBadge,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '../ui';
import {
  ArrowDownTrayIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  XMarkIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

const STATUS_FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'registered', label: 'Not yet marked' },
  { value: 'attended', label: 'Attended' },
  { value: 'no_show', label: 'Absent' },
  { value: 'cancelled', label: 'Cancelled' }
];

const STATUS_LABEL = {
  registered: 'Registered',
  attended: 'Attended',
  no_show: 'Absent',
  cancelled: 'Cancelled'
};

/**
 * One CSV cell. Quoted per RFC 4180, and anything a spreadsheet would run as a
 * formula (leading = + - @ tab CR) is prefixed with an apostrophe — attendee
 * names are typed by the attendees themselves.
 */
const csvCell = (value) => {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename, header, rows) => {
  const csv = [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
  // BOM so Excel reads non-ASCII names as UTF-8.
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Unknown';

const AttendeesPanel = ({ event, onChanged }) => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState([]);
  // `${userId}` or 'bulk' while a write is in flight.
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await api.get(`/events/${event.id}/registrations`, {
        silent: true
      });
      setRegistrations(body.registrations || []);
    } catch (err) {
      setError(
        err?.status === 403
          ? 'Only staff of the organizing institution can see who registered.'
          : err?.message || 'Could not load registrations.'
      );
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () =>
      registrations.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        { registered: 0, attended: 0, no_show: 0, cancelled: 0 }
      ),
    [registrations]
  );
  const expected = registrations.length - counts.cancelled;
  const marked = counts.attended + counts.no_show;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      const u = r.user || {};
      return [fullName(u), u.email, u.phone].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(term)
      );
    });
  }, [registrations, search, statusFilter]);

  // Cancelled registrations are listed for the record but cannot be marked.
  const markable = visible.filter((r) => r.status !== 'cancelled');
  const allSelected = markable.length > 0 && markable.every((r) => selected.includes(r.userId));

  // A selection only ever refers to rows on screen.
  useEffect(() => {
    setSelected((prev) => prev.filter((id) => markable.some((r) => r.userId === id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const mark = async (userIds, status) => {
    if (userIds.length === 0) return;
    setSaving(userIds.length === 1 ? String(userIds[0]) : 'bulk');
    try {
      const body = await api.patch(`/events/${event.id}/attendance`, { userIds, status }, { silent: true });
      // Apply locally so the table does not flash; the server answer is the
      // count it actually changed.
      setRegistrations((prev) => prev.map((r) => (userIds.includes(r.userId) ? { ...r, status } : r)));
      setSelected([]);
      toast.success(body?.message || 'Attendance updated');
      onChanged?.();
    } catch (err) {
      toast.error(err?.message || 'Could not update attendance.');
      load();
    } finally {
      setSaving(null);
    }
  };

  const exportCsv = () => {
    const rows = visible.map((r) => [
      fullName(r.user),
      r.user?.email,
      r.user?.phone,
      STATUS_LABEL[r.status] || r.status,
      r.registeredAt ? new Date(r.registeredAt).toLocaleString() : ''
    ]);
    const slug = String(event.title || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    downloadCsv(
      `attendance-${slug || event.id}.csv`,
      ['Name', 'Email', 'Phone', 'Attendance', 'Registered at'],
      rows
    );
  };

  return (
    <Card className="mt-6" padded={false}>
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <CardHeader
          title="Attendees"
          description="Who registered, and who attended. Mark one at a time or select several."
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={ArrowDownTrayIcon}
              disabled={visible.length === 0}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          }
        />

        <div className="mt-4 flex flex-wrap gap-2" aria-live="polite">
          <Badge tone="info">{expected} expected</Badge>
          <Badge tone="success">{counts.attended} attended</Badge>
          <Badge tone="danger">{counts.no_show} absent</Badge>
          <Badge tone="neutral">{counts.registered} not marked</Badge>
          {counts.cancelled > 0 && <Badge tone="neutral">{counts.cancelled} cancelled</Badge>}
          {marked > 0 && (
            <Badge tone="ink">{Math.round((counts.attended / Math.max(expected, 1)) * 100)}% turnout</Badge>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              label="Search attendees"
              icon={MagnifyingGlassIcon}
              placeholder="Name, email or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              label="Show"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_FILTERS}
            />
          </div>
        </div>

        {markable.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-950/10 bg-bone-50 px-3 py-2">
            <Checkbox
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : markable.map((r) => r.userId))}
              label={`Select all shown (${selected.length}/${markable.length})`}
            />
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="success"
                  icon={CheckIcon}
                  loading={saving === 'bulk'}
                  onClick={() => mark(selected, 'attended')}
                >
                  Mark {selected.length} attended
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={XMarkIcon}
                  disabled={saving === 'bulk'}
                  onClick={() => mark(selected, 'no_show')}
                >
                  Mark absent
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ArrowUturnLeftIcon}
                  disabled={saving === 'bulk'}
                  onClick={() => mark(selected, 'registered')}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-ink-950/10">
        {loading && (
          <div className="p-5 sm:p-6">
            <SkeletonCard lines={4} />
          </div>
        )}
        {!loading && error && (
          <div className="p-5 sm:p-6">
            <ErrorState title="Could not load attendees" description={error} onRetry={load} />
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={UserGroupIcon}
              title={registrations.length === 0 ? 'No registrations yet' : 'Nobody matches'}
              description={
                registrations.length === 0
                  ? 'Students who register for this event appear here.'
                  : 'Try a different search or status.'
              }
            />
          </div>
        )}
        {!loading && !error && visible.length > 0 && (
          <div className="p-5 sm:p-6">
            <Table>
              <Thead>
                <Tr className="hover:bg-transparent">
                  <Th className="w-10">
                    <span className="sr-only">Select</span>
                  </Th>
                  <Th>Attendee</Th>
                  <Th>Registered</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Mark</Th>
                </Tr>
              </Thead>
              <Tbody>
                {visible.map((r) => {
                  const cancelled = r.status === 'cancelled';
                  const busy = saving === String(r.userId);
                  return (
                    <Tr key={r.id} className={cancelled ? 'opacity-60' : ''}>
                      <Td>
                        {!cancelled && (
                          <Checkbox
                            checked={selected.includes(r.userId)}
                            onChange={() =>
                              setSelected((prev) =>
                                prev.includes(r.userId)
                                  ? prev.filter((x) => x !== r.userId)
                                  : [...prev, r.userId]
                              )
                            }
                            label={<span className="sr-only">Select {fullName(r.user)}</span>}
                          />
                        )}
                      </Td>
                      <Td>
                        <p className="font-medium text-ink-950">{fullName(r.user)}</p>
                        <p className="text-xs text-ink-500">
                          {[r.user?.email, r.user?.phone].filter(Boolean).join(' · ')}
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-600">
                        {r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : '—'}
                      </Td>
                      <Td>
                        {r.status === 'no_show' ? (
                          <Badge tone="danger" dot>
                            absent
                          </Badge>
                        ) : r.status === 'registered' ? (
                          <Badge tone="neutral">not marked</Badge>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </Td>
                      <Td className="text-right">
                        {!cancelled && (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant={r.status === 'attended' ? 'success' : 'secondary'}
                              aria-pressed={r.status === 'attended'}
                              loading={busy}
                              onClick={() =>
                                mark([r.userId], r.status === 'attended' ? 'registered' : 'attended')
                              }
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant={r.status === 'no_show' ? 'danger' : 'secondary'}
                              aria-pressed={r.status === 'no_show'}
                              disabled={busy}
                              onClick={() =>
                                mark([r.userId], r.status === 'no_show' ? 'registered' : 'no_show')
                              }
                            >
                              Absent
                            </Button>
                          </div>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AttendeesPanel;
