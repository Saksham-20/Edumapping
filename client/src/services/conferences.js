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

  create: (payload) => api.post('/conferences', payload),

  /** Ends a live session for everyone. Host and admin only, server-enforced. */
  end: (id) => api.post(`/conferences/${id}/end`),

  updateSettings: (id, settings) => api.patch(`/conferences/${id}/settings`, settings)
};

export default conferenceService;
