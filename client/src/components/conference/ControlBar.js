// client/src/components/conference/ControlBar.js
import React, { useState } from 'react';
import { useLocalParticipant, useLocalParticipantPermissions } from '@livekit/components-react';
import toast from 'react-hot-toast';
import {
  ComputerDesktopIcon,
  HandRaisedIcon,
  MicrophoneIcon,
  PhoneXMarkIcon,
  SpeakerXMarkIcon,
  UserGroupIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon
} from '@heroicons/react/24/outline';

/**
 * Numeric TrackSource values as they appear in a LiveKit permission grant.
 * `useLocalParticipantPermissions()` returns the protocol enum (numbers), not
 * the `Track.Source` string union that livekit-client exposes elsewhere.
 */
const TRACK_SOURCE = {
  CAMERA: 1,
  MICROPHONE: 2,
  SCREEN_SHARE: 3,
  SCREEN_SHARE_AUDIO: 4
};

/** Round control button. Fixed 44px hit area on every breakpoint. */
const ControlButton = ({
  icon: Icon,
  label,
  active = false,
  danger = false,
  onClick,
  disabled = false,
  badge
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    aria-label={label}
    title={label}
    className={`relative inline-flex h-11 min-w-[44px] cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-40 ${
      danger
        ? 'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400'
        : active
        ? 'bg-white text-ink-950 hover:bg-slate-200 focus-visible:ring-white'
        : 'border border-white/15 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white/60'
    }`}
  >
    <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
    <span className="hidden sm:inline">{label}</span>
    {badge > 0 && (
      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-saffron-500 px-1 text-[10px] font-bold text-ink-950">
        {badge}
      </span>
    )}
  </button>
);

/**
 * ControlBar — role-aware.
 *
 * The camera and screen-share buttons are not merely hidden from students:
 * their tokens carry `canPublishSources: ["microphone"]`, so the SFU refuses
 * those tracks regardless of what the client does. This UI reads the actual
 * permissions LiveKit granted rather than assuming, so it stays correct if a
 * host changes the room policy mid-session.
 */
const ControlBar = ({
  isModerator,
  handRaised,
  onToggleHand,
  onMuteAll,
  onLeave,
  onEnd,
  onTogglePanel,
  raisedCount = 0,
  panelOpen = false
}) => {
  const { localParticipant } = useLocalParticipant();
  const permissions = useLocalParticipantPermissions();
  const [busy, setBusy] = useState(false);

  // Derive from the granted permissions, not from the role guess.
  const allowedSources = permissions?.canPublishSources || [];
  const canPublish = permissions?.canPublish ?? false;
  // An empty source list from LiveKit means "all sources allowed".
  const sourceAllowed = (source) =>
    canPublish && (allowedSources.length === 0 || allowedSources.includes(source));

  const canUseMic = sourceAllowed(TRACK_SOURCE.MICROPHONE);
  const canUseCamera = sourceAllowed(TRACK_SOURCE.CAMERA);
  const canUseScreen = sourceAllowed(TRACK_SOURCE.SCREEN_SHARE);

  const micEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const camEnabled = localParticipant?.isCameraEnabled ?? false;
  const screenEnabled = localParticipant?.isScreenShareEnabled ?? false;

  const guard = async (fn, failureMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.error(failureMessage);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () =>
    guard(
      () => localParticipant.setMicrophoneEnabled(!micEnabled),
      'Could not switch your microphone. Check browser permissions.'
    );

  const toggleCam = () =>
    guard(
      () => localParticipant.setCameraEnabled(!camEnabled),
      'Could not switch your camera. Check browser permissions.'
    );

  const toggleScreen = () =>
    guard(
      () => localParticipant.setScreenShareEnabled(!screenEnabled),
      'Screen sharing was cancelled or blocked.'
    );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-900/80 p-3 backdrop-blur">
      {/* Microphone — everyone who has audio rights */}
      {canUseMic ? (
        <ControlButton
          icon={micEnabled ? MicrophoneIcon : SpeakerXMarkIcon}
          label={micEnabled ? 'Mute' : 'Unmute'}
          active={micEnabled}
          onClick={toggleMic}
          disabled={busy}
        />
      ) : (
        <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-slate-500">
          <SpeakerXMarkIcon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          <span className="hidden sm:inline">Muted by host</span>
        </span>
      )}

      {/* Camera + screen share — hosts and co-hosts only */}
      {canUseCamera && (
        <ControlButton
          icon={camEnabled ? VideoCameraIcon : VideoCameraSlashIcon}
          label={camEnabled ? 'Stop video' : 'Start video'}
          active={camEnabled}
          onClick={toggleCam}
          disabled={busy}
        />
      )}

      {canUseScreen && (
        <ControlButton
          icon={ComputerDesktopIcon}
          label={screenEnabled ? 'Stop sharing' : 'Share screen'}
          active={screenEnabled}
          onClick={toggleScreen}
          disabled={busy}
        />
      )}

      {/* Raise hand — the attendee's way to ask for the floor */}
      {!isModerator && (
        <ControlButton
          icon={HandRaisedIcon}
          label={handRaised ? 'Lower hand' : 'Raise hand'}
          active={handRaised}
          onClick={onToggleHand}
        />
      )}

      {/* Moderation */}
      {isModerator && (
        <>
          <ControlButton
            icon={UserGroupIcon}
            label="Participants"
            active={panelOpen}
            onClick={onTogglePanel}
            badge={raisedCount}
          />
          <ControlButton icon={SpeakerXMarkIcon} label="Mute all" onClick={onMuteAll} />
        </>
      )}

      <span aria-hidden="true" className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

      <ControlButton icon={PhoneXMarkIcon} label="Leave" danger onClick={onLeave} />
      {isModerator && (
        <button
          type="button"
          onClick={onEnd}
          className="inline-flex h-11 cursor-pointer items-center rounded-full border border-red-500/40 px-4 text-sm font-semibold text-red-300 transition-colors duration-200 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          End for all
        </button>
      )}
    </div>
  );
};

export default ControlBar;
