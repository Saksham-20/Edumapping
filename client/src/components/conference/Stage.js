// client/src/components/conference/Stage.js
import React, { useMemo } from 'react';
import {
  useTracks,
  useParticipants,
  VideoTrack,
  useIsSpeaking
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  HandRaisedIcon,
  MicrophoneIcon,
  UserGroupIcon
} from '@heroicons/react/24/solid';
import { SpeakerXMarkIcon } from '@heroicons/react/24/outline';

/** Initials avatar for participants with no video (i.e. all students). */
const Avatar = ({ name, size = 'md' }) => {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-14 w-14 text-base',
    lg: 'h-20 w-20 text-xl'
  };

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saffron-400 to-india-500 font-bold text-ink-950 ${sizes[size]}`}
    >
      {initials}
    </span>
  );
};

/** One audio-only participant chip. Students never have video, so this is
 *  the normal representation for the class. */
const AudioTile = ({ participant, meta }) => {
  const speaking = useIsSpeaking(participant);
  const micTrack = participant.getTrackPublication?.(Track.Source.Microphone);
  const muted = !micTrack || micTrack.isMuted;

  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors duration-150 ${
        speaking
          ? 'border-india-400 bg-india-500/10'
          : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <Avatar name={participant.name || participant.identity} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">
          {participant.name || participant.identity}
          {meta?.isLocal && <span className="ml-1 text-slate-400">(you)</span>}
        </span>
        {meta?.role && meta.role !== 'attendee' && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-saffron-400">
            {meta.role}
          </span>
        )}
      </span>

      {meta?.handRaised && (
        <HandRaisedIcon className="h-4 w-4 shrink-0 text-saffron-400" aria-label="Hand raised" />
      )}
      {muted ? (
        <SpeakerXMarkIcon
          className="h-4 w-4 shrink-0 text-slate-500"
          strokeWidth={2}
          aria-label="Muted"
        />
      ) : (
        <MicrophoneIcon
          className={`h-4 w-4 shrink-0 ${speaking ? 'text-india-400' : 'text-slate-400'}`}
          aria-label="Unmuted"
        />
      )}
    </li>
  );
};

/**
 * Stage — the main viewing area.
 *
 * Layout priority mirrors what a class actually needs to see:
 *   1. An active screen share takes the whole stage.
 *   2. Otherwise the presenter's camera.
 *   3. Everyone else appears as a compact audio rail, because in this product
 *      students are audio-only by design — rendering 30 empty video tiles
 *      would waste the entire viewport.
 */
const Stage = ({ roleByIdentity = {}, handsByIdentity = {}, localIdentity }) => {
  const participants = useParticipants();

  const videoTracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false }
    ],
    { onlySubscribed: false }
  );

  const screenShare = useMemo(
    () => videoTracks.find((t) => t.source === Track.Source.ScreenShare && t.publication),
    [videoTracks]
  );

  const cameraTracks = useMemo(
    () =>
      videoTracks.filter(
        (t) => t.source === Track.Source.Camera && t.publication && !t.publication.isMuted
      ),
    [videoTracks]
  );

  const primary = screenShare || cameraTracks[0];
  // Cameras not already shown as the primary tile become thumbnails.
  const secondary = cameraTracks.filter((t) => t !== primary);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
      {/* ------------------------------------------------------- main area */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
          {primary ? (
            <>
              <VideoTrack
                trackRef={primary}
                className="h-full w-full object-contain"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-ink-950/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                {primary.participant.name || primary.participant.identity}
                {primary.source === Track.Source.ScreenShare && ' — sharing screen'}
              </span>
            </>
          ) : (
            <div className="px-6 text-center">
              <UserGroupIcon className="mx-auto h-10 w-10 text-slate-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                Waiting for the host to start their camera
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You&apos;ll see video here once the session begins.
              </p>
            </div>
          )}
        </div>

        {/* Extra cameras (co-hosts) */}
        {secondary.length > 0 && (
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
            {secondary.map((track) => (
              <div
                key={track.publication.trackSid}
                className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-ink-900"
              >
                <VideoTrack trackRef={track} className="h-full w-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 truncate rounded bg-ink-950/80 px-1.5 py-0.5 text-[10px] text-white">
                  {track.participant.name || track.participant.identity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- audience */}
      <aside className="flex min-h-0 shrink-0 flex-col rounded-2xl border border-white/10 bg-ink-900/60 p-3 lg:w-72">
        <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
          <UserGroupIcon className="h-4 w-4" aria-hidden="true" />
          In the room ({participants.length})
        </h2>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {participants.map((participant) => (
            <AudioTile
              key={participant.identity}
              participant={participant}
              meta={{
                role: roleByIdentity[participant.identity],
                handRaised: Boolean(handsByIdentity[participant.identity]),
                isLocal: participant.identity === localIdentity
              }}
            />
          ))}
        </ul>
      </aside>
    </div>
  );
};

export default Stage;
