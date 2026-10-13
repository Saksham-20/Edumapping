// client/src/services/approvals.js
//
// The approval queue. Thin wrapper over /api/approvals, shared by TPOs (who
// vet companies and recruiters) and admins (who vet everything). The server
// scopes each list to the caller, so the same calls are safe from either.
//
// Every method used to `return response.data`, but the shared axios instance
// has ALREADY unwrapped the response to its body — so `.data` was reading a
// property of the JSON payload, which these endpoints do not have, and every
// call resolved to undefined. The approval page crashed on load as a result.
// The body is the return value.
//
// `config` is passed through to axios so callers that render their own error
// state can send `{ silent: true }` and avoid a second, duplicate toast.
import api from './api';

class ApprovalService {
  /** Organizations and accounts awaiting this reviewer's decision (first 100). */
  async getPendingApprovals(config) {
    return api.get('/approvals/pending', config);
  }

  /** Paginated organizations. `params`: status, type, search, page, limit. */
  async listOrganizations(params = {}, config = {}) {
    return api.get('/approvals/organizations', { ...config, params });
  }

  /** Paginated accounts. `params`: status (pending|approved|rejected|stuck), role, search, page, limit. */
  async listUsers(params = {}, config = {}) {
    return api.get('/approvals/users', { ...config, params });
  }

  /** `action` is 'approve' or 'reject'. */
  async approveOrganization(organizationId, action, notes = '', config) {
    return api.patch(`/approvals/organizations/${organizationId}`, { action, notes }, config);
  }

  async approveRecruiter(userId, action, notes = '', config) {
    return api.patch(`/approvals/recruiters/${userId}`, { action, notes }, config);
  }

  /** Any account (admin), or a recruiter (TPO). */
  async approveUser(userId, action, notes = '', config) {
    return api.patch(`/approvals/users/${userId}`, { action, notes }, config);
  }

  async bulkApproveOrganizations(organizationIds, action, notes = '', config) {
    return api.patch('/approvals/organizations/bulk', { organizationIds, action, notes }, config);
  }

  async getApprovalStats(config) {
    return api.get('/approvals/stats', config);
  }

  /** Job postings waiting to be published (paginated). */
  async listPendingJobs(params = {}, config = {}) {
    return api.get('/jobs/pending-review', { ...config, params });
  }

  async reviewJob(jobId, action, notes = '', config) {
    return api.patch(`/jobs/${jobId}/review`, { action, notes }, config);
  }

  /** The institution / platform activity trail (paginated). */
  async getAuditLog(params = {}, config = {}) {
    return api.get('/audit', { ...config, params });
  }
}

// Named instance rather than an anonymous default export, which eslint's
// import/no-anonymous-default-export flags.
const approvalService = new ApprovalService();
export default approvalService;
