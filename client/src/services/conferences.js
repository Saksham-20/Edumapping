// client/src/services/conferences.js
import api from './api';

/**
 * Conference API client.
 *
 * Every moderation call here is re-authorised on the server — these helpers are
 * a convenience layer, never the security boundary.
 */
const conferenceService = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/conferences${query ? `?${query}` : ''}`);
  },

  get: (id) => api.get(`/conferences/${id}`),

  create: (payload) => api.post('/conferences', payload),

  /** Mint a LiveKit token. Returns { token, url, role, conference }. */
  getToken: (id) => api.post(`/conferences/${id}/token`),

  listParticipants: (id) => api.get(`/conferences/${id}/participants`),

  updateSettings: (id, settings) => api.patch(`/conferences/${id}/settings`, { settings }),

  end: (id) => api.post(`/conferences/${id}/end`),

  /* ------------------------------------------------------------ attendee */
  setHand: (id, raised) => api.post(`/conferences/${id}/hand`, { raised }),

  /* ---------------------------------------------------------- moderation */
  /** `hard: true` revokes publish rights so the student cannot self-unmute. */
  mute: (id, userId, hard = false) =>
    api.post(`/conferences/${id}/participants/${userId}/mute`, { hard }),

  unmute: (id, userId) => api.post(`/conferences/${id}/participants/${userId}/unmute`),

  muteAll: (id) => api.post(`/conferences/${id}/mute-all`),

  /** `ban: true` (default) also blocks rejoin. */
  remove: (id, userId, ban = true) =>
    api.delete(`/conferences/${id}/participants/${userId}`, { data: { ban } }),

  readmit: (id, userId) => api.post(`/conferences/${id}/participants/${userId}/readmit`),

  lowerHand: (id, userId) => api.post(`/conferences/${id}/participants/${userId}/lower-hand`)
};

export default conferenceService;
