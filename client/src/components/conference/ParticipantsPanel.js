// client/src/components/conference/ParticipantsPanel.js
import React, { useMemo, useState } from 'react';
import {
  HandRaisedIcon,
  NoSymbolIcon,
  SpeakerXMarkIcon,
  MicrophoneIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

/**
 * ParticipantsPanel — the host's moderation surface.
 *
 * Raised hands sort to the top and keep their arrival order, so the teacher
 * answers the room in the order people actually asked.
 */
const ParticipantsPanel = ({
  participants = [],
  hostUserId,
  onMute,
  onUnmute,
  onRemove,
  onLowerHand,
  onClose,
  busyUserId
}) => {
  const [confirmRemove, setConfirmRemove] = useState(null);

  const ordered = useMemo(() => {
    const copy = [...participants];
    copy.sort((a, b) => {
      // Hands first, oldest raise first.
      if (a.handRaisedAt && b.handRaisedAt) {
        return new Date(a.handRaisedAt) - new Date(b.handRaisedAt);
      }
      if (a.handRaisedAt) return -1;
      if (b.handRaisedAt) return 1;
      // Then moderators, then everyone alphabetically.
      const rank = (r) => (r === 'host' ? 0 : r === 'cohost' ? 1 : 2);
      if (rank(a.role) !== rank(b.role)) return rank(a.role) - rank(b.role);
      return (a.name || '').localeCompare(b.name || '');
    });
    return copy;
  }, [participants]);

  const raisedCount = ordered.filter((p) => p.handRaisedAt).length;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-white/10 bg-ink-900 lg:w-80">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-bold text-white">
          Participants
          <span className="ml-2 font-normal text-slate-400">{ordered.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          {raisedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-saffron-500/15 px-2 py-1 text-[11px] font-bold text-saffron-300">
              <HandRaisedIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {raisedCount}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close participants panel"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <XMarkIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
        {ordered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">
            No one has joined yet.
          </li>
        )}

        {ordered.map((p) => {
          const isHost = p.userId === hostUserId;
          const busy = busyUserId === p.userId;
          const micTrack = (p.tracks || []).find((t) => t.source === 'MICROPHONE' || t.source === 2);
          const isMuted = !micTrack || micTrack.muted;

          return (
            <li key={p.identity} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-white">{p.name}</span>
                    {p.handRaisedAt && (
                      <HandRaisedIcon
                        className="h-3.5 w-3.5 shrink-0 text-saffron-400"
                        strokeWidth={2}
                        aria-label="Hand raised"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                    {p.role !== 'attendee' && (
                      <span className="font-semibold uppercase tracking-wide text-saffron-400">
                        {p.role}
                      </span>
                    )}
                    {p.isHardMuted && (
                      <span className="font-semibold uppercase tracking-wide text-red-400">
                        mic revoked
                      </span>
                    )}
                    {p.role === 'attendee' && !p.isHardMuted && (
                      <span className="text-slate-500">{isMuted ? 'Muted' : 'Speaking'}</span>
                    )}
                  </span>
                </span>

                {!isHost && (
                  <span className="flex shrink-0 items-center gap-1">
                    {p.handRaisedAt && (
                      <button
                        type="button"
                        onClick={() => onLowerHand(p.userId)}
                        disabled={busy}
                        title="Lower hand"
                        aria-label={`Lower ${p.name}'s hand`}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-saffron-400 transition-colors duration-200 hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
                      >
                        <HandRaisedIcon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}

                    {p.isHardMuted ? (
                      <button
                        type="button"
                        onClick={() => onUnmute(p.userId)}
                        disabled={busy}
                        title="Restore microphone"
                        aria-label={`Restore ${p.name}'s microphone`}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-india-400 transition-colors duration-200 hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-india-400"
                      >
                        <MicrophoneIcon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onMute(p.userId, false)}
                        disabled={busy || isMuted}
                        title="Mute"
                        aria-label={`Mute ${p.name}`}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-300 transition-colors duration-200 hover:bg-white/10 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      >
                        <SpeakerXMarkIcon className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmRemove(p)}
                      disabled={busy}
                      title="Remove from session"
                      aria-label={`Remove ${p.name}`}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-red-400 transition-colors duration-200 hover:bg-red-500/15 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <NoSymbolIcon className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </span>
                )}
              </div>

              {/* Inline confirm — removing someone is disruptive enough to
                  deserve a deliberate second click, but not a modal. */}
              {confirmRemove?.userId === p.userId && (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs text-red-200">
                    Remove <strong>{p.name}</strong> and block them from rejoining this session?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(p.userId, true);
                        setConfirmRemove(null);
                      }}
                      className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      Remove &amp; block
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(p.userId, false);
                        setConfirmRemove(null);
                      }}
                      className="cursor-pointer rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      Remove only
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(null)}
                      className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default ParticipantsPanel;
