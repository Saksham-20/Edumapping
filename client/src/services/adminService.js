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
}

export default new AdminService();


