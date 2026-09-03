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

      // Build application filters.
      //
      // Only constrain the date when there is actually a range. `dateRange`
      // falls through to `{}`, and assigning that to `createdAt` produced an
      // empty condition that matched no rows — so an unscoped request reported
      // zero applications while the real count was non-zero.
      const applicationFilters = {};
      if (Object.getOwnPropertySymbols(dateFilter).length > 0) {
        applicationFilters.createdAt = dateFilter;
      }

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
          // Raw column names: these models are `underscored: true`, and a
          // `$assoc.col$` reference is emitted into the SQL verbatim with no
          // attribute-to-field mapping, so `firstName` was a missing column.
          { '$student.first_name$': { [Op.iLike]: `%${search}%` } },
          { '$student.last_name$': { [Op.iLike]: `%${search}%` } },
          { '$student.email$': { [Op.iLike]: `%${search}%` } },
          { '$job.title$': { [Op.iLike]: `%${search}%` } },
          { '$job.organization.name$': { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Get student analytics
      const [totalStudents, placedStudents, studentsByBranch] = await Promise.all([
        // The denominator has to be the same population as the numerator and
        // the branch breakdown, which both count StudentProfile rows. Counting
        // User rows instead made a student with no profile deflate the
        // headline rate while the branch table stayed correct, so one screen
        // showed two different placement rates. Worse, it ignored
        // `studentFilters` — filtering by branch divided that branch's placed
        // count by every student in the institution.
        StudentProfile.count({
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
          ]
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
                  where: studentFilters,
                  // Filter only — selecting its columns inside a grouped
                  // aggregate makes Postgres demand them in the GROUP BY.
                  attributes: []
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
            // Qualified: this query joins `jobs`, which also has a `status`
            // column, so a bare reference is ambiguous and Postgres rejects it.
            [col('Application.status'), 'status'],
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
                  where: studentFilters,
                  // Filter only — selecting its columns inside a grouped
                  // aggregate makes Postgres demand them in the GROUP BY.
                  attributes: []
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
          group: ['Application.status'],
          raw: true
        }),

        Application.findAll({
          attributes: [
            [fn('COUNT', col('Application.id')), 'totalApplications'],
            [fn('SUM', literal(`CASE WHEN "Application"."status" = 'selected' THEN 1 ELSE 0 END`)), 'selected']
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
                  where: studentFilters,
                  // Filter only — selecting its columns inside a grouped
                  // aggregate makes Postgres demand them in the GROUP BY.
                  attributes: []
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
          // Written as explicit SQL rather than attribute paths. Sequelize
          // emits `group` entries verbatim, with no attribute-to-field
          // mapping, so 'job.organization.logoUrl' became a reference to a
          // "logoUrl" column that does not exist — the field is `logo_url`.
          // Postgres also requires every non-aggregated selected column in the
          // GROUP BY, hence job.id and job.title.
          group: [
            literal('"job"."id"'),
            literal('"job"."title"'),
            literal('"job->organization"."id"'),
            literal('"job->organization"."name"'),
            literal('"job->organization"."logo_url"')
          ],
          raw: true
        })
      ]);

      // The same search, re-expressed relative to the Organization root.
      //
      // A `$assoc.col$` path is resolved from whatever model the query starts
      // at. `searchFilters` is written for an Application-rooted query, so
      // reusing it here produced "missing FROM-clause entry for table student".
      const companySearchFilters = {};
      if (search) {
        const term = `%${search}%`;
        companySearchFilters[Op.or] = [
          { '$jobs.applications.student.first_name$': { [Op.iLike]: term } },
          { '$jobs.applications.student.last_name$': { [Op.iLike]: term } },
          { '$jobs.applications.student.email$': { [Op.iLike]: term } },
          { '$jobs.title$': { [Op.iLike]: term } }
        ];
      }

      // Get company analytics
      const companyAnalytics = await Organization.findAll({
        where: {
          type: 'company',
          ...(company ? { id: company } : {}),
          ...companySearchFilters
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
                where: applicationFilters,
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
                        where: studentFilters,
                        attributes: []
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
          },
          // Joined purely so the `$job.…$` arms of `searchFilters` have a
          // table to resolve against. Without it a search request failed with
          // "missing FROM-clause entry for table job". `required: false` keeps
          // it a LEFT JOIN so the count is unchanged when no search is active.
          {
            model: Job,
            as: 'job',
            required: false,
            include: [
              {
                model: Organization,
                as: 'organization',
                required: false,
                attributes: []
              }
            ],
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
  /**
   * Student placement roster as a CSV download.
   *
   * This used to answer with a JSON body saying the feature "would be
   * implemented here", which the client saved with a .csv extension — so the
   * export button produced a file that opened as a line of JSON.
   */
  async exportTPOAnalytics(req, res, next) {
    try {
      const { user } = req;
      const { branch, yearOfStudy, placementStatus } = req.query;

      const studentProfileFilters = {};
      if (branch) studentProfileFilters.branch = branch;
      if (yearOfStudy) studentProfileFilters.yearOfStudy = parseInt(yearOfStudy, 10);
      if (placementStatus) studentProfileFilters.placementStatus = placementStatus;

      const students = await User.findAll({
        where: {
          organizationId: user.organizationId,
          role: 'student',
          isActive: true
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
        include: [
          {
            model: StudentProfile,
            as: 'studentProfile',
            required: Object.keys(studentProfileFilters).length > 0,
            where: Object.keys(studentProfileFilters).length > 0 ? studentProfileFilters : undefined
          },
          {
            model: Application,
            as: 'applications',
            required: false,
            attributes: ['id', 'status']
          }
        ],
        order: [['firstName', 'ASC']]
      });

      const columns = [
        'Student ID', 'First name', 'Last name', 'Email', 'Phone',
        'Branch', 'Year of study', 'CGPA', 'Placement status',
        'Applications', 'Selected'
      ];

      // RFC 4180 quoting: wrap every field and double any embedded quote. A
      // name containing a comma would otherwise shift every later column.
      const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

      const rows = students.map((student) => {
        const profile = student.studentProfile;
        const applications = student.applications || [];
        return [
          student.id,
          student.firstName,
          student.lastName,
          student.email,
          student.phone,
          profile?.branch,
          profile?.yearOfStudy,
          profile?.cgpa,
          profile?.placementStatus,
          applications.length,
          applications.filter((a) => a.status === 'selected').length
        ].map(cell).join(',');
      });

      const csv = [columns.map(cell).join(','), ...rows].join('\r\n');
      const filename = `placement-report-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // A BOM so Excel opens the file as UTF-8 rather than mangling any
      // non-ASCII name in it.
      res.send(`\uFEFF${csv}`);
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
        // The default scope selects every column, which put each student's
        // bcrypt hash in the response body.
        attributes: { exclude: ['passwordHash'] },
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
