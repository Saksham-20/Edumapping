const { User, Job, Application, Organization, StudentProfile, RecruiterProfile, Event, EventRegistration, Achievement } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
// The approvals queue and student job visibility share these rules; the
// dashboard counts must agree with both.
const { companyIdsRecruitingAt, studentVisibleJobWhere } = require('../services/recruiterAccessService');

/**
 * Counts grouped by one column, with every value of the column's ENUM present
 * (zero when absent) so a breakdown always sums to its total.
 *
 * The dashboards used to hand-list the statuses they knew about — four of the
 * eight user roles, three of the five job statuses — so a platform with school
 * staff or postings awaiting review showed breakdowns that summed to less than
 * the headline number above them. Reading the values off the model means a new
 * enum value shows up here without anyone remembering to add it.
 */
const groupedCounts = async (Model, column, { where = {}, include, key = column } = {}) => {
  const values = Model.rawAttributes[column]?.values || [];
  // Always table-qualified and by DB field name: these models are
  // `underscored`, and `col()` is emitted verbatim with no attribute mapping.
  const qualified = `${Model.name}.${Model.rawAttributes[column]?.field || column}`;
  const rows = await Model.findAll({
    where,
    include,
    attributes: [
      [Model.sequelize.col(qualified), column],
      [Model.sequelize.fn('COUNT', Model.sequelize.col(`${Model.name}.id`)), 'count']
    ],
    group: [Model.sequelize.col(qualified)],
    raw: true
  });
  const byValue = new Map(rows.map((r) => [r[column], parseInt(r.count, 10) || 0]));
  const out = values.map((value) => ({ [key]: value, count: byValue.get(value) || 0 }));
  // Rows whose value is not in the enum (NULLs, mostly) still count toward the
  // total, so they are reported rather than dropped.
  rows.forEach((r) => {
    if (!values.includes(r[column])) {
      out.push({ [key]: r[column] ?? 'unknown', count: parseInt(r.count, 10) || 0 });
    }
  });
  return out;
};

const sumCounts = (rows) => rows.reduce((sum, r) => sum + (r.count || 0), 0);
const countOf = (rows, key, value) => rows.find((r) => r[key] === value)?.count || 0;

class StatisticsController {
  // Get comprehensive admin statistics
  async getAdminStats(req, res, next) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        usersByRole,
        usersByApproval,
        orgsByType,
        orgsByApproval,
        jobsByStatus,
        applicationsByStatus,
        placementsByStatus,
        recentRegistrations,
        recentPostings,
        recentActivity
      ] = await Promise.all([
        groupedCounts(User, 'role'),
        groupedCounts(User, 'approvalStatus'),
        groupedCounts(Organization, 'type'),
        groupedCounts(Organization, 'approvalStatus'),
        groupedCounts(Job, 'status'),
        groupedCounts(Application, 'status'),
        groupedCounts(StudentProfile, 'placementStatus'),
        User.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
        Job.count({ where: { createdAt: { [Op.gte]: sevenDaysAgo } } }),
        Application.findAll({
          include: [
            {
              model: Job,
              as: 'job',
              attributes: ['title'],
              include: [{ model: Organization, as: 'organization', attributes: ['name'] }]
            },
            { model: User, as: 'student', attributes: ['firstName', 'lastName'] }
          ],
          where: { createdAt: { [Op.gte]: sevenDaysAgo } },
          limit: 10,
          order: [['createdAt', 'DESC']]
        })
      ]);

      // Totals are the sums of their own breakdowns, so the two can never
      // disagree on screen.
      const totalPlaced = countOf(placementsByStatus, 'placementStatus', 'placed');

      res.json({
        message: 'Admin statistics retrieved successfully',
        stats: {
          users: {
            total: sumCounts(usersByRole),
            byRole: usersByRole,
            byApprovalStatus: usersByApproval,
            pendingApproval: countOf(usersByApproval, 'approvalStatus', 'pending'),
            recentRegistrations
          },
          organizations: {
            total: sumCounts(orgsByType),
            byType: orgsByType,
            byApprovalStatus: orgsByApproval,
            pendingApproval: countOf(orgsByApproval, 'approvalStatus', 'pending')
          },
          jobs: {
            total: sumCounts(jobsByStatus),
            byStatus: jobsByStatus,
            pendingReview: countOf(jobsByStatus, 'status', 'pending_review'),
            recentPostings
          },
          applications: {
            total: sumCounts(applicationsByStatus),
            byStatus: applicationsByStatus
          },
          placements: {
            total: sumCounts(placementsByStatus),
            byStatus: placementsByStatus,
            totalPlaced
          },
          recentActivity
        }
      });
    } catch (error) {
      logger.error('Error in getAdminStats', error);
      next(error);
    }
  }

  /**
   * The placement officer's dashboard, scoped to their institution.
   *
   * Jobs: this used to be `Job.count()` — every posting on the platform, drafts
   * and other companies' cancelled reqs included — under a heading that said
   * "postings visible to your students". It is now exactly that set: every
   * live posting (students can browse all of them) plus any posting, in any
   * state, that one of this institution's students has applied to — a closed
   * drive still matters to the cell if their students are in its pipeline.
   * Postings awaiting review are not visible to students and are reported
   * separately as the review queue.
   */
  async getTPOStats(req, res, next) {
    try {
      const { organizationId } = req.user;

      if (!organizationId) {
        return res.status(400).json({
          error: 'Organization Not Found',
          message: 'User is not associated with any organization'
        });
      }

      const ownStudents = { model: User, as: 'student', where: { organizationId }, attributes: [] };
      // Same rule as the approvals queue (jobController.reviewableCompanyIds).
      const companyIds = await companyIdsRecruitingAt(organizationId);
      const studentVisible = await studentVisibleJobWhere({ organizationId, role: 'student' });
      const ownProfiles = { model: User, as: 'user', where: { organizationId }, attributes: [] };

      const [placementByStatus, courseRows, applicationsByStatus, appliedJobRows, pendingReview] =
        await Promise.all([
          groupedCounts(StudentProfile, 'placementStatus', { include: [ownProfiles] }),
          StudentProfile.findAll({
            include: [ownProfiles],
            attributes: [
              'course',
              [StudentProfile.sequelize.fn('COUNT', StudentProfile.sequelize.col('StudentProfile.id')), 'count']
            ],
            group: ['course'],
            raw: true
          }),
          groupedCounts(Application, 'status', { include: [ownStudents] }),
          Application.findAll({
            include: [ownStudents],
            attributes: [[Application.sequelize.fn('DISTINCT', Application.sequelize.col('job_id')), 'jobId']],
            raw: true
          }),
          // Only what this TPO's approvals queue shows. Counting every pending
          // posting on the platform put "1 posting awaiting review" on a
          // dashboard whose queue was empty.
          companyIds.length
            ? Job.count({ where: { status: 'pending_review', organizationId: { [Op.in]: companyIds } } })
            : 0
        ]);

      const appliedJobIds = appliedJobRows.map((r) => r.jobId).filter(Boolean);
      // "Visible to your students": live postings from the institution itself
      // or from a company linked to it, plus anything they already applied to.
      // Every active job on the platform was counted before.
      const visibleJobs = {
        [Op.or]: [
          studentVisible,
          ...(appliedJobIds.length ? [{ id: { [Op.in]: appliedJobIds } }] : [])
        ]
      };

      const [jobsByStatusAll, byCompanyRows, totalEvents, recentActivity] = await Promise.all([
        groupedCounts(Job, 'status', { where: visibleJobs }),
        // Applications by hiring company. Grouped in SQL so a campus with
        // thousands of applications does not ship them all to Node to count.
        Application.findAll({
          include: [
            ownStudents,
            {
              model: Job,
              as: 'job',
              attributes: [],
              include: [{ model: Organization, as: 'organization', attributes: [] }]
            }
          ],
          attributes: [
            [Application.sequelize.col('job->organization.id'), 'organizationId'],
            [Application.sequelize.col('job->organization.name'), 'name'],
            [Application.sequelize.col('job->organization.logo_url'), 'logoUrl'],
            [Application.sequelize.fn('COUNT', Application.sequelize.col('Application.id')), 'applications'],
            [
              Application.sequelize.fn(
                'SUM',
                Application.sequelize.literal(`CASE WHEN "Application"."status" = 'selected' THEN 1 ELSE 0 END`)
              ),
              'selected'
            ],
            [Application.sequelize.fn('COUNT', Application.sequelize.fn('DISTINCT', Application.sequelize.col('job.id'))), 'jobs']
          ],
          group: [
            Application.sequelize.col('job->organization.id'),
            Application.sequelize.col('job->organization.name'),
            Application.sequelize.col('job->organization.logo_url')
          ],
          raw: true
        }),
        Event.count({ where: { organizationId } }),
        Application.findAll({
          include: [
            {
              model: Job,
              as: 'job',
              attributes: ['title', 'id'],
              include: [{ model: Organization, as: 'organization', attributes: ['name', 'id'] }]
            },
            {
              model: User,
              as: 'student',
              where: { organizationId },
              attributes: ['firstName', 'lastName', 'id']
            }
          ],
          limit: 10,
          order: [['createdAt', 'DESC']]
        })
      ]);

      // pending_review postings cannot be in the visible set unless a student
      // somehow applied to one; drop the row from the pipeline either way so
      // the pipeline is "what students see" and the queue is reported apart.
      const jobsByStatus = jobsByStatusAll.filter((r) => r.status !== 'pending_review' || r.count > 0);
      const totalStudents = sumCounts(placementByStatus);
      // The roster counts every student account; this tile counts profiles.
      // Both are reported so the dashboard can say which is which.
      const studentAccounts = await User.count({ where: { organizationId, role: 'student' } });
      const placedStudents = countOf(placementByStatus, 'placementStatus', 'placed');

      const byCompany = byCompanyRows
        .map((r) => ({
          organizationId: r.organizationId,
          name: r.name,
          logoUrl: r.logoUrl,
          count: parseInt(r.applications, 10) || 0,
          selected: parseInt(r.selected, 10) || 0,
          jobs: parseInt(r.jobs, 10) || 0
        }))
        .sort((a, b) => b.count - a.count);

      res.json({
        message: 'TPO statistics retrieved successfully',
        stats: {
          students: {
            total: totalStudents,
            accounts: studentAccounts,
            byPlacementStatus: placementByStatus,
            byCourse: courseRows
              .filter((r) => r.course)
              .map((r) => ({ course: r.course, count: parseInt(r.count, 10) || 0 })),
            placed: placedStudents,
            placementRate: totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(1) : 0
          },
          jobs: {
            total: sumCounts(jobsByStatus),
            byStatus: jobsByStatus,
            active: countOf(jobsByStatus, 'status', 'active'),
            appliedTo: appliedJobIds.length,
            pendingReview
          },
          applications: {
            total: sumCounts(applicationsByStatus),
            byStatus: applicationsByStatus,
            byCompany
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
  /**
   * Placements over time.
   *
   * The daily series used to bucket each student on the date their ACCOUNT was
   * created, and filtered the whole query on that date too — so a chart
   * labelled "placements" actually plotted signups, coloured by each student's
   * current placement status. A student placed today appeared on the day they
   * registered, months earlier, and a cohort that all signed up in one week
   * produced a single spike no matter when they were hired.
   *
   * The daily series is now built from `applications.result_at` — the moment a
   * selection was recorded — which is the only date in the schema that means
   * "this is when the placement happened". The headline totals stay a snapshot
   * of the current roster, since "how many of our students are placed" is a
   * question about now, not about a window.
   */
  async getPlacementAnalytics(startDate, endDate) {
    const students = await StudentProfile.findAll({
      include: [{ model: User, as: 'user', attributes: ['id'] }],
      attributes: ['placementStatus']
    });

    const selections = await Application.findAll({
      where: {
        status: 'selected',
        resultAt: { [Op.between]: [startDate, endDate] }
      },
      attributes: ['resultAt']
    });

    const dailyData = {};
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const key = current.toISOString().split('T')[0];
      dailyData[key] = { date: key, placed: 0 };
      current.setDate(current.getDate() + 1);
    }

    selections.forEach((application) => {
      if (!application.resultAt) return;
      const key = new Date(application.resultAt).toISOString().split('T')[0];
      if (dailyData[key]) dailyData[key].placed += 1;
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
