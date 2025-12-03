// server/src/controllers/analyticsController.js
const { User, Application, Job, Organization, StudentProfile } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const logger = require('../utils/logger');

class AnalyticsController {
  // TPO Analytics with advanced filtering
  async getTPOAnalytics(req, res, next) {
    try {
      const { user } = req;
      const {
        company,
        jobStatus,
        applicationStatus,
        placementStatus,
        branch,
        yearOfStudy,
        dateRange,
        search
      } = req.query;

      // Build date filter based on dateRange
      const getDateFilter = () => {
        const now = new Date();
        switch (dateRange) {
          case 'today':
            return { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { [Op.gte]: weekAgo };
          case 'month':
            return { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) };
          case 'quarter':
            const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            return { [Op.gte]: quarterStart };
          case 'year':
            return { [Op.gte]: new Date(now.getFullYear(), 0, 1) };
          default:
            return {};
        }
      };

      const dateFilter = getDateFilter();

      // Build application filters
      const applicationFilters = {
        createdAt: dateFilter
      };

      if (applicationStatus) {
        applicationFilters.status = applicationStatus;
      }

      // Build job filters
      const jobFilters = {};
      if (jobStatus) {
        jobFilters.status = jobStatus;
      }

      // Build organization filters
      const orgFilters = {
        id: user.organizationId // TPO can only see their organization's data
      };

      if (company) {
        orgFilters.id = company;
      }

      // Build student profile filters
      const studentFilters = {};
      if (branch) {
        studentFilters.branch = branch;
      }
      if (yearOfStudy) {
        studentFilters.yearOfStudy = parseInt(yearOfStudy);
      }
      if (placementStatus) {
        studentFilters.placementStatus = placementStatus;
      }

      // Build search filters
      const searchFilters = {};
      if (search) {
        searchFilters[Op.or] = [
          { '$student.firstName$': { [Op.iLike]: `%${search}%` } },
          { '$student.lastName$': { [Op.iLike]: `%${search}%` } },
          { '$student.email$': { [Op.iLike]: `%${search}%` } },
          { '$job.title$': { [Op.iLike]: `%${search}%` } },
          { '$job.organization.name$': { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Get student analytics
      const [totalStudents, placedStudents, studentsByBranch] = await Promise.all([
        User.count({
          where: {
            role: 'student',
            organizationId: user.organizationId,
            isActive: true
          }
        }),

        StudentProfile.count({
          where: {
            placementStatus: 'placed',
            ...studentFilters
          },
          include: [
            {
              model: User,
              as: 'user',
              where: {
                organizationId: user.organizationId,
                isActive: true
              },
              attributes: []
            }
          ]
        }),

        StudentProfile.findAll({
          attributes: [
            'branch',
            [fn('COUNT', col('StudentProfile.id')), 'total'],
            [fn('SUM', literal("CASE WHEN placement_status = 'placed' THEN 1 ELSE 0 END")), 'placed']
          ],
          where: studentFilters,
          include: [
            {
              model: User,
              as: 'user',
              where: {
                organizationId: user.organizationId,
                isActive: true
              },
              attributes: []
            }
          ],
          group: ['branch'],
          raw: true
        })
      ]);

      // Get application analytics
      const [totalApplications, applicationsByStatus, applicationsByCompany] = await Promise.all([
        Application.count({
          where: {
            ...applicationFilters,
            ...searchFilters
          },
          include: [
            {
              model: User,
              as: 'student',
              where: {
                organizationId: user.organizationId
              },
              include: studentFilters.branch || studentFilters.yearOfStudy ? [
                {
                  model: StudentProfile,
                  as: 'studentProfile',
                  where: studentFilters
                }
              ] : [],
              attributes: []
            },
            {
              model: Job,
              as: 'job',
              where: jobFilters,
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  where: company ? { id: company } : {},
                  attributes: []
                }
              ],
              attributes: []
            }
          ]
        }),

        Application.findAll({
          attributes: [
            'status',
            [fn('COUNT', col('Application.id')), 'count']
          ],
          where: {
            ...applicationFilters,
            ...searchFilters
          },
          include: [
            {
              model: User,
              as: 'student',
              where: {
                organizationId: user.organizationId
              },
              include: studentFilters.branch || studentFilters.yearOfStudy ? [
                {
                  model: StudentProfile,
                  as: 'studentProfile',
                  where: studentFilters
                }
              ] : [],
              attributes: []
            },
            {
              model: Job,
              as: 'job',
              where: jobFilters,
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  where: company ? { id: company } : {},
                  attributes: []
                }
              ],
              attributes: []
            }
          ],
          group: ['status'],
          raw: true
        }),

        Application.findAll({
          attributes: [
            [fn('COUNT', col('Application.id')), 'totalApplications'],
            [fn('SUM', literal("CASE WHEN status = 'selected' THEN 1 ELSE 0 END")), 'selected']
          ],
          where: {
            ...applicationFilters,
            ...searchFilters
          },
          include: [
            {
              model: User,
              as: 'student',
              where: {
                organizationId: user.organizationId
              },
              include: studentFilters.branch || studentFilters.yearOfStudy ? [
                {
                  model: StudentProfile,
                  as: 'studentProfile',
                  where: studentFilters
                }
              ] : [],
              attributes: []
            },
            {
              model: Job,
              as: 'job',
              where: jobFilters,
              include: [
                {
                  model: Organization,
                  as: 'organization',
                  where: company ? { id: company } : {},
                  attributes: ['id', 'name', 'logoUrl']
                }
              ],
              attributes: ['id', 'title']
            }
          ],
          group: ['job.organization.id', 'job.organization.name', 'job.organization.logoUrl'],
          raw: true
        })
      ]);

      // Get company analytics
      const companyAnalytics = await Organization.findAll({
        where: {
          type: 'company',
          ...(company ? { id: company } : {})
        },
        include: [
          {
            model: Job,
            as: 'jobs',
            where: jobFilters,
            required: false,
            include: [
              {
                model: Application,
                as: 'applications',
                where: {
                  ...applicationFilters,
                  ...searchFilters
                },
                required: false,
                include: [
                  {
                    model: User,
                    as: 'student',
                    where: {
                      organizationId: user.organizationId
                    },
                    include: studentFilters.branch || studentFilters.yearOfStudy ? [
                      {
                        model: StudentProfile,
                        as: 'studentProfile',
                        where: studentFilters
                      }
                    ] : [],
                    attributes: []
                  }
                ]
              }
            ]
          }
        ]
      });

      // Calculate placement rate
      const placementRate = totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;

      // Format branch-wise placement data
      const branchWisePlacement = studentsByBranch.map(branch => ({
        branch: branch.branch,
        total: parseInt(branch.total),
        placed: parseInt(branch.placed),
        rate: branch.total > 0 ? Math.round((branch.placed / branch.total) * 100) : 0
      }));

      // Format company analytics
      const detailedCompanyAnalytics = companyAnalytics.map(company => {
        const totalApps = company.jobs.reduce((sum, job) => sum + job.applications.length, 0);
        const selectedApps = company.jobs.reduce((sum, job) => 
          sum + job.applications.filter(app => app.status === 'selected').length, 0
        );
        const activeJobs = company.jobs.filter(job => job.status === 'active').length;
        
        return {
          id: company.id,
          name: company.name,
          logoUrl: company.logoUrl,
          industry: company.industry,
          totalApplications: totalApps,
          selected: selectedApps,
          successRate: totalApps > 0 ? Math.round((selectedApps / totalApps) * 100) : 0,
          activeJobs
        };
      }).sort((a, b) => b.totalApplications - a.totalApplications);

      // Get this month's applications
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const thisMonthApplications = await Application.count({
        where: {
          createdAt: { [Op.gte]: thisMonthStart },
          ...searchFilters
        },
        include: [
          {
            model: User,
            as: 'student',
            where: {
              organizationId: user.organizationId
            },
            attributes: []
          }
        ]
      });

      const analytics = {
        students: {
          total: totalStudents,
          activePercentage: 100 // Assuming all counted students are active
        },
        placements: {
          placed: placedStudents,
          placementRate,
          byBranch: branchWisePlacement
        },
        companies: {
          active: detailedCompanyAnalytics.filter(c => c.activeJobs > 0).length,
          total: detailedCompanyAnalytics.length,
          detailed: detailedCompanyAnalytics
        },
        applications: {
          total: totalApplications,
          thisMonth: thisMonthApplications,
          byStatus: applicationsByStatus.map(status => ({
            status: status.status,
            count: parseInt(status.count)
          }))
        }
      };

      res.json({
        message: 'TPO analytics retrieved successfully',
        analytics
      });
    } catch (error) {
      logger.error('Error in getTPOAnalytics', error);
      next(error);
    }
  }

  // Export TPO Analytics Data
  async exportTPOAnalytics(req, res, next) {
    try {
      const { user } = req;
      const { export: exportType } = req.query;

      // This would implement CSV/Excel export functionality
      // For now, we'll return a simple response
      
      res.json({
        message: `${exportType} export functionality would be implemented here`,
        exportType,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error in exportTPOAnalytics', error);
      next(error);
    }
  }

  // Student Analytics for TPO
  async getStudentAnalytics(req, res, next) {
    try {
      const { user } = req;
      const { page = 1, limit = 20, ...filters } = req.query;
      const offset = (page - 1) * limit;

      // Build filters similar to main analytics
      const whereClause = {
        organizationId: user.organizationId,
        role: 'student',
        isActive: true
      };

      const studentProfileFilters = {};
      if (filters.branch) studentProfileFilters.branch = filters.branch;
      if (filters.yearOfStudy) studentProfileFilters.yearOfStudy = parseInt(filters.yearOfStudy);
      if (filters.placementStatus) studentProfileFilters.placementStatus = filters.placementStatus;

      if (filters.search) {
        whereClause[Op.or] = [
          { firstName: { [Op.iLike]: `%${filters.search}%` } },
          { lastName: { [Op.iLike]: `%${filters.search}%` } },
          { email: { [Op.iLike]: `%${filters.search}%` } }
        ];
      }

      const { count, rows: students } = await User.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: StudentProfile,
            as: 'studentProfile',
            where: Object.keys(studentProfileFilters).length > 0 ? studentProfileFilters : undefined,
            required: Object.keys(studentProfileFilters).length > 0
          },
          {
            model: Application,
            as: 'applications',
            required: false,
            include: [
              {
                model: Job,
                as: 'job',
                attributes: ['id', 'title'],
                include: [
                  {
                    model: Organization,
                    as: 'organization',
                    attributes: ['id', 'name']
                  }
                ]
              }
            ]
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'Student analytics retrieved successfully',
        students,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalStudents: count,
          hasNextPage: page < Math.ceil(count / limit),
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      logger.error('Error in getStudentAnalytics', error);
      next(error);
    }
  }
}

module.exports = new AnalyticsController();
