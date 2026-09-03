// client/src/services/approvals.js
//
// The TPO approval queue. Thin wrapper over /api/approvals.
//
// Every method used to `return response.data`, but the shared axios instance
// has ALREADY unwrapped the response to its body — so `.data` was reading a
// property of the JSON payload, which these endpoints do not have, and every
// call resolved to undefined. The approval page crashed on load as a result.
// The body is the return value.
import api from './api';

class ApprovalService {
  /** Organizations and recruiters awaiting this TPO's decision. */
  async getPendingApprovals() {
    return api.get('/approvals/pending');
  }

  /** `action` is 'approve' or 'reject'. */
  async approveOrganization(organizationId, action, notes = '') {
    return api.patch(`/approvals/organizations/${organizationId}`, { action, notes });
  }

  async approveRecruiter(userId, action, notes = '') {
    return api.patch(`/approvals/recruiters/${userId}`, { action, notes });
  }

  async bulkApproveOrganizations(organizationIds, action, notes = '') {
    return api.patch('/approvals/organizations/bulk', { organizationIds, action, notes });
  }

  async getApprovalStats() {
    return api.get('/approvals/stats');
  }
}

// Named instance rather than an anonymous default export, which eslint's
// import/no-anonymous-default-export flags.
const approvalService = new ApprovalService();
export default approvalService;
