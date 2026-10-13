// client/src/services/statistics.js
//
// Dashboard statistics. The shared axios instance already unwraps the body and
// toasts failures, so these are plain pass-throughs; `config` lets a caller
// that renders its own error state send `{ silent: true }`.
//
// (Each method used to wrap the call in try/catch only to console.error and
// rethrow, which added noise to the console and nothing else.)
import api from './api';

class StatisticsService {
  /** Platform-wide counts. Every breakdown sums to its total. */
  async getAdminStats(config) {
    return api.get('/statistics/admin', config);
  }

  /** The signed-in TPO's institution. */
  async getTPOStats(config) {
    return api.get('/statistics/tpo', config);
  }

  /** Admin or TPO stats, depending on who is asking. */
  async getDashboardOverview(config) {
    return api.get('/statistics/dashboard', config);
  }

  async getJobStats(organizationId = null, config = {}) {
    return api.get('/jobs/stats', {
      ...config,
      params: organizationId ? { organizationId } : undefined
    });
  }

  async getApplicationStats(jobId = null, organizationId = null, config = {}) {
    const params = {};
    if (jobId) params.jobId = jobId;
    if (organizationId) params.organizationId = organizationId;
    return api.get('/applications/stats', { ...config, params });
  }

  /**
   * Placement analytics for one institution. A TPO's own institution is used
   * whatever is passed; an admin must pass `organizationId`.
   */
  async getTPOAnalytics(params = {}, config = {}) {
    return api.get('/analytics/tpo', { ...config, params });
  }
}

const statisticsService = new StatisticsService();
export default statisticsService;
