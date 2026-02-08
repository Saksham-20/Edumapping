// client/src/services/adminService.js
import api from './api';

class AdminService {
  // User Management
  async createUser(userData) {
    return await api.post('/admin/users', userData);
  }

  async updateUser(userId, userData) {
    return await api.put(`/admin/users/${userId}`, userData);
  }

  async deleteUser(userId, hardDelete = false) {
    return await api.delete(`/admin/users/${userId}?hardDelete=${hardDelete}`);
  }

  async getUserById(userId) {
    return await api.get(`/admin/users/${userId}`);
  }

  async bulkUpdateUsers(userIds, updates) {
    return await api.post('/admin/users/bulk', { userIds, updates });
  }

  /**
   * Import students from Excel file (Admin only).
   * @param {File} file - Excel file (.xlsx or .xls)
   * @param {number} organizationId - University, college, or school ID
   */
  async importStudentsExcel(file, organizationId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', String(organizationId));
    return await api.post('/admin/students/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  // TPO Management
  async getAllTPOs(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/admin/tpos?${queryParams}`);
  }

  async createTPO(tpoData) {
    return await api.post('/admin/tpos', tpoData);
  }

  async updateTPO(tpoId, tpoData) {
    return await api.put(`/admin/tpos/${tpoId}`, tpoData);
  }

  async deleteTPO(tpoId, hardDelete = false) {
    return await api.delete(`/admin/tpos/${tpoId}?hardDelete=${hardDelete}`);
  }

  // Organization Management
  async getAllOrganizations(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/admin/organizations?${queryParams}`);
  }

  async getAllUniversities(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/admin/organizations/universities?${queryParams}`);
  }

  async getAllCompanies(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/admin/organizations/companies?${queryParams}`);
  }

  async getAllSchools(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/admin/organizations/schools?${queryParams}`);
  }

  async getAllColleges(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/admin/organizations?type=college&${queryParams}`);
  }

  async createOrganization(orgData) {
    return await api.post('/admin/organizations', orgData);
  }

  async updateOrganization(orgId, orgData) {
    return await api.put(`/admin/organizations/${orgId}`, orgData);
  }

  async deleteOrganization(orgId, options = {}) {
    const { hardDelete, migrateToOrgId } = options;
    const params = new URLSearchParams();
    if (hardDelete) params.append('hardDelete', 'true');
    if (migrateToOrgId) params.append('migrateToOrgId', migrateToOrgId);
    const queryString = params.toString();
    return await api.delete(`/admin/organizations/${orgId}${queryString ? `?${queryString}` : ''}`);
  }

  async getOrganizationById(orgId) {
    return await api.get(`/admin/organizations/${orgId}`);
  }

  async verifyOrganization(orgId, isVerified) {
    return await api.patch(`/admin/organizations/${orgId}/verify`, { isVerified });
  }

  async bulkUpdateOrganizations(organizationIds, updates) {
    return await api.post('/admin/organizations/bulk', { organizationIds, updates });
  }

  // Analytics
  async getAdvancedAnalytics(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return await api.get(`/statistics/analytics/advanced?${queryParams}`);
  }

  async getTopPerformers(limit = 10) {
    return await api.get(`/statistics/analytics/top-performers?limit=${limit}`);
  }

  // Recruiter permissions: institutions + geographic (region/state/city) and academic (year/stream) filters
  async getRecruiterPermissions(recruiterId) {
    const res = await api.get(`/admin/recruiters/${recruiterId}/permissions`);
    return res;
  }

  async setRecruiterAllowedOrganizations(recruiterId, payload) {
    const normalized = Array.isArray(payload)
      ? { organizationIds: payload }
      : typeof payload === 'object' && payload !== null
        ? payload
        : { organizationIds: [] };
    const {
      organizationIds = [],
      allowedYears,
      allowedStreams,
      allowedRegions,
      allowedStates,
      allowedCities
    } = normalized;
    return await api.put(`/admin/recruiters/${recruiterId}/allowed-organizations`, {
      organizationIds: Array.isArray(organizationIds) ? organizationIds : [],
      ...(Array.isArray(allowedYears) && { allowedYears }),
      ...(Array.isArray(allowedStreams) && { allowedStreams }),
      ...(Array.isArray(allowedRegions) && { allowedRegions }),
      ...(Array.isArray(allowedStates) && { allowedStates }),
      ...(Array.isArray(allowedCities) && { allowedCities })
    });
  }
}

export default new AdminService();


