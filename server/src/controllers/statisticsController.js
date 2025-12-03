const { User, Job, Application, Organization, StudentProfile, RecruiterProfile, Event, EventRegistration, Achievement } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class StatisticsController {
  // Get comprehensive admin statistics
  async getAdminStats(req, res, next) {
    try {
      // Simple count queries without complex GROUP BY
      const totalUsers = await User.count();
      const totalOrganizations = await Organization.count();
      const totalJobs = await Job.count();
      const totalApplications = await Application.count();
      
      // Get user counts by role using simple queries
      const adminUsers = await User.count({ where: { role: 'admin' } });
      const tpoUsers = await User.count({ where: { role: 'tpo' } });
      const studentUsers = await User.count({ where: { role: 'student' } });
      const recruiterUsers = await User.count({ where: { role: 'recruiter' } });

      // Get job counts by status
      const activeJobs = await Job.count({ where: { status: 'active' } });
      const closedJobs = await Job.count({ where: { status: 'closed' } });
      const draftJobs = await Job.count({ where: { status: 'draft' } });

      // Get application counts by status
      const appliedApplications = await Application.count({ where: { status: 'applied' } });
      const screeningApplications = await Application.count({ where: { status: 'screening' } });
      const shortlistedApplications = await Application.count({ where: { status: 'shortlisted' } });
      const interviewedApplications = await Application.count({ where: { status: 'interviewed' } });
      const selectedApplications = await Application.count({ where: { status: 'selected' } });
      const rejectedApplications = await Application.count({ where: { status: 'rejected' } });
      const withdrawnApplications = await Application.count({ where: { status: 'withdrawn' } });

      // Get placement counts
      const placedStudents = await StudentProfile.count({ where: { placementStatus: 'placed' } });
      const unplacedStudents = await StudentProfile.count({ where: { placementStatus: 'unplaced' } });
      const deferredStudents = await StudentProfile.count({ where: { placementStatus: 'deferred' } });

      // Recent activity (last 7 days)
      const recentActivity = await Application.findAll({
        include: [
          {
            model: Job,
            as: 'job',
            attributes: ['title'],
            include: [{ model: Organization, as: 'organization', attributes: ['name'] }]
          },
          {
            model: User,
            as: 'student',
            attributes: ['firstName', 'lastName']
          }
        ],
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        limit: 10,
        order: [['createdAt', 'DESC']]
      });

      // Recent registrations (last 30 days)
      const recentRegistrations = await User.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      });

      // Recent job postings (last 7 days)
      const recentPostings = await Job.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      });

      res.json({
        message: 'Admin statistics retrieved successfully',
        stats: {
          users: {
            total: totalUsers,
            byRole: [
              { role: 'admin', count: adminUsers },
              { role: 'tpo', count: tpoUsers },
              { role: 'student', count: studentUsers },
              { role: 'recruiter', count: recruiterUsers }
            ],
            recentRegistrations
          },
          organizations: {
            total: totalOrganizations,
            byType: await Organization.findAll({
              attributes: ['type'],
              raw: true
            }).then(orgs => {
              const typeCounts = {};
              orgs.forEach(org => {
                typeCounts[org.type] = (typeCounts[org.type] || 0) + 1;
              });
              return Object.entries(typeCounts).map(([type, count]) => ({ type, count }));
            })
          },
          jobs: {
            total: totalJobs,
            byStatus: [
              { status: 'active', count: activeJobs },
              { status: 'closed', count: closedJobs },
              { status: 'draft', count: draftJobs }
            ],
            recentPostings
          },
          applications: {
            total: totalApplications,
            byStatus: [
              { status: 'applied', count: appliedApplications },
              { status: 'screening', count: screeningApplications },
              { status: 'shortlisted', count: shortlistedApplications },
              { status: 'interviewed', count: interviewedApplications },
              { status: 'selected', count: selectedApplications },
              { status: 'rejected', count: rejectedApplications },
              { status: 'withdrawn', count: withdrawnApplications }
            ]
          },
          placements: {
            byStatus: [
              { placementStatus: 'placed', count: placedStudents },
              { placementStatus: 'unplaced', count: unplacedStudents },
              { placementStatus: 'deferred', count: deferredStudents }
            ],
            totalPlaced: placedStudents
          },
          recentActivity
        }
      });
    } catch (error) {
      logger.error('Error in getAdminStats', error);
      next(error);
    }
  }

  // Get comprehensive TPO statistics
  async getTPOStats(req, res, next) {
    try {
      const { organizationId } = req.user;
      
      if (!organizationId) {
        return res.status(400).json({
          error: 'Organization Not Found',
          message: 'User is not associated with any organization'
        });
      }

      // Get students count for this organization
      const totalStudents = await StudentProfile.count({
        include: [
          {
            model: User,
            as: 'user',
            where: { organizationId },
            attributes: []
          }
        ]
      });

      // Get placement statistics for this organization
      const placedStudents = await StudentProfile.count({
        include: [
          {
            model: User,
            as: 'user',
            where: { organizationId },
            attributes: []
          }
        ],
        where: { placementStatus: 'placed' }
      });

      const unplacedStudents = await StudentProfile.count({
        include: [
          {
            model: User,
            as: 'user',
            where: { organizationId },
            attributes: []
          }
        ],
        where: { placementStatus: 'unplaced' }
      });

      const deferredStudents = await StudentProfile.count({
        include: [
          {
            model: User,
            as: 'user',
            where: { organizationId },
            attributes: []
          }
        ],
        where: { placementStatus: 'deferred' }
      });

      // Get course statistics for this organization
      const courseStats = await StudentProfile.findAll({
        include: [
          {
            model: User,
            as: 'user',
            where: { organizationId },
            attributes: []
          }
        ],
        attributes: ['course'],
        raw: true
      }).then(profiles => {
        const courseCounts = {};
        profiles.forEach(profile => {
          if (profile.course) {
            courseCounts[profile.course] = (courseCounts[profile.course] || 0) + 1;
          }
        });
        return Object.entries(courseCounts).map(([course, count]) => ({ course, count }));
      });

      // Get all students in this university
      const studentsInUniversity = await User.findAll({
        where: { 
          organizationId,
          role: 'student'
        },
        attributes: ['id']
      });
      const studentIds = studentsInUniversity.map(s => s.id);

      // Job statistics - TPOs see all jobs in the system (to know what's available for their students)
      const totalJobs = await Job.count();
      const activeJobs = await Job.count({ where: { status: 'active' } });
      const closedJobs = await Job.count({ where: { status: 'closed' } });
      const draftJobs = await Job.count({ where: { status: 'draft' } });

      // Application statistics - TPOs see applications from their students (regardless of job company)
      const totalApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds }
        }
      });

      const appliedApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'applied'
        }
      });

      const screeningApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'screening'
        }
      });

      const shortlistedApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'shortlisted'
        }
      });

      const interviewedApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'interviewed'
        }
      });

      const selectedApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'selected'
        }
      });

      const rejectedApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'rejected'
        }
      });

      const withdrawnApplications = await Application.count({
        where: {
          studentId: { [Op.in]: studentIds },
          status: 'withdrawn'
        }
      });

      // Event statistics
      const totalEvents = await Event.count({ where: { organizationId } });

      // Get recent activity - applications from students in this university
      const recentActivity = await Application.findAll({
        where: {
          studentId: { [Op.in]: studentIds }
        },
        include: [
          {
            model: Job,
            as: 'job',
            attributes: ['title', 'id'],
            include: [{ 
              model: Organization, 
              as: 'organization', 
              attributes: ['name', 'id'] 
            }]
          },
          {
            model: User,
            as: 'student',
            attributes: ['firstName', 'lastName', 'id']
          }
        ],
        limit: 10,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'TPO statistics retrieved successfully',
        stats: {
          students: {
            total: totalStudents,
            byPlacementStatus: [
              { placementStatus: 'placed', count: placedStudents },
              { placementStatus: 'unplaced', count: unplacedStudents },
              { placementStatus: 'deferred', count: deferredStudents }
            ],
            byCourse: courseStats,
            placed: placedStudents,
            placementRate: totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(1) : 0
          },
          jobs: {
            total: totalJobs,
            byStatus: [
              { status: 'active', count: activeJobs },
              { status: 'closed', count: closedJobs },
              { status: 'draft', count: draftJobs }
            ],
            active: activeJobs
          },
          applications: {
            total: totalApplications,
            byStatus: [
              { status: 'applied', count: appliedApplications },
              { status: 'screening', count: screeningApplications },
              { status: 'shortlisted', count: shortlistedApplications },
              { status: 'interviewed', count: interviewedApplications },
              { status: 'selected', count: selectedApplications },
              { status: 'rejected', count: rejectedApplications },
              { status: 'withdrawn', count: withdrawnApplications }
            ],
            byCompany: [] // Simplified for now
          },
          events: {
            total: totalEvents
          },
          recentActivity
        }
      });
    } catch (error) {
      logger.error('Error in getTPOStats', error);
      next(error);
    }
  }

  // Get dashboard overview statistics
  async getDashboardOverview(req, res, next) {
    try {
      const { role, organizationId } = req.user;
      
      if (role === 'admin') {
        return await this.getAdminStats(req, res, next);
      } else if (role === 'tpo') {
        return await this.getTPOStats(req, res, next);
      } else {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'This endpoint is only available for admin and TPO users'
        });
      }
    } catch (error) {
      logger.error('Error in getDashboardOverview', error);
      next(error);
    }
  }

  // Get advanced analytics with time-series data
  async getAdvancedAnalytics(req, res, next) {
    try {
      const { period = '30', startDate, endDate } = req.query;
      
      // Calculate date range
      let start, end;
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        const days = parseInt(period);
        end = new Date();
        start = new Date();
        start.setDate(start.getDate() - days);
      }

      // User growth over time (daily)
      const userGrowth = await this.getUserGrowthAnalytics(start, end, 'daily');
      
      // Job posting trends
      const jobTrends = await this.getJobAnalytics(start, end);
      
      // Application trends
      const applicationTrends = await this.getApplicationAnalytics(start, end);
      
      // Placement trends
      const placementTrends = await this.getPlacementAnalytics(start, end);

      res.json({
        message: 'Advanced analytics retrieved successfully',
        analytics: {
          period: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          userGrowth,
          jobTrends,
          applicationTrends,
          placementTrends
        }
      });
    } catch (error) {
      logger.error('Error in getAdvancedAnalytics', error);
      next(error);
    }
  }

  // Get user growth analytics
  async getUserGrowthAnalytics(startDate, endDate, granularity = 'daily') {
    const users = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: ['createdAt', 'role'],
      order: [['createdAt', 'ASC']]
    });

    const data = {};
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const key = granularity === 'daily' 
        ? current.toISOString().split('T')[0]
        : granularity === 'weekly'
        ? `${current.getFullYear()}-W${Math.ceil((current.getDate() + current.getDay()) / 7)}`
        : `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      
      if (!data[key]) {
        data[key] = { date: key, total: 0, students: 0, recruiters: 0, tpos: 0, admins: 0 };
      }

      if (granularity === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (granularity === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }

    users.forEach(user => {
      const date = new Date(user.createdAt);
      const key = granularity === 'daily'
        ? date.toISOString().split('T')[0]
        : granularity === 'weekly'
        ? `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (data[key]) {
        data[key].total++;
        const roleKey = user.role === 'tpo' ? 'tpos' : `${user.role}s`;
        data[key][roleKey] = (data[key][roleKey] || 0) + 1;
      }
    });

    return Object.values(data);
  }

  // Get job analytics
  async getJobAnalytics(startDate, endDate) {
    const jobs = await Job.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: ['createdAt', 'status'],
      include: [{
        model: Organization,
        as: 'organization',
        attributes: ['id', 'name']
      }],
      order: [['createdAt', 'ASC']]
    });

    const dailyData = {};
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const key = current.toISOString().split('T')[0];
      dailyData[key] = { date: key, total: 0, active: 0, closed: 0, draft: 0 };
      current.setDate(current.getDate() + 1);
    }

    jobs.forEach(job => {
      const key = new Date(job.createdAt).toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].total++;
        dailyData[key][job.status] = (dailyData[key][job.status] || 0) + 1;
      }
    });

    return {
      daily: Object.values(dailyData),
      total: jobs.length,
      byStatus: {
        active: jobs.filter(j => j.status === 'active').length,
        closed: jobs.filter(j => j.status === 'closed').length,
        draft: jobs.filter(j => j.status === 'draft').length
      }
    };
  }

  // Get application analytics
  async getApplicationAnalytics(startDate, endDate) {
    const applications = await Application.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: ['createdAt', 'status'],
      order: [['createdAt', 'ASC']]
    });

    const dailyData = {};
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const key = current.toISOString().split('T')[0];
      dailyData[key] = {
        date: key,
        total: 0,
        applied: 0,
        screening: 0,
        shortlisted: 0,
        interviewed: 0,
        selected: 0,
        rejected: 0,
        withdrawn: 0
      };
      current.setDate(current.getDate() + 1);
    }

    applications.forEach(app => {
      const key = new Date(app.createdAt).toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].total++;
        dailyData[key][app.status] = (dailyData[key][app.status] || 0) + 1;
      }
    });

    // Funnel data
    const funnel = {
      applied: applications.filter(a => a.status === 'applied').length,
      screening: applications.filter(a => a.status === 'screening').length,
      shortlisted: applications.filter(a => a.status === 'shortlisted').length,
      interviewed: applications.filter(a => a.status === 'interviewed').length,
      selected: applications.filter(a => a.status === 'selected').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      withdrawn: applications.filter(a => a.status === 'withdrawn').length
    };

    return {
      daily: Object.values(dailyData),
      total: applications.length,
      funnel,
      conversionRate: funnel.applied > 0 
        ? ((funnel.selected / funnel.applied) * 100).toFixed(2)
        : 0
    };
  }

  // Get placement analytics
  async getPlacementAnalytics(startDate, endDate) {
    const students = await StudentProfile.findAll({
      include: [{
        model: User,
        as: 'user',
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate]
          }
        },
        attributes: ['createdAt']
      }],
      attributes: ['placementStatus', 'createdAt']
    });

    const dailyData = {};
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const key = current.toISOString().split('T')[0];
      dailyData[key] = { date: key, placed: 0, unplaced: 0, deferred: 0 };
      current.setDate(current.getDate() + 1);
    }

    students.forEach(student => {
      if (student.user && student.user.createdAt) {
        const key = new Date(student.user.createdAt).toISOString().split('T')[0];
        if (dailyData[key]) {
          dailyData[key][student.placementStatus] = (dailyData[key][student.placementStatus] || 0) + 1;
        }
      }
    });

    const totalPlaced = students.filter(s => s.placementStatus === 'placed').length;
    const totalUnplaced = students.filter(s => s.placementStatus === 'unplaced').length;
    const totalDeferred = students.filter(s => s.placementStatus === 'deferred').length;
    const total = students.length;

    return {
      daily: Object.values(dailyData),
      total,
      placed: totalPlaced,
      unplaced: totalUnplaced,
      deferred: totalDeferred,
      placementRate: total > 0 ? ((totalPlaced / total) * 100).toFixed(2) : 0
    };
  }

  // Get top performers
  async getTopPerformers(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      // Top universities by placements
      const topUniversities = await StudentProfile.findAll({
        include: [{
          model: User,
          as: 'user',
          include: [{
            model: Organization,
            as: 'organization',
            where: { type: 'university' },
            attributes: ['id', 'name']
          }]
        }],
        where: { placementStatus: 'placed' },
        attributes: ['placementStatus'],
        raw: true,
        nest: true
      }).then(results => {
        const universityCounts = {};
        results.forEach(result => {
          const orgId = result.user.organization.id;
          const orgName = result.user.organization.name;
          if (!universityCounts[orgId]) {
            universityCounts[orgId] = { id: orgId, name: orgName, placements: 0 };
          }
          universityCounts[orgId].placements++;
        });
        return Object.values(universityCounts)
          .sort((a, b) => b.placements - a.placements)
          .slice(0, parseInt(limit));
      });

      // Top companies by jobs posted
      const topCompanies = await Job.findAll({
        include: [{
          model: Organization,
          as: 'organization',
          where: { type: 'company' },
          attributes: ['id', 'name']
        }],
        attributes: ['id'],
        raw: true,
        nest: true
      }).then(results => {
        const companyCounts = {};
        results.forEach(result => {
          const orgId = result.organization.id;
          const orgName = result.organization.name;
          if (!companyCounts[orgId]) {
            companyCounts[orgId] = { id: orgId, name: orgName, jobs: 0 };
          }
          companyCounts[orgId].jobs++;
        });
        return Object.values(companyCounts)
          .sort((a, b) => b.jobs - a.jobs)
          .slice(0, parseInt(limit));
      });

      // Top students by CGPA (if available)
      const topStudents = await StudentProfile.findAll({
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: Organization,
            as: 'organization',
            attributes: ['name']
          }]
        }],
        where: {
          cgpa: { [Op.ne]: null }
        },
        attributes: ['id', 'cgpa', 'placementStatus'],
        order: [['cgpa', 'DESC']],
        limit: parseInt(limit)
      });

      res.json({
        message: 'Top performers retrieved successfully',
        topPerformers: {
          universities: topUniversities,
          companies: topCompanies,
          students: topStudents.map(s => ({
            id: s.user.id,
            name: `${s.user.firstName} ${s.user.lastName}`,
            email: s.user.email,
            cgpa: s.cgpa,
            placementStatus: s.placementStatus,
            university: s.user.organization?.name
          }))
        }
      });
    } catch (error) {
      logger.error('Error in getTopPerformers', error);
      next(error);
    }
  }
}

const controller = new StatisticsController();

// Bind methods to preserve 'this' context
module.exports = {
  getAdminStats: controller.getAdminStats.bind(controller),
  getTPOStats: controller.getTPOStats.bind(controller),
  getDashboardOverview: controller.getDashboardOverview.bind(controller),
  getAdvancedAnalytics: controller.getAdvancedAnalytics.bind(controller),
  getTopPerformers: controller.getTopPerformers.bind(controller)
};
