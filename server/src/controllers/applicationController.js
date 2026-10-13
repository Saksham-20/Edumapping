// server/src/controllers/applicationController.js
const { Application, Job, User, StudentProfile, Organization, AuditLog } = require('../models');
const { validationResult } = require('express-validator');
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { checkEligibility } = require('../utils/eligibility');
const { checkPolicyForStudent } = require('../utils/placementPolicy');
const models = require('../models');
const { syncPlacementStatus: sharedSyncPlacementStatus } = require('../utils/placementStatus');

/**
 * Keep `student_profiles.placement_status` in step with the student's
 * applications.
 *
 * Nothing used to write this column outside the seeders, while every placement
 * figure the product reports reads it — the admin and TPO dashboards, the TPO
 * analytics `placements.placed` and `byBranch`, the placement rate, and the CSV
 * export. A placement cell could run a whole drive, mark sixty students
 * selected, and still see "0 placed, 0% placement rate", which is the single
 * number they are judged on.
 *
 * Derived from the applications rather than set as a one-way flag, so undoing a
 * selection (a rejection after the fact, a withdrawal) correctly takes the
 * student back to unplaced. `deferred` is a manual state a TPO sets for
 * students sitting out the season, so it is never overwritten here.
 */
// Placement status has one definition, shared with the offer flow. It used to
// be computed here from selected applications alone, which disagreed with the
// offer lifecycle: a revoked offer leaves its application marked `selected`, so
// this would have put the student back to placed on the next status change.
const syncPlacementStatus = (studentId) => sharedSyncPlacementStatus(studentId, models);

/**
 * Is moving an application from `from` to `to` allowed for this actor?
 * Returns an error message, or null when the change is fine.
 *
 * A withdrawal is the student's decision and is final: a recruiter used to be
 * able to set a withdrawn application straight to `selected`, which marked a
 * student placed in a job they had walked away from. Staff may otherwise
 * correct a stage in either direction — a mis-click on "rejected" has to be
 * undoable — but they cannot withdraw on the student's behalf.
 */
const statusChangeError = (from, to, role) => {
  if (from === to) return null;
  if (from === 'withdrawn') {
    return 'The student withdrew this application, so it cannot be moved to another stage.';
  }
  if (to === 'withdrawn' && role !== 'student') {
    return 'Only the student can withdraw an application.';
  }
  if (role === 'student' && ['selected', 'rejected'].includes(from)) {
    return 'This application already has a result. Decline the offer instead if you no longer want it.';
  }
  return null;
};

// Profile fields that are the placement cell's business, not a recruiter's.
// Applying shares a student's profile with the company; it does not share the
// cell's disciplinary notes about them.
const CELL_ONLY_PROFILE_FIELDS = [
  'placementSanction',
  'sanctionReason',
  'sanctionUntil',
  'sanctionedBy',
  'sanctionedAt',
  'verificationNotes',
  'verifiedBy',
  'isEligible'
];

const forViewer = (req, application) => {
  const data = typeof application?.toJSON === 'function' ? application.toJSON() : application;
  if (req.user.role === 'recruiter' && data?.student?.studentProfile) {
    for (const field of CELL_ONLY_PROFILE_FIELDS) delete data.student.studentProfile[field];
  }
  return data;
};

/**
 * The last moment an application is accepted for a deadline stored as a date.
 *
 * `application_deadline` is a DATEONLY. `new Date('2026-10-22')` is midnight
 * UTC — 05:30 IST on the 22nd — so a drive that says "apply by 22 October"
 * stopped taking applications before students woke up on the last day. The
 * drive calendar already treats the deadline as 23:59 IST; this matches it.
 */
/**
 * The deadline's calendar day in IST, as YYYY-MM-DD, whether it arrives as a
 * DATEONLY string ('2026-10-22'), an ISO timestamp, or a Date object (a
 * timestamp column, or a row built in code). A timestamp is read as the IST
 * day it falls on, so '2026-10-21T20:00:00Z' is the 22nd.
 */
const deadlineDay = (deadline) => {
  if (!deadline) return null;
  if (typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) return deadline;
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const deadlineCutoff = (deadline) => {
  const day = deadlineDay(deadline);
  if (!day) return null;
  const cutoff = new Date(`${day}T23:59:59.999+05:30`);
  return Number.isNaN(cutoff.getTime()) ? null : cutoff;
};

const formatDeadline = (deadline) =>
  new Date(`${deadlineDay(deadline)}T12:00:00+05:30`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

// Plain names for the profile fields an application needs, so "Profile
// Incomplete" can say exactly what is missing instead of "all required
// details".
const PROFILE_FIELD_LABELS = {
  firstName: 'first name',
  lastName: 'last name',
  email: 'email',
  phone: 'phone number',
  course: 'course',
  branch: 'branch',
  yearOfStudy: 'year of study',
  graduationYear: 'graduation year',
  cgpa: 'CGPA',
  skills: 'skills',
  bio: 'a short bio'
};

/** Clamp `page`/`limit` query values: `?page=abc` used to reach SQL as NaN. */
const paging = (query, { defaultLimit = 10, maxLimit = 100 } = {}) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { page, limit, offset: (page - 1) * limit };
};

// Staff of a school or college who are not the placement cell. They may see
// their own institution's students' applications, never anyone else's — they
// used to fall through every role branch with no filter at all, so a school
// teacher could list every college's applicants with full academic profiles.
const INSTITUTION_VIEWER_ROLES = ['tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'];

class ApplicationController {
  async submitApplication(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
      }

      const { jobId, coverLetter } = req.body;
      const studentId = req.user.id;

      // Check if job exists and is active
      const job = await Job.findByPk(jobId, {
        include: [{ model: Organization, as: 'organization' }]
      });

      if (!job) {
        return res.status(404).json({
          error: 'Job Not Found',
          message: 'Job not found'
        });
      }

      if (job.status !== 'active') {
        return res.status(400).json({
          error: 'Job Not Available',
          message: 'This job is no longer accepting applications'
        });
      }

      // Closed at the end of the deadline day in IST, not at UTC midnight.
      const cutoff = deadlineCutoff(job.applicationDeadline);
      if (cutoff && new Date() > cutoff) {
        return res.status(400).json({
          error: 'Deadline Passed',
          message: `Applications for this drive closed on ${formatDeadline(job.applicationDeadline)}.`
        });
      }

      // Check if user already applied
      const existingApplication = await Application.findOne({
        where: { jobId, studentId }
      });

      // A student who withdrew may change their mind while the drive is still
      // open; the old row is reused so there is still one application per job.
      if (existingApplication && existingApplication.status !== 'withdrawn') {
        return res.status(409).json({
          error: 'Already Applied',
          message: 'You have already applied for this job'
        });
      }

      // Check eligibility.
      //
      // This used to read `minCGPA` / `allowedBranches` / `graduationYear`
      // directly off the JSON, but every job created outside the posting form
      // stores those keys in snake_case — so the criteria were saved, shown to
      // students, and then never actually enforced. The graduation-year arm was
      // additionally comparing a scalar against what is normally an array of
      // accepted batches, so it could only ever have rejected everyone.
      const studentProfile = await StudentProfile.findOne({ where: { userId: studentId } });

      // A sanction is checked before the job's own criteria: being barred from
      // placements is not a fact about this posting, and telling the student
      // they fail a CGPA bar when the real reason is a debarment would be a
      // lie. Applications already in flight are untouched — the bar is on
      // taking something new.
      if (studentProfile?.isBarredFromApplying()) {
        return res.status(403).json({
          error: 'Placement Participation Suspended',
          message:
            studentProfile.placementSanction === 'removed'
              ? 'You have been removed from placements for this season. Contact your placement cell.'
              : 'You are currently blocked from applying to new roles. Contact your placement cell.',
          reason: studentProfile.sanctionReason || null,
          until: studentProfile.sanctionUntil || null
        });
      }

      // The institution's placement policy — offer caps, dream tiers, verified
      // profile — before the job's own criteria, for the same reason as the
      // sanction: it is about the student's season, not this posting.
      const policy = await checkPolicyForStudent(models, {
        studentId,
        organizationId: req.user.organizationId,
        job,
        profile: studentProfile
      });
      if (!policy.allowed) {
        return res.status(403).json({
          error: 'Placement Policy',
          message: policy.reasons[0],
          reasons: policy.reasons
        });
      }

      const { eligible, reasons } = checkEligibility(job.eligibilityCriteria, studentProfile);
      if (!eligible) {
        return res.status(400).json({
          error: 'Eligibility Criteria Not Met',
          message: reasons[0],
          reasons
        });
      }

      // Enforce completed profile & generated resume before applying
      if (!studentProfile) {
        return res.status(400).json({
          error: 'Profile Incomplete',
          message: 'Please complete your student profile before applying for jobs'
        });
      }

      const userRecord = await User.findByPk(studentId);
      if (!userRecord) {
        return res.status(400).json({
          error: 'User Not Found',
          message: 'User account not found'
        });
      }

      const missingUserFields = [];
      if (!userRecord.firstName) missingUserFields.push('firstName');
      if (!userRecord.lastName) missingUserFields.push('lastName');
      if (!userRecord.email) missingUserFields.push('email');
      if (!userRecord.phone) missingUserFields.push('phone');

      const requiredProfileFields = [
        'course',
        'branch',
        'yearOfStudy',
        'graduationYear',
        'cgpa',
        'skills',
        'bio'
      ];

      const missingProfileFields = [];
      requiredProfileFields.forEach((field) => {
        const value = studentProfile[field];
        const isCompleted =
          value && (Array.isArray(value) ? value.length > 0 : true);
        if (!isCompleted) {
          missingProfileFields.push(field);
        }
      });

      if (missingUserFields.length > 0 || missingProfileFields.length > 0) {
        const missing = [...missingUserFields, ...missingProfileFields].map(
          (f) => PROFILE_FIELD_LABELS[f] || f
        );
        return res.status(400).json({
          error: 'Profile Incomplete',
          message: `Add your ${missing.join(', ')} on your profile, then apply again.`,
          details: {
            missingUserFields,
            missingProfileFields
          }
        });
      }

      if (!studentProfile.resumeUrl) {
        return res.status(400).json({
          error: 'Resume Not Generated',
          message:
            'You need a resume before you can apply. Generate one from your profile or upload your own on the Resume page.'
        });
      }

      // Create application (always use resume from student profile).
      //
      // Two taps on "Apply" race past the duplicate check above; the unique
      // (job_id, student_id) index stops the second insert, and that is
      // answered as the same "already applied" rather than a database error.
      let application;
      try {
        application = existingApplication
        ? await existingApplication.update({
            coverLetter,
            resumeUrl: studentProfile.resumeUrl,
            status: 'applied',
            appliedAt: new Date(),
            shortlistedAt: null,
            interviewedAt: null,
            resultAt: null,
            feedback: null
          })
        : await Application.create({
            jobId,
            studentId,
            coverLetter,
            resumeUrl: studentProfile.resumeUrl,
            status: 'applied'
          });
      } catch (createError) {
        if (createError.name === 'SequelizeUniqueConstraintError') {
          return res.status(409).json({
            error: 'Already Applied',
            message: 'You have already applied for this job'
          });
        }
        throw createError;
      }

      // Get application with details
      const applicationWithDetails = await Application.findByPk(application.id, {
        include: [
          {
            model: Job,
            as: 'job',
            include: [{ model: Organization, as: 'organization' }]
          },
          {
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      // Send notification to recruiters
      try {
        await notificationService.notifyNewApplication(application.id);
      } catch (notifError) {
        logger.error('Notification error', notifError, { applicationId: application.id });
      }

      res.status(201).json({
        message: 'Application submitted successfully',
        application: applicationWithDetails
      });
    } catch (error) {
      next(error);
    }
  }

  async getApplications(req, res, next) {
    try {
      const { status, jobId, studentId, search } = req.query;
      const { page, limit, offset } = paging(req.query);
      const whereClause = {};

      // Apply filters
      if (status) whereClause.status = status;
      // Parsed: a non-numeric jobId reached Postgres and came back as a 500.
      if (jobId) whereClause.jobId = parseInt(jobId, 10) || -1;
      if (studentId) whereClause.studentId = parseInt(studentId, 10) || -1;

      // Role-based filtering
      if (req.user.role === 'student') {
        whereClause.studentId = req.user.id;
      } else if (req.user.role === 'recruiter') {
        // Only show applications for jobs from recruiter's organization
        // This is handled in the include options below
      } else if (req.user.role === 'tpo') {
        // TPO users can only see applications from students in their organization
        // This is handled in the include options below
      }

      const includeOptions = [
        {
          model: Job,
          as: 'job',
          include: [{ model: Organization, as: 'organization' }]
        },
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId'],
          include: [{ model: StudentProfile, as: 'studentProfile' }]
        }
      ];

      // Add organization filter for recruiters
      if (req.user.role === 'recruiter') {
        includeOptions[0].where = { organizationId: req.user.organizationId };
      }

      // Institution staff — the placement cell, and school staff — see their
      // own institution's students only. Any other role sees nothing.
      if (INSTITUTION_VIEWER_ROLES.includes(req.user.role)) {
        // Get all students in the TPO's organization
        const studentsInOrg = await User.findAll({
          where: { 
            role: 'student',
            organizationId: req.user.organizationId || -1
          },
          attributes: ['id']
        });
        
        const studentIds = studentsInOrg.map(student => student.id);
        
        // Only show applications from these students
        whereClause.studentId = { [Op.in]: studentIds };
      } else if (!['student', 'recruiter', 'admin'].includes(req.user.role)) {
        whereClause.id = -1;
      }

      // Free-text search across the joined job title and the applicant's name.
      // Written as `$association.column$` references on the top-level where so
      // it composes with the role scoping above instead of fighting the
      // recruiter branch's `includeOptions[0].where`.
      if (search) {
        const term = `%${search}%`;
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          {
            [Op.or]: [
              { '$job.title$': { [Op.iLike]: term } },
              { '$job.organization.name$': { [Op.iLike]: term } },
              // Raw column names, not model attributes: these models are
              // `underscored: true`, and a `$assoc.col$` reference is emitted
              // into the SQL verbatim without attribute-to-field mapping.
              { '$student.first_name$': { [Op.iLike]: term } },
              { '$student.last_name$': { [Op.iLike]: term } }
            ]
          }
        ];
      }

      const { count, rows: applications } = await Application.findAndCountAll({
        where: whereClause,
        include: includeOptions,
        limit,
        offset,
        // A `$association.column$` reference can only resolve against a real
        // JOIN. Sequelize's default paging strategy pushes the limit into a
        // subquery over the base table alone, where those columns do not
        // exist — so searching has to opt out of it. Safe here because every
        // include is a belongsTo, so the join cannot multiply rows and inflate
        // the count.
        subQuery: search ? false : undefined,
        order: [['createdAt', 'DESC']]
      });

      // Debug logging
      logger.debug('Applications Query Debug', {
        userId: req.user.id,
        userRole: req.user.role,
        userOrgId: req.user.organizationId,
        count,
        applicationsCount: applications.length,
        limit,
        offset
      });

      // Ensure pagination object has all required fields
      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        totalApplications: count,
        hasMore: offset + applications.length < count,
        limit
      };

      res.json({
        message: 'Applications retrieved successfully',
        applications: applications.map((a) => forViewer(req, a)),
        pagination
      });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationById(req, res, next) {
    try {
      const { id } = req.params;

      const application = await Application.findByPk(id, {
        include: [
          {
            model: Job,
            as: 'job',
            include: [{ model: Organization, as: 'organization' }]
          },
          {
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'organizationId'],
            include: [{ model: StudentProfile, as: 'studentProfile' }]
          }
        ]
      });

      if (!application) {
        return res.status(404).json({
          error: 'Application Not Found',
          message: 'Application not found'
        });
      }

      // Check permissions with better debugging
      let canView = false;
      
      if (req.user.role === 'admin') {
        canView = true;
      } else if (application.studentId === req.user.id) {
        // Students can always view their own applications
        canView = true;
      } else if (req.user.role === 'recruiter') {
        // Recruiters can view applications for jobs from their organization
        canView = application.job && application.job.organizationId === req.user.organizationId;
      } else if (INSTITUTION_VIEWER_ROLES.includes(req.user.role)) {
        // Institution staff can only view applications from their own students
        // — the same scope the list endpoint applies.
        canView = Boolean(application.student && req.user.organizationId &&
          application.student.organizationId === req.user.organizationId);
      }

      // Debug logging for permission issues
      logger.debug('Permission Check Debug', {
        userId: req.user.id,
        userRole: req.user.role,
        userOrgId: req.user.organizationId,
        applicationId: application.id,
        studentId: application.studentId,
        studentOrgId: application.student?.organizationId,
        jobOrgId: application.job?.organizationId,
        canView
      });

      if (!canView) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You do not have permission to view this application'
        });
      }

      res.json({
        message: 'Application retrieved successfully',
        application: forViewer(req, application)
      });
    } catch (error) {
      next(error);
    }
  }

  async updateApplicationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, feedback } = req.body;

      const validStatuses = ['applied', 'screening', 'shortlisted', 'interviewed', 'selected', 'rejected', 'withdrawn'];
      
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid Status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      const application = await Application.findByPk(id, {
        include: [
          { model: Job, as: 'job' },
          { model: User, as: 'student' }
        ]
      });

      if (!application) {
        return res.status(404).json({
          error: 'Application Not Found',
          message: 'Application not found'
        });
      }

      // Check permissions
      const canUpdate = req.user.role === 'admin' ||
                       (req.user.role === 'recruiter' && 
                        application.job.organizationId === req.user.organizationId) ||
                       (req.user.role === 'tpo' && 
                        application.student.organizationId === req.user.organizationId) ||
                       (req.user.role === 'student' && 
                        application.studentId === req.user.id && status === 'withdrawn');

      if (!canUpdate) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You do not have permission to update this application'
        });
      }

      const transitionError = statusChangeError(application.status, status, req.user.role);
      if (transitionError) {
        return res.status(409).json({ error: 'Invalid Status Change', message: transitionError });
      }

      // Update application with timestamp
      const updateData = { status, feedback };
      const now = new Date();

      switch (status) {
        case 'shortlisted':
          updateData.shortlistedAt = now;
          break;
        case 'interviewed':
          updateData.interviewedAt = now;
          break;
        case 'selected':
        case 'rejected':
          updateData.resultAt = now;
          break;
      }

      await application.update(updateData);

      // A selection (or the reversal of one) changes whether this student
      // counts as placed.
      try {
        await syncPlacementStatus(application.studentId);
      } catch (placementError) {
        logger.error('Failed to sync placement status', placementError, {
          applicationId: application.id,
          studentId: application.studentId
        });
      }

      // Send notification to student
      try {
        await notificationService.notifyApplicationStatusUpdate(application.id, status);
      } catch (notifError) {
        logger.error('Notification error', notifError, { applicationId: application.id, status });
      }

      res.json({
        message: 'Application status updated successfully',
        application: {
          id: application.id,
          status: application.status,
          feedback: application.feedback
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async withdrawApplication(req, res, next) {
    try {
      const { id } = req.params;

      const application = await Application.findByPk(id);

      if (!application) {
        return res.status(404).json({
          error: 'Application Not Found',
          message: 'Application not found'
        });
      }

      // Check if user owns the application
      if (application.studentId !== req.user.id) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only withdraw your own applications'
        });
      }

      if (application.status === 'withdrawn') {
        return res.status(409).json({
          error: 'Already Withdrawn',
          message: 'You have already withdrawn this application.'
        });
      }

      // Check if application can be withdrawn
      if (['selected', 'rejected'].includes(application.status)) {
        return res.status(400).json({
          error: 'Cannot Withdraw',
          message:
            application.status === 'selected'
              ? 'You were selected for this job, so the application can no longer be withdrawn. Decline the offer on the Offers page instead.'
              : 'This application already has a result, so it can no longer be withdrawn.'
        });
      }

      await application.update({ status: 'withdrawn' });

      res.json({
        message: 'Application withdrawn successfully',
        application: {
          id: application.id,
          status: application.status
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationStats(req, res, next) {
    try {
      const { jobId, organizationId } = req.query;
      const whereClause = {};

      if (req.user.role === 'student') {
        whereClause.studentId = req.user.id;
      } else if (req.user.role === 'recruiter') {
        // Get stats for recruiter's organization jobs
        const jobs = await Job.findAll({
          where: { organizationId: req.user.organizationId },
          attributes: ['id']
        });
        const jobIds = jobs.map(job => job.id);
        whereClause.jobId = { [Op.in]: jobIds };
      } else if (INSTITUTION_VIEWER_ROLES.includes(req.user.role)) {
        // Was unscoped for every role but student and recruiter: a TPO's
        // dashboard counted every institution's applications, and the
        // "recent" list named other colleges' students.
        const students = await User.findAll({
          where: { role: 'student', organizationId: req.user.organizationId || -1 },
          attributes: ['id']
        });
        whereClause.studentId = { [Op.in]: students.map((s) => s.id) };
      } else if (req.user.role !== 'admin') {
        whereClause.id = -1;
      }

      // Narrow within the scope above, never widen it: a recruiter passing
      // another company's jobId must not get that job's numbers.
      if (jobId) {
        whereClause[Op.and] = [...(whereClause[Op.and] || []), { jobId: parseInt(jobId, 10) || -1 }];
      }

      const stats = await Application.findAll({
        where: whereClause,
        attributes: [
          'status',
          [Application.sequelize.fn('COUNT', Application.sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      // Get recent applications
      const recentApplications = await Application.findAll({
        where: whereClause,
        include: [
          {
            model: Job,
            as: 'job',
            attributes: ['id', 'title'],
            include: [{ 
              model: Organization, 
              as: 'organization',
              attributes: ['id', 'name']
            }]
          },
          {
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName']
          }
        ],
        limit: 5,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'Application statistics retrieved successfully',
        stats: {
          byStatus: stats,
          recent: recentApplications
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolve a pasted list of roll numbers or email addresses into applications
   * for one job, and optionally move them all to a new status.
   *
   * This is the shape placement work actually arrives in: the recruiter replies
   * with an Excel column of roll numbers, and the officer previously had to find
   * and click each row. Identifiers are matched against the roll number on the
   * student profile and against the account email, both case-insensitively.
   *
   * `dryRun` returns the same report without writing, so the caller can show
   * exactly who matched — and, more importantly, who did not — before anything
   * changes. Unmatched input is never silently dropped: an identifier that names
   * nobody, and a student who exists but never applied to this job, are reported
   * separately, because they mean different things to the person pasting.
   */
  async bulkUpdateByIdentifier(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
      }

      const { jobId } = req.params;
      const { identifiers, status, feedback, dryRun } = req.body;

      const job = await Job.findByPk(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job Not Found', message: 'Job not found' });
      }
      // A recruiter may only touch their own organisation's postings. TPOs and
      // admins are scoped below, by student, the same way the id-based bulk
      // update scopes them.
      if (req.user.role === 'recruiter' && job.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only update applications for your own organization\'s jobs'
        });
      }

      // Normalise once. Pasted columns arrive with stray whitespace, blank
      // lines and duplicates, and the same student may be named twice.
      const cleaned = [...new Set(
        identifiers.map((raw) => String(raw).trim()).filter(Boolean)
      )];
      if (cleaned.length === 0) {
        return res.status(400).json({
          error: 'Invalid Data',
          message: 'Provide at least one roll number or email address'
        });
      }
      const lowered = cleaned.map((v) => v.toLowerCase());

      const candidates = await User.findAll({
        where: {
          role: 'student',
          [Op.or]: [
            sequelizeWhere(fn('lower', col('User.email')), { [Op.in]: lowered }),
            sequelizeWhere(fn('lower', col('studentProfile.student_id')), { [Op.in]: lowered })
          ]
        },
        include: [{ model: StudentProfile, as: 'studentProfile', required: false }],
        attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId']
      });

      // A TPO acts for their own institution only.
      const inScope = req.user.role === 'tpo'
        ? candidates.filter((c) => c.organizationId === req.user.organizationId)
        : candidates;

      const byIdentifier = new Map();
      for (const user of inScope) {
        if (user.email) byIdentifier.set(user.email.toLowerCase(), user);
        const roll = user.studentProfile?.studentId;
        if (roll) byIdentifier.set(String(roll).toLowerCase(), user);
      }

      const applications = await Application.findAll({
        where: { jobId, studentId: { [Op.in]: inScope.map((u) => u.id) } },
        attributes: ['id', 'studentId', 'status']
      });
      const appByStudent = new Map(applications.map((a) => [a.studentId, a]));

      if (status === 'withdrawn') {
        return res.status(409).json({
          error: 'Invalid Status Change',
          message: 'Only the student can withdraw an application.'
        });
      }

      const matched = [];
      const notApplied = [];
      const unknown = [];
      const withdrawn = [];
      for (const identifier of cleaned) {
        const user = byIdentifier.get(identifier.toLowerCase());
        if (!user) { unknown.push(identifier); continue; }
        const application = appByStudent.get(user.id);
        const who = {
          identifier,
          studentId: user.id,
          name: [user.firstName, user.lastName].filter(Boolean).join(' '),
          email: user.email
        };
        if (!application) { notApplied.push(who); continue; }
        if (application.status === 'withdrawn') { withdrawn.push(who); continue; }
        matched.push({ ...who, applicationId: application.id, currentStatus: application.status });
      }

      const report = {
        requested: cleaned.length,
        matched: matched.length,
        notApplied: notApplied.length,
        unknown: unknown.length,
        withdrawn: withdrawn.length,
        details: { matched, notApplied, unknown, withdrawn }
      };

      if (dryRun) {
        return res.json({ message: 'Preview only — nothing was changed', dryRun: true, ...report });
      }

      if (matched.length > 0) {
        const now = new Date();
        const updateData = { status };
        if (feedback !== undefined) updateData.feedback = feedback;
        if (status === 'shortlisted') updateData.shortlistedAt = now;
        if (status === 'interviewed') updateData.interviewedAt = now;
        if (status === 'selected' || status === 'rejected') updateData.resultAt = now;

        await Application.update(updateData, {
          where: { id: { [Op.in]: matched.map((m) => m.applicationId) } }
        });

        // Same follow-through as the id-based bulk update: tell each student,
        // and re-derive placement status, which only 'selected' can change.
        for (const m of matched) {
          notificationService
            .notifyApplicationStatusUpdate(m.applicationId, status)
            .catch((err) => logger.error('Bulk status notification failed', err));
          syncPlacementStatus(m.studentId).catch((err) =>
            logger.error('Placement sync failed after bulk update', err)
          );
        }

        AuditLog.create({
          userId: req.user.id,
          action: 'application_bulk_status_by_identifier',
          entityType: 'job',
          entityId: parseInt(jobId, 10),
          newValues: { status, applicationIds: matched.map((m) => m.applicationId) },
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent')
        }).catch((err) => logger.error('Audit log failed', err));
      }

      res.json({ message: `${matched.length} application(s) moved to ${status}`, ...report });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateApplications(req, res, next) {
    try {
      const { status, feedback } = req.body;
      // Whole numbers only: a stray string id reached Postgres and came back
      // as a 500.
      const applicationIds = Array.isArray(req.body.applicationIds)
        ? [...new Set(req.body.applicationIds.map((v) => parseInt(v, 10)).filter((v) => Number.isInteger(v) && v > 0))]
        : [];

      if (applicationIds.length === 0) {
        return res.status(400).json({
          error: 'Invalid Data',
          message: 'Select at least one application to update.'
        });
      }

      const validStatuses = ['screening', 'shortlisted', 'interviewed', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid Status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Check permissions - recruiters, TPOs, and admins can bulk update
      if (!['recruiter', 'admin', 'tpo'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'Only recruiters, TPOs, and admins can perform bulk updates'
        });
      }

      if (status === 'withdrawn') {
        return res.status(409).json({
          error: 'Invalid Status Change',
          message: 'Only the student can withdraw an application.'
        });
      }

      // Withdrawn applications are the student's final word and are skipped.
      const whereClause = { id: { [Op.in]: applicationIds }, status: { [Op.ne]: 'withdrawn' } };

      // For recruiters, ensure they only update applications from their organization's jobs
      if (req.user.role === 'recruiter') {
        const jobs = await Job.findAll({
          where: { organizationId: req.user.organizationId },
          attributes: ['id']
        });
        const jobIds = jobs.map(job => job.id);
        whereClause.jobId = { [Op.in]: jobIds };
      }

      // For TPOs, ensure they only update applications from students in their university
      if (req.user.role === 'tpo') {
        const students = await User.findAll({
          where: { 
            organizationId: req.user.organizationId,
            role: 'student'
          },
          attributes: ['id']
        });
        const studentIds = students.map(student => student.id);
        whereClause.studentId = { [Op.in]: studentIds };
      }

      const updateData = { status, feedback };
      const now = new Date();

      switch (status) {
        case 'shortlisted':
          updateData.shortlistedAt = now;
          break;
        case 'interviewed':
          updateData.interviewedAt = now;
          break;
        case 'selected':
        case 'rejected':
          updateData.resultAt = now;
          break;
      }

      // Read the affected rows before updating: the UPDATE returns only a
      // count, and both the notifications and the placement sync below need to
      // know which students were actually touched (the scoping above may have
      // excluded some of the requested ids).
      const affected = await Application.findAll({
        where: whereClause,
        attributes: ['id', 'studentId']
      });

      // Nothing the caller may touch: say so, rather than answering 200 with
      // "0 applications updated" as if the request had simply been a no-op.
      if (affected.length === 0) {
        const anyExist = await Application.count({ where: { id: { [Op.in]: applicationIds } } });
        return res.status(anyExist ? 403 : 404).json({
          error: anyExist ? 'Access Forbidden' : 'Applications Not Found',
          message: anyExist
            ? 'None of these applications can be updated by you: they belong to another organisation, or the students withdrew them.'
            : 'None of these applications exist. Refresh the page and try again.'
        });
      }

      const [updatedCount] = await Application.update(updateData, {
        where: whereClause
      });

      // Notify each student. The single-row path has always done this, so
      // shortlisting one student at a time told them and shortlisting two
      // hundred at once told none of them — the larger the action, the quieter
      // it was. Failures are logged, never fatal to the update that succeeded.
      await Promise.allSettled(
        affected.map((application) =>
          notificationService
            .notifyApplicationStatusUpdate(application.id, status)
            .catch((notifError) =>
              logger.error('Bulk notification error', notifError, {
                applicationId: application.id,
                status
              })
            )
        )
      );

      // A bulk rejection can take a previously selected student back to
      // unplaced, so placement status has to be recomputed here too.
      const studentIds = [...new Set(affected.map((a) => a.studentId))];
      await Promise.allSettled(
        studentIds.map((studentId) =>
          syncPlacementStatus(studentId).catch((placementError) =>
            logger.error('Failed to sync placement status', placementError, { studentId })
          )
        )
      );

      res.json({
        message: `${updatedCount} application${updatedCount === 1 ? '' : 's'} updated${
          updatedCount < applicationIds.length
            ? `; ${applicationIds.length - updatedCount} skipped (withdrawn, or not yours to change)`
            : ''
        }`,
        updatedCount,
        status
      });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationsByJob(req, res, next) {
    try {
      const { jobId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Check if job exists and user has permission
      const job = await Job.findByPk(jobId);
      if (!job) {
        return res.status(404).json({
          error: 'Job Not Found',
          message: 'Job not found'
        });
      }

      // A TPO sees this job's applicants from their own institution only — a
      // posting is open to every college, and its applicant list is not.
      const canView = req.user.role === 'admin' ||
                     (req.user.role === 'recruiter' &&
                      job.organizationId === req.user.organizationId) ||
                     (req.user.role === 'tpo' && Boolean(req.user.organizationId));

      if (!canView) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You do not have permission to view these applications'
        });
      }

      const whereClause = { jobId };
      if (status) whereClause.status = status;

      const { count, rows: applications } = await Application.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId'],
            ...(req.user.role === 'tpo' ? { where: { organizationId: req.user.organizationId } } : {}),
            include: [{ model: StudentProfile, as: 'studentProfile' }]
          }
        ],
        distinct: true,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'Job applications retrieved successfully',
        applications: applications.map((a) => forViewer(req, a)),
        job: {
          id: job.id,
          title: job.title
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalApplications: count,
          hasMore: offset + applications.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ApplicationController();