// client/src/components/landing/EventsSection.js
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BuildingOfficeIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  VideoCameraIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { openMeetingLink } from '../../utils/helpers';
import {
  ArrowGlyph,
  Button,
  Card,
  Container,
  Eyebrow,
  Reveal,
  Section,
  Tag
} from './primitives';

const EVENT_TYPE_LABELS = {
  campus_drive: 'Campus drive',
  info_session: 'Info session',
  workshop: 'Workshop',
  seminar: 'Seminar',
  job_fair: 'Job fair',
  other: 'Event'
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

/** Skeleton card — holds the real card's height so nothing jumps on load. */
const EventSkeleton = () => (
  <div className="h-full animate-pulse rounded-3xl border border-ink-950/15 bg-white p-6">
    <div className="h-5 w-24 rounded-full bg-ink-950/10" />
    <div className="mt-5 h-5 w-3/4 rounded bg-ink-950/10" />
    <div className="mt-2 h-4 w-full rounded bg-ink-950/[0.06]" />
    <div className="mt-2 h-4 w-5/6 rounded bg-ink-950/[0.06]" />
    <div className="mt-6 space-y-2">
      <div className="h-3.5 w-32 rounded bg-ink-950/[0.06]" />
      <div className="h-3.5 w-40 rounded bg-ink-950/[0.06]" />
    </div>
  </div>
);

/**
 * EventsSection — upcoming EduMapping-hosted events, live from the API.
 *
 * Renders nothing at all when there are no upcoming events, rather than an
 * empty shell: an events section with zero events reads as a dead site.
 */
const EventsSection = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    const fetchGlobalEvents = async () => {
      try {
        const params = new URLSearchParams({
          upcoming: 'true',
          limit: '6',
          status: 'scheduled'
        });
        // silent: the section hides itself on failure; a global error toast
        // on the public landing page would be noise for a logged-out visitor.
        const response = await api.get(`/events?${params}`, { silent: true });
        const list = response?.events || [];
        // Only EduMapping's own org events are "global" and shown publicly.
        const global = list.filter(
          (event) => event?.organization?.name?.toLowerCase() === 'edumapping'
        );
        if (!cancelled) setEvents(global);
      } catch (error) {
        // The landing page must render for logged-out visitors even when the
        // API is unreachable — fail quiet and hide the section.
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGlobalEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the modal on Escape.
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (!loading && events.length === 0) return null;

  const handleJoin = (event, e) => {
    e?.stopPropagation?.();
    if (event?.virtualLink) openMeetingLink(event.virtualLink);
  };

  return (
    <Section tone="bone" id="events">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Upcoming events</Eyebrow>
          <h2 className="lp-balance mt-5 font-display text-display-sm font-bold text-ink-950">
            Workshops and sessions, open to join
          </h2>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-600 sm:text-lg">
            Global events hosted by EduMapping — workshops, info sessions and career seminars you
            can register for.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <EventSkeleton key={i} />)
            : events.map((event, index) => (
                <Reveal key={event.id} delay={index * 0.05}>
                  <Card
                    as="button"
                    interactive
                    onClick={() => setSelected(event)}
                    className="flex h-full w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950 focus-visible:ring-offset-2"
                    aria-label={`View details for ${event.title}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Tag>{EVENT_TYPE_LABELS[event.eventType] || 'Event'}</Tag>
                      {event.virtualLink && (
                        <VideoCameraIcon
                          className="h-5 w-5 shrink-0 text-saffron-600"
                          strokeWidth={1.8}
                          aria-label="Online event"
                        />
                      )}
                    </div>

                    <h3 className="mt-5 font-display text-lg font-bold leading-snug text-ink-950">
                      {event.title}
                    </h3>
                    {event.description && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-600">
                        {event.description}
                      </p>
                    )}

                    <dl className="mt-5 space-y-2 text-sm text-ink-600">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden="true" />
                        <dd>{formatDate(event.startDate)}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden="true" />
                        <dd>{formatTime(event.startDate)}</dd>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden="true" />
                          <dd className="truncate">{event.location}</dd>
                        </div>
                      )}
                    </dl>

                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink-950">
                      View details
                      <ArrowGlyph />
                    </span>
                  </Card>
                </Reveal>
              ))}
        </div>
      </Container>

      {/* ------------------------------------------------------------- modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/70 p-4 backdrop-blur-sm sm:items-center"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? false : { opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={() => setSelected(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lp-event-title"
          >
            <motion.div
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-ink-950 bg-white p-7 shadow-block"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={reduce ? false : { opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: 16 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <Tag>{EVENT_TYPE_LABELS[selected.eventType] || 'Event'}</Tag>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close event details"
                  className="-mr-1 -mt-1 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink-500 transition-colors duration-200 hover:bg-ink-950/[0.06] hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                >
                  <XMarkIcon className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              <h3
                id="lp-event-title"
                className="mt-5 font-display text-2xl font-bold text-ink-950"
              >
                {selected.title}
              </h3>
              {selected.description && (
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{selected.description}</p>
              )}

              <dl className="mt-6 space-y-3 border-t border-ink-950/10 pt-6 text-sm">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden="true" />
                  <dt className="sr-only">Date</dt>
                  <dd className="text-ink-700">
                    {formatDate(selected.startDate)} · {formatTime(selected.startDate)}
                  </dd>
                </div>
                {selected.location && (
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden="true" />
                    <dt className="sr-only">Location</dt>
                    <dd className="text-ink-700">{selected.location}</dd>
                  </div>
                )}
                {selected.organization?.name && (
                  <div className="flex items-center gap-3">
                    <BuildingOfficeIcon className="h-5 w-5 shrink-0 text-ink-500" strokeWidth={1.8} aria-hidden="true" />
                    <dt className="sr-only">Host</dt>
                    <dd className="text-ink-700">{selected.organization.name}</dd>
                  </div>
                )}
              </dl>

              {selected.virtualLink && (
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-7 w-full"
                  onClick={(e) => handleJoin(selected, e)}
                >
                  <VideoCameraIcon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  Join online
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
};

export default EventsSection;
