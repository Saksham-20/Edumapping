// client/src/services/conferences.js
//
// Thin wrapper over the /api/conferences endpoints. The axios instance already
// unwraps to `response.data`, so every method here returns the JSON body.
import api from './api';

/** Roles the server lets host a live session (conferenceController HOST_ROLES). */
export const HOST_ROLES = ['tpo', 'admin', 'teacher', 'principal', 'school_admin', 'career_counselor'];

export const canHostConferences = (role) => HOST_ROLES.includes(role);

const conferenceService = {
  /**
   * Everything the caller can see: hosted by them, their org's, or public.
   * `config` is axios request config, so a caller can pass `{ silent: true }`
   * to suppress the interceptor's automatic error toast and render its own.
   */
  list: (params = {}, config = {}) => api.get('/conferences', { params, ...config }),

  get: (id) => api.get(`/conferences/${id}`),

  create: (payload, config = {}) => api.post('/conferences', payload, config),

  /** Ends a live session for everyone. Host and admin only, server-enforced. */
  end: (id) => api.post(`/conferences/${id}/end`),

  updateSettings: (id, settings) => api.patch(`/conferences/${id}/settings`, settings),

  /* The room's calls. They were dropped when this file was cut down for the
     list page, and every join then failed with "getToken is not a function".
     Each is re-authorised on the server; these are convenience only. */

  /**
   * Mints a LiveKit token: { token, url, role, conference }. `silent` because
   * the room explains a failed join full-screen. The body is `{}`: with no
   * body express.json rejected the request with a 400.
   */
  getToken: (id) => api.post(`/conferences/${id}/token`, {}, { silent: true }),

  listParticipants: (id) => api.get(`/conferences/${id}/participants`, { silent: true }),

  setHand: (id, raised) => api.post(`/conferences/${id}/hand`, { raised }),

  /** `hard: true` revokes publish rights so the student cannot self-unmute. */
  mute: (id, userId, hard = false) => api.post(`/conferences/${id}/participants/${userId}/mute`, { hard }),

  unmute: (id, userId) => api.post(`/conferences/${id}/participants/${userId}/unmute`),

  muteAll: (id) => api.post(`/conferences/${id}/mute-all`),

  /** `ban: true` (default) also blocks rejoin. */
  remove: (id, userId, ban = true) => api.delete(`/conferences/${id}/participants/${userId}`, { data: { ban } }),

  readmit: (id, userId) => api.post(`/conferences/${id}/participants/${userId}/readmit`),

  lowerHand: (id, userId) => api.post(`/conferences/${id}/participants/${userId}/lower-hand`)
};

export default conferenceService;
