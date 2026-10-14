// client/src/pages/conference/ConferenceRoom.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useDataChannel,
  useLocalParticipant,
  useRoomContext
} from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import toast from 'react-hot-toast';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

import conferenceService, { canHostConferences } from '../../services/conferences';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Stage from '../../components/conference/Stage';
import ControlBar from '../../components/conference/ControlBar';
import ParticipantsPanel from '../../components/conference/ParticipantsPanel';

import '@livekit/components-styles';


/**
 * Turns a failed join into words a student can act on. The server's 503 text
 * is written for whoever runs the server (it names env vars), so it is never
 * shown as-is; "session full" shares the 503 status and is told apart by its
 * error code.
 */
const describeJoinError = (error, isStaff = false) => {
  const status = error?.status;
  const code = error?.data?.error;
  if (status === 503 && code === 'Session Full') {
    return {
      title: 'This class is full',
      message:
        error?.data?.message ||
        'The class has reached its participant limit. Try again when someone leaves, or ask your teacher.'
    };
  }
  if (status === 503) {
    return {
      title: 'Live classes are not switched on yet',
      // The host lands here too; telling a teacher to "ask your teacher" was
      // advice addressed to the wrong person.
      message: isStaff
        ? 'Video sessions cannot start yet because live classes have not been set up on EduMapping. Your class is saved and listed under Live classes; it can run once live video is switched on.'
        : 'Video sessions cannot start yet because live classes have not been set up on EduMapping. Please check back later, or ask your teacher or placement office when the class will run.'
    };
  }
  if (status === 404) {
    return {
      title: 'Class not found',
      message: 'This live class does not exist or has been deleted. Check the link, or open Live classes to see what is on.'
    };
  }
  if (status === 409) {
    return {
      title: 'This class has ended',
      message: error?.data?.message || 'The session is over. Open Live classes to see upcoming ones.'
    };
  }
  if (status === 403) {
    return {
      title: 'You cannot join this class',
      message: error?.data?.message || 'This class is limited to certain people. Ask the host to add you.'
    };
  }
  return {
    title: 'Could not join the class',
    message: 'We could not connect you. Check your internet connection and try again in a moment.'
  };
};

/**
 * The shared API layer already toasts every failure except 401/403, so a
 * second toast here would double up. Only the ones it stays quiet about get a
 * message from the room.
 */
const toastIfUnreported = (error, fallback) => {
  if (error?.status === 401 || error?.status === 403) toast.error(error?.message || fallback);
};

/** Full-screen message used for every non-joined state. */
const RoomMessage = ({
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone = 'neutral'
}) => (
  <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-900 p-8 text-center">
      {tone === 'error' && (
        <ExclamationTriangleIcon
          className="mx-auto h-10 w-10 text-saffron-400"
          strokeWidth={1.6}
          aria-hidden="true"
        />
      )}
      <h1 className="mt-4 font-display text-xl font-bold text-white">{title}</h1>
      <p className="mt-2 break-words text-sm leading-relaxed text-slate-400">{message}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-saffron-500 px-6 text-sm font-semibold text-ink-950 transition-colors duration-200 hover:bg-saffron-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
        >
          {actionLabel}
        </button>
      )}
      {secondaryLabel && (
        <button
          type="button"
          onClick={onSecondary}
          className="mt-3 block w-full cursor-pointer text-sm font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-400"
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  </div>
);

/**
 * RoomInner — everything that needs to live inside <LiveKitRoom>.
 *
 * Holds the moderation state and keeps the roster in sync. The roster is
 * refreshed from our API (not just LiveKit) because roles, hand-raise order
 * and hard-mute flags are EduMapping concepts stored in Postgres.
 */
const RoomInner = ({ conference, role, identity, onLeave }) => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const isModerator = role === 'host' || role === 'cohost';

  const [roster, setRoster] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const pollRef = useRef(null);

  const refreshRoster = useCallback(async () => {
    try {
      const response = await conferenceService.listParticipants(conference.id);
      setRoster(response.participants || []);
    } catch (error) {
      // Non-fatal: the call keeps working, the host list just goes stale.
    }
  }, [conference.id]);

  useEffect(() => {
    refreshRoster();
    // Poll as a safety net; data messages below handle the fast path.
    pollRef.current = setInterval(refreshRoster, 10000);
    return () => clearInterval(pollRef.current);
  }, [refreshRoster]);

  // Refresh immediately when the LiveKit room membership changes.
  useEffect(() => {
    if (!room) return undefined;
    const onChange = () => refreshRoster();
    room.on(RoomEvent.ParticipantConnected, onChange);
    room.on(RoomEvent.ParticipantDisconnected, onChange);
    room.on(RoomEvent.TrackMuted, onChange);
    room.on(RoomEvent.TrackUnmuted, onChange);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onChange);
      room.off(RoomEvent.ParticipantDisconnected, onChange);
      room.off(RoomEvent.TrackMuted, onChange);
      room.off(RoomEvent.TrackUnmuted, onChange);
    };
  }, [room, refreshRoster]);

  // Server-sent events: hand raises, permission restores, policy changes.
  useDataChannel((message) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(message.payload));
      if (payload.type === 'hand') {
        refreshRoster();
        if (payload.identity === identity) setHandRaised(Boolean(payload.raised));
      } else if (payload.type === 'publish-restored') {
        toast.success('The host restored your microphone.');
      } else if (payload.type === 'settings-changed') {
        refreshRoster();
      }
    } catch (error) {
      // Ignore malformed payloads from other clients.
    }
  });

  // Tell the student plainly when their rights are pulled — otherwise the
  // controls just vanish and it reads as a bug.
  useEffect(() => {
    if (!room) return undefined;
    const onPermissions = () => {
      const permissions = room.localParticipant?.permissions;
      if (permissions && permissions.canPublish === false) {
        toast('The host muted you for this session.', { icon: '🔇' });
      }
    };
    room.on(RoomEvent.ParticipantPermissionsChanged, onPermissions);
    return () => room.off(RoomEvent.ParticipantPermissionsChanged, onPermissions);
  }, [room]);

  /* ------------------------------------------------------------- actions */

  const toggleHand = async () => {
    const next = !handRaised;
    setHandRaised(next); // optimistic
    try {
      // Local attribute gives other clients instant feedback; the API call is
      // what makes the queue survive a reload.
      await localParticipant?.setAttributes({ raisedHand: next ? '1' : '' });
      await conferenceService.setHand(conference.id, next);
    } catch (error) {
      setHandRaised(!next);
      toastIfUnreported(error, 'Could not update your raised hand.');
    }
  };

  const withBusy = async (userId, fn, successMessage) => {
    setBusyUserId(userId);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      await refreshRoster();
    } catch (error) {
      toastIfUnreported(error, 'That action failed.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleMute = (userId, hard) =>
    withBusy(userId, () => conferenceService.mute(conference.id, userId, hard), 'Participant muted');

  const handleUnmute = (userId) =>
    withBusy(userId, () => conferenceService.unmute(conference.id, userId), 'Microphone restored');

  const handleRemove = (userId, ban) =>
    withBusy(
      userId,
      () => conferenceService.remove(conference.id, userId, ban),
      ban ? 'Removed and blocked' : 'Removed'
    );

  const handleLowerHand = (userId) =>
    withBusy(userId, () => conferenceService.lowerHand(conference.id, userId));

  const handleMuteAll = async () => {
    try {
      await conferenceService.muteAll(conference.id);
      toast.success('Everyone muted');
      refreshRoster();
    } catch (error) {
      toastIfUnreported(error, 'Could not mute everyone.');
    }
  };

  const handleEnd = async () => {
    try {
      await conferenceService.end(conference.id);
      toast.success('Session ended');
      onLeave();
    } catch (error) {
      toastIfUnreported(error, 'Could not end the session.');
    }
  };

  /* --------------------------------------------------------------- derive */

  const roleByIdentity = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.identity, p.role])),
    [roster]
  );
  const handsByIdentity = useMemo(
    () => Object.fromEntries(roster.filter((p) => p.handRaisedAt).map((p) => [p.identity, true])),
    [roster]
  );
  const raisedCount = roster.filter((p) => p.handRaisedAt).length;

  return (
    <div className="flex h-screen flex-col gap-3 bg-ink-950 p-3">
      <header className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-900/60 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold text-white">
            {conference.title}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
              Live
            </span>
            <span aria-hidden="true">·</span>
            <span>{roster.length} joined</span>
            {isModerator && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-saffron-400">You are hosting</span>
              </>
            )}
          </p>
        </div>
        <StartAudio
          label="Enable sound"
          className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-white/10"
        />
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <Stage
            roleByIdentity={roleByIdentity}
            handsByIdentity={handsByIdentity}
            localIdentity={identity}
          />
        </div>

        {isModerator && panelOpen && (
          <ParticipantsPanel
            participants={roster}
            hostUserId={conference.host?.id}
            onMute={handleMute}
            onUnmute={handleUnmute}
            onRemove={handleRemove}
            onLowerHand={handleLowerHand}
            onClose={() => setPanelOpen(false)}
            busyUserId={busyUserId}
          />
        )}
      </div>

      <div className="shrink-0">
        <ControlBar
          isModerator={isModerator}
          handRaised={handRaised}
          onToggleHand={toggleHand}
          onMuteAll={handleMuteAll}
          onLeave={onLeave}
          onEnd={handleEnd}
          onTogglePanel={() => setPanelOpen((open) => !open)}
          raisedCount={raisedCount}
          panelOpen={panelOpen}
        />
      </div>

      <RoomAudioRenderer />
    </div>
  );
};

/**
 * ConferenceRoom — fetches a token, then hands off to LiveKit.
 *
 * The token encodes what this user may publish. Students receive microphone
 * only, enforced by the SFU — the UI simply reflects the grant.
 */
const ConferenceRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, setState] = useState({ status: 'loading' });
  const isStaff = canHostConferences(user?.role);

  useEffect(() => {
    let cancelled = false;

    const join = async () => {
      try {
        const response = await conferenceService.getToken(id);
        if (cancelled) return;
        setState({
          status: 'ready',
          token: response.token,
          url: response.url,
          role: response.role,
          identity: response.identity,
          conference: response.conference
        });
      } catch (error) {
        if (cancelled) return;
        setState({ status: 'error', ...describeJoinError(error, isStaff) });
      }
    };

    join();
    return () => {
      cancelled = true;
    };
  }, [id, isStaff]);

  const leave = useCallback(() => navigate('/dashboard'), [navigate]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-center">
          <LoadingSpinner tone="dark" />
          <p className="mt-4 text-sm text-white/60">Connecting to the session…</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <RoomMessage
        tone="error"
        title={state.title}
        message={state.message}
        actionLabel="See all live classes"
        onAction={() => navigate('/conferences')}
        secondaryLabel="Back to dashboard"
        onSecondary={leave}
      />
    );
  }

  if (!user) {
    return (
      <RoomMessage
        tone="error"
        title="Sign in required"
        message="You need to be signed in to join a live session."
        actionLabel="Sign in"
        onAction={() => navigate('/login')}
      />
    );
  }

  return (
    <LiveKitRoom
      token={state.token}
      serverUrl={state.url}
      connect
      audio={false}
      video={false}
      onDisconnected={leave}
      onError={(error) =>
        toast.error(error?.message || 'Lost connection to the session.')
      }
      data-lk-theme="default"
      className="bg-ink-950"
    >
      <RoomInner
        conference={state.conference}
        role={state.role}
        identity={state.identity}
        onLeave={leave}
      />
    </LiveKitRoom>
  );
};

export default ConferenceRoom;
