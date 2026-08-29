// server/src/services/livekitService.js
//
// Wrapper around the LiveKit server SDK.
//
// WHY LIVEKIT, AND WHERE THE SECURITY ACTUALLY LIVES
// --------------------------------------------------
// The classroom rule is "the teacher publishes video, students may only speak".
// That is expressed in a single signed token claim:
//
//     canPublishSources: [TrackSource.MICROPHONE]
//
// LiveKit's SFU rejects a publish request for any source not in that list
// (ParticipantImpl.AddTrack -> RequestResponse_NOT_ALLOWED) before a track SID
// is ever allocated. A student who edits the client bundle to enable their
// camera gets refused by the server; there is no publish-then-mute window.
// The browser is never trusted.
//
// Two subtleties from the LiveKit grant semantics that are easy to get wrong:
//   * canPublishSources only takes effect when canPublish is true.
//   * An EMPTY canPublishSources array means "all sources permitted", NOT
//     "no sources". To deny publishing outright, set canPublish: false.
//
// The SDK is ESM-first but ships a `require` condition, so plain CommonJS
// require() works from this Express app.
const logger = require('../utils/logger');

let sdk = null;
let sdkLoadError = null;

try {
  // eslint-disable-next-line global-require
  sdk = require('livekit-server-sdk');
} catch (error) {
  // The package is optional at runtime: the rest of the API must keep working
  // on a deployment that has not enabled conferencing yet.
  sdkLoadError = error;
}

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
// Public wss:// URL handed to browsers. Falls back to LIVEKIT_URL.
const LIVEKIT_PUBLIC_URL = process.env.LIVEKIT_PUBLIC_URL || LIVEKIT_URL;

const TOKEN_TTL = process.env.LIVEKIT_TOKEN_TTL || '3h';

/** True when the server has everything it needs to mint tokens. */
const isConfigured = () =>
  Boolean(sdk && LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

/** Human-readable reason conferencing is unavailable, or null when it is fine. */
const configurationError = () => {
  if (!sdk) {
    return 'livekit-server-sdk is not installed on the server (run: npm install livekit-server-sdk)';
  }
  const missing = [];
  if (!LIVEKIT_URL) missing.push('LIVEKIT_URL');
  if (!LIVEKIT_API_KEY) missing.push('LIVEKIT_API_KEY');
  if (!LIVEKIT_API_SECRET) missing.push('LIVEKIT_API_SECRET');
  if (missing.length) return `Missing environment variables: ${missing.join(', ')}`;
  return null;
};

if (sdkLoadError) {
  logger.warn('livekit-server-sdk not available — conferencing endpoints will return 503', {
    message: sdkLoadError.message
  });
}

let roomServiceClient = null;

/** Lazily built admin client. Throws a clear error when misconfigured. */
const getRoomService = () => {
  const error = configurationError();
  if (error) throw new Error(`LiveKit is not configured: ${error}`);
  if (!roomServiceClient) {
    roomServiceClient = new sdk.RoomServiceClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );
  }
  return roomServiceClient;
};

/**
 * Identity string used inside LiveKit.
 * Prefixed with the numeric user id so webhooks and admin calls can map a
 * LiveKit participant straight back to a row in `users`.
 */
const identityFor = (userId) => `u${userId}`;

/** Recover the EduMapping user id from a LiveKit identity. Null if malformed. */
const userIdFromIdentity = (identity) => {
  const match = /^u(\d+)$/.exec(String(identity || ''));
  return match ? Number(match[1]) : null;
};

/**
 * Build the publish-source list for a participant.
 *
 * NOTE: the Node SDK requires the TrackSource ENUM here. Passing the lowercase
 * wire strings ('microphone') throws
 *   TypeError: Cannot convert TrackSource microphone to string
 * even though those strings are what end up inside the encoded JWT.
 */
const publishSourcesFor = (role, conference) => {
  const { TrackSource } = sdk;

  if (role === 'host' || role === 'cohost') {
    return [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO
    ];
  }

  // Attendees: audio only by default. Video/screen-share are added only if the
  // host explicitly opened them for this room.
  const sources = [];
  if (conference.allowAttendeeAudio) sources.push(TrackSource.MICROPHONE);
  if (conference.allowAttendeeVideo) sources.push(TrackSource.CAMERA);
  if (conference.allowAttendeeScreenShare) {
    sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  }
  return sources;
};

/**
 * Mint a join token.
 *
 * @param {object}  opts
 * @param {object}  opts.conference    Conference row (policy flags).
 * @param {object}  opts.user          User row (identity + display name).
 * @param {string}  opts.role          'host' | 'cohost' | 'attendee'
 * @param {boolean} opts.hardMuted     Host revoked this user's publish rights.
 * @returns {Promise<string>} signed JWT
 */
const createAccessToken = async ({ conference, user, role, hardMuted = false }) => {
  const error = configurationError();
  if (error) throw new Error(`LiveKit is not configured: ${error}`);

  const { AccessToken } = sdk;
  const isModerator = role === 'host' || role === 'cohost';
  const sources = publishSourcesFor(role, conference);

  // Publishing is allowed only when the participant has at least one permitted
  // source AND has not been hard-muted by a host. Remember: an empty
  // canPublishSources array would mean "everything allowed", so when there is
  // nothing to grant we must clear canPublish instead of sending an empty list.
  const canPublish = !hardMuted && sources.length > 0;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: identityFor(user.id),
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    ttl: TOKEN_TTL,
    // Surfaced to other participants so the UI can badge the teacher.
    metadata: JSON.stringify({ role, userId: user.id })
  });

  const grant = {
    room: conference.roomName,
    roomJoin: true,
    canSubscribe: true,
    // Data messages carry chat and moderation events.
    canPublishData: conference.allowChat || isModerator,
    // Required for the raise-hand attribute the client sets on itself.
    canUpdateOwnMetadata: true,
    canPublish
  };

  if (canPublish) grant.canPublishSources = sources;
  // roomAdmin unlocks mute/kick/updateParticipant for this room only.
  if (isModerator) grant.roomAdmin = true;

  at.addGrant(grant);
  return at.toJwt();
};

/** Create the LiveKit room up front so policy is set before anyone joins. */
const ensureRoom = async (conference) => {
  const svc = getRoomService();
  try {
    await svc.createRoom({
      name: conference.roomName,
      emptyTimeout: 5 * 60,
      departureTimeout: 60,
      maxParticipants: conference.maxParticipants
    });
  } catch (error) {
    // createRoom is idempotent in practice; an already-exists error is fine.
    logger.debug('LiveKit createRoom returned an error (usually already exists)', {
      room: conference.roomName,
      message: error.message
    });
  }
};

const listParticipants = async (roomName) => {
  const svc = getRoomService();
  return svc.listParticipants(roomName);
};

const getParticipant = async (roomName, identity) => {
  const svc = getRoomService();
  return svc.getParticipant(roomName, identity);
};

/**
 * Mute every published track of one participant.
 * This is a real SFU-level stop — the forwarder's pubMuted flag is set and the
 * down-track stops writing packets, not a request the client may ignore.
 */
const muteParticipantTracks = async (roomName, identity, muted = true) => {
  const svc = getRoomService();
  const participant = await svc.getParticipant(roomName, identity);
  const tracks = participant?.tracks || [];

  await Promise.all(
    tracks.map((track) =>
      svc
        .mutePublishedTrack(roomName, identity, track.sid, muted)
        .catch((error) =>
          logger.warn('Failed to mute track', {
            room: roomName,
            identity,
            trackSid: track.sid,
            message: error.message
          })
        )
    )
  );

  return tracks.length;
};

/** Mute everyone except the identities listed in `exceptIdentities`. */
const muteEveryone = async (roomName, exceptIdentities = []) => {
  const svc = getRoomService();
  const participants = await svc.listParticipants(roomName);
  const skip = new Set(exceptIdentities);

  let muted = 0;
  for (const participant of participants) {
    if (skip.has(participant.identity)) continue;
    // Sequential on purpose: this runs on a 1-vCPU box shared with the API.
    // eslint-disable-next-line no-await-in-loop
    muted += await muteParticipantTracks(roomName, participant.identity, true);
  }
  return muted;
};

/**
 * Revoke publish permission entirely.
 * LiveKit unpublishes all of the participant's existing tracks when CanPublish
 * is withdrawn, and permissions are replaced atomically — so every field we
 * still want must be restated in the same call.
 */
const setPublishPermission = async (roomName, identity, canPublish, sources = []) => {
  const svc = getRoomService();
  const permission = {
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    canPublish
  };
  if (canPublish && sources.length) permission.canPublishSources = sources;

  return svc.updateParticipant(roomName, identity, { permission });
};

/**
 * Remove a participant and invalidate the token they are holding.
 *
 * `revokeTokenTs` kills any token whose `nbf` predates it. It does NOT stop
 * our own API from issuing a replacement — that is why the caller must also
 * persist the ban (ConferenceParticipant.isBanned) and check it before minting.
 */
const removeParticipant = async (roomName, identity) => {
  const svc = getRoomService();
  return svc.removeParticipant(roomName, identity, {
    revokeTokenTs: BigInt(Math.floor(Date.now() / 1000))
  });
};

const deleteRoom = async (roomName) => {
  const svc = getRoomService();
  return svc.deleteRoom(roomName);
};

/** Send a data payload to the room (or specific identities) as the server. */
const sendData = async (roomName, payload, destinationIdentities = []) => {
  const svc = getRoomService();
  const data = new TextEncoder().encode(JSON.stringify(payload));
  return svc.sendData(roomName, data, 0, { destinationIdentities });
};

/** Verify + decode a LiveKit webhook. Requires the RAW request body. */
const receiveWebhook = (rawBody, authHeader) => {
  const error = configurationError();
  if (error) throw new Error(`LiveKit is not configured: ${error}`);
  const receiver = new sdk.WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  return receiver.receive(rawBody, authHeader);
};

module.exports = {
  isConfigured,
  configurationError,
  identityFor,
  userIdFromIdentity,
  publishSourcesFor,
  createAccessToken,
  ensureRoom,
  listParticipants,
  getParticipant,
  muteParticipantTracks,
  muteEveryone,
  setPublishPermission,
  removeParticipant,
  deleteRoom,
  sendData,
  receiveWebhook,
  get publicUrl() {
    return LIVEKIT_PUBLIC_URL;
  }
};
