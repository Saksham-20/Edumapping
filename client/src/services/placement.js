// client/src/services/placement.js
//
// The placement cell's tools (policy, roster, verification, report), the drive
// calendar, selection rounds and offer letters. Thin wrappers over `api`,
// which already unwraps `response.data` and toasts errors.
import api from './api';

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Trigger a browser download for a blob response. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const placementService = {
  // policy
  getPolicy: (params) => api.get(`/placement/policy${qs(params)}`),
  savePolicy: (data) => api.put('/placement/policy', data),

  // roster & verification
  getStudents: (params) => api.get(`/placement/students${qs(params)}`),
  exportStudents: async (params) => {
    const blob = await api.get(`/placement/students/export${qs(params)}`, { responseType: 'blob' });
    saveBlob(blob, 'students.csv');
  },
  reviewVerification: (userId, action, notes) =>
    api.post(`/placement/students/${userId}/verification`, { action, notes }),
  bulkVerify: (userIds) => api.post('/placement/students/verify-bulk', { userIds }),
  setOutcome: (userId, placementStatus) => api.patch(`/placement/students/${userId}/outcome`, { placementStatus }),
  requestVerification: () => api.post('/placement/verification/request'),
  uploadMarksheet: (file) => {
    const fd = new FormData();
    fd.append('document', file);
    return api.post('/placement/verification/marksheet', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // report
  getReport: (params) => api.get(`/placement/report${qs(params)}`),
  downloadReport: async (params) => {
    const blob = await api.get(`/placement/report${qs({ ...params, format: 'xlsx' })}`, { responseType: 'blob' });
    saveBlob(blob, `placement-report-${params?.graduationYear || 'all'}.xlsx`);
  },

  // calendar
  getCalendar: (params) => api.get(`/placement/calendar${qs(params)}`),
  downloadCalendar: async (params) => {
    const blob = await api.get(`/placement/calendar${qs({ ...params, format: 'ics' })}`, { responseType: 'blob' });
    saveBlob(blob, 'edumapping-calendar.ics');
  },

  // rounds
  getRounds: (jobId) => api.get(`/rounds${qs({ jobId })}`),
  getMyRounds: (params) => api.get(`/rounds/mine${qs(params)}`),
  createRound: (data) => api.post('/rounds', data),
  updateRound: (id, data) => api.put(`/rounds/${id}`, data),
  deleteRound: (id) => api.delete(`/rounds/${id}`),
  addParticipants: (id, data) => api.post(`/rounds/${id}/participants`, data),
  recordResults: (id, data) => api.post(`/rounds/${id}/results`, data),
  updateParticipant: (id, participantId, data) => api.patch(`/rounds/${id}/participants/${participantId}`, data),
  removeParticipant: (id, participantId) => api.delete(`/rounds/${id}/participants/${participantId}`),

  // offer letters
  uploadOfferLetter: (offerId, file) => {
    const fd = new FormData();
    fd.append('document', file);
    return api.post(`/offers/${offerId}/letter`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  verifyOfferLetter: (offerId, verified = true) => api.patch(`/offers/${offerId}/letter-verification`, { verified })
};

export default placementService;
