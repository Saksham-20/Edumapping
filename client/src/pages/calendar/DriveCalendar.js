// client/src/pages/calendar/DriveCalendar.js
//
// One calendar for the season: campus events, selection rounds and application
// deadlines that concern the signed-in user. Days with more than one round are
// flagged — two drives on the same day for the same batch is the clash a
// placement cell most needs to see before students do.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, PageShell, Tabs, cx } from '../../components/ui';
import placementService from '../../services/placement';
import { useAuth } from '../../contexts/AuthContext';

const KIND_STYLES = {
  round: { dot: 'bg-saffron-500', chip: 'border-saffron-500/40 bg-saffron-50 text-saffron-900', label: 'Selection round' },
  event: { dot: 'bg-azure-500', chip: 'border-azure-500/30 bg-azure-500/10 text-azure-700', label: 'Event' },
  deadline: { dot: 'bg-red-600', chip: 'border-red-600/25 bg-red-50 text-red-800', label: 'Deadline' }
};

const ymd = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DriveCalendar = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [view, setView] = useState('month');
  const [data, setData] = useState({ items: [], clashes: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(ymd(new Date()));

  const range = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); // back to Monday
    const to = new Date(from);
    to.setDate(to.getDate() + 42);
    return { from, to };
  }, [cursor]);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    placementService
      .getCalendar({ from: range.from.toISOString(), to: range.to.toISOString() })
      .then((res) => setData({ items: res.items || [], clashes: res.clashes || [] }))
      .catch(() => {
        // An empty month here reads as "nothing scheduled", which is the
        // wrong thing to tell a student on drive week. Say it failed.
        setData({ items: [], clashes: [] });
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [range, reloadKey]);

  const downloadIcs = async () => {
    setDownloading(true);
    try {
      await placementService.downloadCalendar({ from: range.from.toISOString(), to: range.to.toISOString() });
    } catch {
      // The api interceptor has already said why.
    } finally {
      setDownloading(false);
    }
  };

  const byDay = useMemo(() => {
    const map = {};
    data.items.forEach((i) => {
      const k = ymd(i.start);
      (map[k] = map[k] || []).push(i);
    });
    return map;
  }, [data.items]);
  const clashDays = useMemo(() => new Set(data.clashes.map((c) => c.date)), [data.clashes]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(range.from);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = ymd(new Date());
  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const upcoming = data.items.filter((i) => new Date(i.end || i.start) >= new Date(Date.now() - 3600e3));
  const dayItems = byDay[selectedDay] || [];

  const shift = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  const ItemRow = ({ item }) => (
    <li>
      <Link
        to={item.link}
        className="group flex gap-3 rounded-xl p-3 transition-colors hover:bg-bone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
      >
        <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', KIND_STYLES[item.kind]?.dot)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink-950 group-hover:underline">{item.title}</span>
          <span className="block truncate text-xs text-ink-600">
            {item.allDay ? 'All day' : time(item.start)}
            {item.subtitle ? ` · ${item.subtitle}` : ''}
          </span>
          {item.location && (
            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-500">
              <MapPinIcon className="h-3 w-3" aria-hidden="true" />
              {item.location}
            </span>
          )}
        </span>
        <Badge className="h-fit shrink-0" tone={item.kind === 'deadline' ? 'danger' : item.kind === 'round' ? 'warning' : 'info'}>
          {KIND_STYLES[item.kind]?.label}
        </Badge>
      </Link>
    </li>
  );

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Season"
        title="Drive calendar"
        lead="Selection rounds, campus events and application deadlines in one place."
        actions={
          <Button variant="secondary" icon={ArrowDownTrayIcon} loading={downloading} onClick={downloadIcs}>
            Add to Google / Outlook (.ics)
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeftIcon} label="Previous month" onClick={() => shift(-1)} variant="secondary" />
          <h2 className="min-w-[10rem] text-center font-display text-xl font-bold text-ink-950">{monthLabel}</h2>
          <IconButton icon={ChevronRightIcon} label="Next month" onClick={() => shift(1)} variant="secondary" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelectedDay(ymd(d));
            }}
          >
            Today
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(KIND_STYLES).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className={cx('h-2 w-2 rounded-full', v.dot)} aria-hidden="true" />
              {v.label}s
            </span>
          ))}
          <Tabs
            tabs={[
              { value: 'month', label: 'Month' },
              { value: 'agenda', label: 'Agenda' }
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </div>

      {failed && (
        <ErrorState
          className="mb-5"
          title="Could not load the calendar"
          description="Your rounds and deadlines did not load. Check your connection and try again."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      )}

      {data.clashes.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-saffron-500/40 bg-saffron-50 p-4 text-sm text-saffron-900">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            <strong>Possible clash:</strong>{' '}
            {data.clashes
              .map((c) => `${new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (${c.count} rounds)`)
              .join(', ')}
            {isStudent
              ? '. Check the times, and tell your placement cell if you are expected in two places at once.'
              : '. Check that the same students are not expected in two places.'}
          </p>
        </div>
      )}

      {view === 'month' ? (
        // `grid-cols-1` is minmax(0, 1fr): a bare `grid` sizes its column to
        // the longest item title in the day panel and pushed the month grid
        // off a 390px screen.
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
          <Card padded={false} className={cx('overflow-hidden', loading && 'opacity-60')}>
            <div className="grid grid-cols-7 border-b border-ink-950/10 bg-bone-100">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = ymd(d);
                const items = byDay[key] || [];
                const inMonth = d.getMonth() === cursor.getMonth();
                const isSelected = key === selectedDay;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    aria-pressed={isSelected}
                    aria-label={`${d.toDateString()}, ${items.length} item${items.length === 1 ? '' : 's'}`}
                    className={cx(
                      'relative min-h-[5.5rem] border-b border-r border-ink-950/10 p-1.5 text-left align-top transition-colors sm:min-h-[7rem] sm:p-2',
                      'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-950',
                      inMonth ? 'bg-white hover:bg-bone-50' : 'bg-bone-50/60 text-ink-500',
                      isSelected && 'bg-saffron-50/70 ring-2 ring-inset ring-ink-950'
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={cx(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                          key === today ? 'bg-ink-950 text-white' : inMonth ? 'text-ink-950' : 'text-ink-500'
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {clashDays.has(key) && <ExclamationTriangleIcon className="h-4 w-4 text-saffron-600" aria-label="Clash" />}
                    </span>
                    <span className="mt-1 hidden space-y-1 sm:block">
                      {items.slice(0, 3).map((i) => (
                        <span key={i.id} className={cx('block truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium', KIND_STYLES[i.kind]?.chip)}>
                          {i.title}
                        </span>
                      ))}
                      {items.length > 3 && <span className="block text-[11px] text-ink-500">+{items.length - 3} more</span>}
                    </span>
                    <span className="mt-1 flex gap-0.5 sm:hidden">
                      {items.slice(0, 4).map((i) => (
                        <span key={i.id} className={cx('h-1.5 w-1.5 rounded-full', KIND_STYLES[i.kind]?.dot)} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.07em] text-ink-500">Selected day</p>
            <h3 className="mt-1 font-display text-lg font-bold text-ink-950">
              {new Date(selectedDay).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            {dayItems.length === 0 ? (
              <p className="mt-4 text-sm text-ink-500">Nothing scheduled.</p>
            ) : (
              <ul className="-mx-3 mt-3 space-y-1">
                {dayItems.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : upcoming.length === 0 ? (
        <EmptyState icon={CalendarDaysIcon} title="Nothing coming up" description="Rounds, events and deadlines will appear here as they are scheduled." />
      ) : (
        <div className="space-y-6">
          {Object.entries(
            upcoming.reduce((acc, i) => {
              const k = ymd(i.start);
              (acc[k] = acc[k] || []).push(i);
              return acc;
            }, {})
          ).map(([day, items]) => (
            <Card key={day}>
              <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink-950">
                {new Date(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                {clashDays.has(day) && <Badge tone="warning">Clash</Badge>}
              </h3>
              <ul className="-mx-3 mt-2 space-y-1">
                {items.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default DriveCalendar;
