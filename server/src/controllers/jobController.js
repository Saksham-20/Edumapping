// server/src/controllers/jobController.js
const { Job, Organization, User, Application, Assessment, StudentProfile, AuditLog } = require('../models');
const { validationResult } = require('express-validator');
const { Op, cast, col, where } = require('sequelize');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');
const { checkEligibility, describeEligibility } = require('../utils/eligibility');
const { checkPolicyForStudent } = require('../utils/placementPolicy');
const models = require('../models');
const {
  companyIdsRecruitingAt,
  studentVisibleJobWhere,
  canStudentSeeJob,
  isJobScopedViewer,
  jobAudienceOrganizationIds,
  tpoUserIdsFor
} = require('../services/recruiterAccessService');

/**
 * Tell the placement cells that can review this posting that it is waiting
 * for them. Recruiters submitted drives into a queue nobody was told about.
 * Fire-and-forget: called after the response.
 */
async function notifyReviewersOfPendingJob(job) {
  try {
    const institutions = (await jobAudienceOrganizationIds(job)).filter((id) => id !== job.organizationId);
    const tpoIds = await tpoUserIdsFor(institutions);
    await Promise.all(
      tpoIds.map((userId) =>
        notificationService.createNotification(
          userId,
          'Drive waiting for your approval',
          `${job.title} needs the placement cell's review before students can see it.`,
          'system_alert',
          { jobId: job.id, action: 'review' },
          'high'
        )
      )
    );
  } catch (err) {
    logger.error('Review-queue notification failed', err, { jobId: job.id });
  }
}

// Who may act on a posting's contents and see who applied: the organization
// that owns it (its recruiters, or a TPO who posted for their own college) and
// a platform admin.
const POSTING_MANAGER_ROLES = ['recruiter', 'tpo'];
const INSTITUTION_STAFF_ROLES = ['tpo', 'principal', 'teacher', 'school_admin', 'career_counselor'];

// A job students may see. Anything else — draft, pending_review, cancelled —
// exists only for the people managing it.
const PUBLISHED_STATUSES = ['active', 'closed'];

// Fields a posting's owner may write through PUT /jobs/:id. Everything that
// records who decided what — status, reviewer, organization, author, the view
// counter — is deliberately absent: `job.update(req.body)` used to accept all
// of it, so a recruiter could move their posting to another company, stamp it
// as reviewed, or inflate its view count.
const EDITABLE_JOB_FIELDS = [
  'title',
  'description',
  'requirements',
  'jobType',
  'location',
  'salaryMin',
  'salaryMax',
  'experienceRequired',
  'skillsRequired',
  'totalPositions',
  'applicationDeadline',
  'eligibilityCriteria'
];

// Edits that change what the placement cell actually approved. Changing any of
// these on a live posting sends it back for review; a reviewer signed off on
// the role, the pay and who may apply, not on whatever it later became.
const MATERIAL_JOB_FIELDS = [
  'title',
  'description',
  'requirements',
  'jobType',
  'salaryMin',
  'salaryMax',
  'eligibilityCriteria'
];

// Key-order-insensitive serialisation, so re-saving the edit form with the
// same criteria in a different key order is not mistaken for a change.
const stableStringify = (v) => {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== null && v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
};

const sameValue = (a, b) => {
  const norm = (v) =>
    v === undefined ||
    v === '' ||
    (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
      ? null
      : v;
  const x = norm(a);
  const y = norm(b);
  if (x === null || y === null) return x === y;
  if (typeof x === 'object' || typeof y === 'object') return stableStringify(x) === stableStringify(y);
  return String(x) === String(y);
};

/**
 * Company organizations whose postings a TPO may review.
 *
 * The queue used to be global: any TPO — including one whose college signed up
 * five minutes ago — could approve any posting, and an approved posting is
 * visible to every student on the platform. A TPO now reviews only postings
 * from companies that recruit at their institution, i.e. a company with at
 * least one recruiter whose allow-list (recruiter_allowed_organizations)
 * contains the TPO's organization. That is the existing, admin-managed record
 * of "this company recruits here", so no new relationship is invented.
 * Admins review everything.
 */
async function reviewableCompanyIds(tpoOrganizationId) {
  return companyIdsRecruitingAt(tpoOrganizationId);
}

async function canReviewJob(user, job) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'tpo') return false;
  const companyIds = await reviewableCompanyIds(user.organizationId);
  return companyIds.includes(job.organizationId);
}

const managesPosting = (user, job) =>
  !!user &&
  (user.role === 'admin' ||
    (POSTING_MANAGER_ROLES.includes(user.role) &&
      !!user.organizationId &&
      user.organizationId === job.organizationId));

/**
 * Decide which status a requested change actually produces.
 *
 * Recruiters do not publish; the placement cell does (f9318b4). Creation
 * already turned a recruiter's "active" into pending_review, but PATCH
 * /jobs/:id/status and PUT /jobs/:id accepted `active` straight from draft or
 * pending_review — a one-request way round the review queue. For a recruiter:
 *
 *   * active from active/closed stays/reopens — closed is only reachable from
 *     a published posting (below), so it was reviewed;
 *   * active from anything else becomes pending_review, i.e. "submit for
 *     review", which is what the button means;
 *   * closed only from a published posting, so draft -> closed -> active
 *     cannot launder an unreviewed (or rejected) draft;
 *   * draft and cancelled are always allowed — taking a posting down never
 *     needs approval.
 *
 * TPOs and admins are the reviewers, so their requests are taken as given.
 * Returns { status } or { error, code }.
 */
function resolveStatusChange(user, job, requested) {
  if (user.role !== 'recruiter') return { status: requested };
  if (requested === 'active') {
    return { status: PUBLISHED_STATUSES.includes(job.status) ? 'active' : 'pending_review' };
  }
  if (requested === 'closed' && !PUBLISHED_STATUSES.includes(job.status)) {
    return {
      code: 409,
      error: 'Only a published posting can be closed. Withdraw it to draft instead.'
    };
  }
  return { status: requested };
}

/**
 * The 400 body for a failed validation chain, in the shape the client reads:
 * a sentence in `message` (the first problem, so a toast says something
 * useful) and every problem per field in `details`.
 */
const validationFailure = (res, errors) => {
  const details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
  return res.status(400).json({
    error: 'Validation Error',
    message: details[0]?.message || 'Some details need fixing',
    details
  });
};

/**
 * Today's date in India as YYYY-MM-DD. Deadlines are calendar dates, and the
 * people setting and reading them are in IST; comparing against the server's
 * UTC clock would make "today" flip at 05:30 in the morning.
 */
const todayInIndia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * A deadline must leave students at least a day to apply. Returns an error
 * message, or null. Only called when the deadline is being set or changed, so
 * editing some other field of a posting whose deadline has passed still saves.
 */
const deadlineError = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const day = String(value).slice(0, 10);
  if (day <= todayInIndia()) {
    return 'Application deadline must be a future date, so students have time to apply';
  }
  return null;
};

class JobController {
  /**
   * The placement cell's review queue: postings waiting to be published.
   *
   * Scoped by who may act on them — a TPO sees postings aimed at their own
   * students, an admin sees everything. Recruiters do not reach this at all;
   * they see their own pending postings through the normal job list.
   */
  async getPendingJobs(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
      const offset = (parseInt(page, 10) - 1) * limitNum;

      const where = { status: 'pending_review' };
      if (req.user.role !== 'admin') {
        const companyIds = await reviewableCompanyIds(req.user.organizationId);
        if (companyIds.length === 0) {
          return res.json({
            message: 'Pending job postings retrieved successfully',
            jobs: [],
            pagination: { currentPage: parseInt(page, 10), totalPages: 0, totalItems: 0, itemsPerPage: limitNum }
          });
        }
        where.organizationId = { [Op.in]: companyIds };
      }

      const { count, rows } = await Job.findAndCountAll({
        where,
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name', 'logoUrl', 'type'] },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['createdAt', 'ASC']],
        limit: limitNum,
        offset,
        distinct: true
      });

      res.json({
        message: 'Pending job postings retrieved successfully',
        jobs: rows,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(count / limitNum),
          totalItems: count,
          itemsPerPage: limitNum
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve or reject a pending posting.
   *
   * Approving publishes it and fans out the job alert to eligible students, the
   * same way an unreviewed posting used to on creation. Rejecting sends it back
   * to draft rather than destroying it, and the reason is recorded and sent to
   * the recruiter — a posting that silently never appears is the worst possible
   * outcome for both sides.
   */
  async reviewJob(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(res, errors);

      const { id } = req.params;
      const { action, notes } = req.body;

      const job = await Job.findByPk(id, {
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }]
      });
      // Out of a TPO's scope reads as not found, not forbidden, so the queue
      // cannot be used to probe which postings exist elsewhere.
      if (!job || !(await canReviewJob(req.user, job))) {
        return res.status(404).json({ error: 'Job Not Found', message: 'Job not found' });
      }
      if (job.status !== 'pending_review') {
        return res.status(409).json({
          error: 'Not Pending Review',
          message: `This posting is ${job.status}, not awaiting review`
        });
      }

      const approved = action === 'approve';
      // A live posting a recruiter edited comes back through this queue. Its
      // students were alerted the first time it was approved; alerting them
      // again announced the same drive as a "new job" twice.
      const approvedBefore = approved
        ? (await AuditLog.count({
            where: { entityType: 'job', entityId: job.id, action: 'job_posting_approved' }
          })) > 0
        : false;
      await job.update({
        status: approved ? 'active' : 'draft',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewNotes: notes || null
      });

      AuditLog.create({
        userId: req.user.id,
        action: approved ? 'job_posting_approved' : 'job_posting_rejected',
        entityType: 'job',
        entityId: job.id,
        newValues: { status: job.status, notes: notes || null },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch((err) => logger.error('Audit log failed', err));

      res.json({
        message: approved ? 'Job posting approved and published' : 'Job posting sent back to the recruiter',
        job
      });

      // Tell the recruiter either way, and the students only once it is live.
      if (job.createdBy) {
        notificationService
          .createNotification(
            job.createdBy,
            approved ? 'Job posting approved' : 'Job posting needs changes',
            approved
              ? `${job.title} has been approved and is now visible to students.`
              : `${job.title} was not published.${notes ? ` ${notes}` : ''}`,
            'system_alert',
            { jobId: job.id, decision: approved ? 'approved' : 'rejected' },
            'high'
          )
          .catch((err) => logger.error('Review notification failed', err));
      }
      if (approved && !approvedBefore) {
        notificationService
          .notifyEligibleStudentsOfJob(job.id)
          .catch((err) => logger.error('Job alert fan-out failed', err, { jobId: job.id }));
      }
    } catch (error) {
      next(error);
    }
  }

  async createJob(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(res, errors);

      const pastDeadline = deadlineError(req.body.applicationDeadline);
      if (pastDeadline) {
        return res.status(400).json({
          error: 'Validation Error',
          message: pastDeadline,
          details: [{ field: 'applicationDeadline', message: pastDeadline }]
        });
      }

      // Normalize JSON fields to ensure consistent format (empty arrays/objects)
      // This helps avoid false positive unique constraint errors
      const normalizedJobData = {
        ...req.body,
        organizationId: req.user.organizationId,
        createdBy: req.user.id
      };

      // Remove id if it's being sent (should be auto-generated)
      if (normalizedJobData.id !== undefined) {
        logger.warn('ID field was provided in request, removing it', { providedId: normalizedJobData.id });
        delete normalizedJobData.id;
      }

      // Ensure skillsRequired is always an array (not null/undefined)
      if (!normalizedJobData.skillsRequired || !Array.isArray(normalizedJobData.skillsRequired)) {
        normalizedJobData.skillsRequired = [];
      } else {
        // Filter out empty strings and normalize
        normalizedJobData.skillsRequired = normalizedJobData.skillsRequired
          .filter(skill => skill && typeof skill === 'string' && skill.trim() !== '')
          .map(skill => skill.trim());
      }

      // Ensure eligibilityCriteria is always an object (not null/undefined)
      if (!normalizedJobData.eligibilityCriteria || typeof normalizedJobData.eligibilityCriteria !== 'object') {
        normalizedJobData.eligibilityCriteria = {};
      } else {
        // Remove null/undefined values from eligibilityCriteria
        Object.keys(normalizedJobData.eligibilityCriteria).forEach(key => {
          if (normalizedJobData.eligibilityCriteria[key] === null || normalizedJobData.eligibilityCriteria[key] === undefined) {
            delete normalizedJobData.eligibilityCriteria[key];
          }
        });
      }

      // Log the job data for debugging
      logger.info('Creating job', {
        title: normalizedJobData.title,
        organizationId: normalizedJobData.organizationId,
        jobType: normalizedJobData.jobType,
        location: normalizedJobData.location,
        skillsCount: normalizedJobData.skillsRequired?.length || 0
      });

      // A recruiter's posting goes to the placement cell before it goes to
      // students. Recruiters are approved, but their postings were not: an
      // approved recruiter could publish straight to a whole cohort with nobody
      // in between, and one badly-worded or fraudulent listing reaching every
      // student is a reputational event for the cell. A recruiter may still
      // save a draft; anything they mean to publish becomes pending_review.
      // TPOs and admins are the reviewers, so their own postings publish
      // directly.
      if (req.user.role === 'recruiter' && normalizedJobData.status !== 'draft') {
        normalizedJobData.status = 'pending_review';
      }

      const job = await Job.create(normalizedJobData);

      const jobWithDetails = await Job.findByPk(job.id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      res.status(201).json({
        message: 'Job created successfully',
        job: jobWithDetails
      });

      // Alert eligible students, after the response. A campus-wide fan-out of
      // one notification and one email per student must not hold up the
      // recruiter's request, and a failure to notify is not a reason to report
      // that the job was not created — it was.
      if (job.status === 'active') {
        notificationService
          .notifyEligibleStudentsOfJob(job.id)
          .catch((err) => logger.error('Job alert fan-out failed', err, { jobId: job.id }));
      } else if (job.status === 'pending_review') {
        notifyReviewersOfPendingJob(job);
      }
    } catch (error) {
      // Log detailed error information for debugging
      logger.error('Error creating job', error, {
        name: error.name,
        parent: error.parent ? {
          message: error.parent.message,
          constraint: error.parent.constraint,
          detail: error.parent.detail,
          code: error.parent.code
        } : null,
        fields: error.fields,
        errors: error.errors ? error.errors.map(e => ({
          path: e.path,
          message: e.message,
          value: e.value,
          type: e.type
        })) : null,
        originalError: error.original ? {
          message: error.original.message,
          constraint: error.original.constraint,
          detail: error.original.detail
        } : null
      });
      next(error);
    }
  }

  async getAllJobs(req, res, next) {
    try {
      const {
        status,
        jobType,
        location,
        organizationId,
        search,
        salaryMin,
        salaryMax,
        experienceRequired
      } = req.query;

      // Bounded: `?limit=100000` used to pull the whole table, with every
      // application row joined in for the counts.
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const offset = (page - 1) * limit;
      const whereClause = {};

      // Who is allowed to see a job that is not live?
      //
      // Only the people who manage postings. This endpoint is `optionalAuth`,
      // and it used to apply a status filter only when one was supplied — so an
      // unauthenticated GET /api/jobs returned every row in the table,
      // including `draft` (the default for a new job) and `cancelled` ones. A
      // recruiter part-way through writing a req had it published to the world.
      //
      // And only their own. A recruiter or TPO used to be able to list every
      // organization's drafts and pending postings (`?status=draft`, or no
      // status at all) — a competitor's unpublished reqs included. Unpublished
      // rows are now limited to the caller's own organization, plus, for a
      // TPO, the pending postings they are entitled to review.
      const role = req.user?.role;
      if (role === 'admin') {
        if (status) whereClause.status = status;
      } else if (POSTING_MANAGER_ROLES.includes(role)) {
        const ownOrg = req.user.organizationId || -1;
        const unpublishedScope = [{ organizationId: ownOrg }];
        if (role === 'tpo') {
          const companyIds = await reviewableCompanyIds(req.user.organizationId);
          if (companyIds.length) {
            unpublishedScope.push({ organizationId: { [Op.in]: companyIds }, status: 'pending_review' });
          }
        }
        if (status === 'active') {
          whereClause.status = 'active';
        } else if (status) {
          whereClause[Op.and] = [{ status }, { [Op.or]: unpublishedScope }];
        } else {
          whereClause[Op.and] = [{ [Op.or]: [{ status: 'active' }, ...unpublishedScope] }];
        }
      } else {
        // Never honour a caller-supplied status here: `?status=draft` would
        // otherwise be the same leak with an extra step.
        whereClause.status = 'active';
      }
      if (jobType) whereClause.jobType = jobType;
      if (location) whereClause.location = { [Op.iLike]: `%${location}%` };
      if (organizationId) whereClause.organizationId = organizationId;
      if (salaryMin) whereClause.salaryMin = { [Op.gte]: parseInt(salaryMin) };
      if (salaryMax) whereClause.salaryMax = { [Op.lte]: parseInt(salaryMax) };
      if (experienceRequired !== undefined) {
        whereClause.experienceRequired = { [Op.lte]: parseInt(experienceRequired) };
      }

      // Search functionality
      if (search) {
        const term = `%${search}%`;
        whereClause[Op.or] = [
          { title: { [Op.iLike]: term } },
          { description: { [Op.iLike]: term } },
          // `skills_required` is a `json` column, not `jsonb`. Op.contains
          // emits the `@>` containment operator, which Postgres only defines
          // for jsonb — so this threw "operator does not exist: json @> unknown"
          // and every search request 500'd. Job search has never worked.
          //
          // Casting to text and matching the serialised array also makes the
          // term a substring match, consistent with the title and description
          // arms above, rather than requiring an exact whole-skill equality.
          // Built with `where`/`cast` so the term stays a bound parameter.
          where(cast(col('Job.skills_required'), 'text'), { [Op.iLike]: term })
        ];
      }

      // A student (or other institution member, or an anonymous caller) sees
      // only the drives of their own institution and of companies allowed to
      // recruit there. Under Op.and, so `?organizationId=` cannot widen it.
      if (isJobScopedViewer(req.user)) {
        const scope = await studentVisibleJobWhere(req.user);
        whereClause[Op.and] = [...(whereClause[Op.and] || []), scope];
      }

      const { count, rows: jobs } = await Job.findAndCountAll({
        where: whereClause,
        include: [
          { 
            model: Organization, 
            as: 'organization',
            attributes: ['id', 'name', 'type', 'logoUrl']
          },
          {
            model: Application,
            as: 'applications',
            attributes: ['id', 'status'],
            required: false
          }
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        distinct: true
      });

      // Add application count for each job
      const jobsWithCounts = jobs.map(job => {
        const jobData = job.toJSON();
        jobData.applicationCount = job.applications ? job.applications.length : 0;
        delete jobData.applications;
        return jobData;
      });

      res.json({
        message: 'Jobs retrieved successfully',
        jobs: jobsWithCounts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalJobs: count,
          hasMore: offset + jobs.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const job = await Job.findByPk(id, {
        include: [
          { 
            model: Organization, 
            as: 'organization'
          },
          { 
            model: User, 
            as: 'creator', 
            attributes: ['id', 'firstName', 'lastName'] 
          },
          {
            model: Assessment,
            as: 'assessment'
          }
        ]
      });

      if (!job) {
        return res.status(404).json({
          error: 'Job Not Found',
          message: 'Job not found'
        });
      }

      // An unpublished posting is visible to the organization managing it, an
      // admin, and a TPO entitled to review it — nobody else. This endpoint is
      // optionalAuth and used to return drafts and pending postings to any
      // student or anonymous caller who guessed the id, which made the review
      // queue advisory: the job was "not yet published" and readable anyway.
      // 404 rather than 403, so ids of unpublished postings are not confirmed.
      const manages = managesPosting(req.user, job);
      if (!PUBLISHED_STATUSES.includes(job.status) && !manages) {
        const reviewer = job.status === 'pending_review' && (await canReviewJob(req.user, job));
        if (!reviewer) {
          return res.status(404).json({ error: 'Job Not Found', message: 'Job not found' });
        }
      }

      // A live drive is still only for the institutions it recruits at: a
      // student of a college the company is not allowed at gets the same 404
      // as for a job that does not exist.
      if (!manages && isJobScopedViewer(req.user) && !(await canStudentSeeJob(req.user, job))) {
        return res.status(404).json({ error: 'Job Not Found', message: 'Job not found' });
      }

      // Who applied is the owning organization's business. The full applicant
      // list — names, emails, cover letters — used to ship with every GET of a
      // job, including to anonymous visitors. Now:
      //   * the owning organization and admins get the full list;
      //   * institution staff get their own students' applications only;
      //   * everyone else gets a count.
      let applications = null;
      if (manages) {
        applications = await Application.findAll({
          where: { jobId: job.id },
          include: [{
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            // Only whether the placement cell verified the record: the
            // company screens on it, and it is already on the application.
            include: [{ model: StudentProfile, as: 'studentProfile', attributes: ['verificationStatus'], required: false }]
          }]
        });
      } else if (INSTITUTION_STAFF_ROLES.includes(req.user?.role) && req.user.organizationId) {
        applications = await Application.findAll({
          where: { jobId: job.id },
          include: [{
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            where: { organizationId: req.user.organizationId },
            required: true,
            include: [{ model: StudentProfile, as: 'studentProfile', attributes: ['verificationStatus'], required: false }]
          }]
        });
      }
      const applicationCount = await Application.count({ where: { jobId: job.id } });

      // The signed-in student's own application, looked up directly. The
      // client used to infer "already applied" from a paginated /applications
      // page, which said "not applied" for anyone with more applications than
      // fit on it.
      let userApplication = null;
      if (userId && req.user.role === 'student') {
        userApplication = await Application.findOne({
          where: { jobId: job.id, studentId: userId },
          attributes: ['id', 'status', 'appliedAt']
        });
      }

      const jobData = job.toJSON();
      if (applications) jobData.applications = applications.map((a) => a.toJSON());
      jobData.userApplication = userApplication ? userApplication.toJSON() : null;
      // A withdrawn application does not count: the student may apply again.
      jobData.hasApplied = !!userApplication && userApplication.status !== 'withdrawn';
      jobData.applicationCount = applicationCount;
      // The attached assessment rode along with its answer key to every
      // viewer, students included. Only the owning organization keeps it.
      if (jobData.assessment && !manages && Array.isArray(jobData.assessment.questions)) {
        jobData.assessment.questions = jobData.assessment.questions.map(
          // eslint-disable-next-line no-unused-vars
          ({ correctAnswer, correct_answer, ...rest }) => rest
        );
      }

      // Normalised criteria, plus — for a student — whether they actually meet
      // them. Telling someone why they do not qualify before they apply is the
      // whole point of publishing the criteria; previously the rules were only
      // evaluated at submit time, as a rejection.
      jobData.eligibility = describeEligibility(job.eligibilityCriteria);
      if (req.user?.role === 'student') {
        const studentProfile = await StudentProfile.findOne({ where: { userId: req.user.id } });
        const { eligible, reasons } = checkEligibility(job.eligibilityCriteria, studentProfile);
        // The institution's placement policy (offer caps, dream tiers) is a
        // separate bar from the job's own criteria, and is reported alongside
        // it so a placed student sees why the apply button is closed.
        const policy = await checkPolicyForStudent(models, {
          studentId: req.user.id,
          organizationId: req.user.organizationId,
          job,
          profile: studentProfile
        });
        jobData.eligibility.meetsCriteria = eligible && policy.allowed;
        jobData.eligibility.reasons = [...reasons, ...policy.reasons];
        jobData.eligibility.profileComplete = Boolean(studentProfile);
        jobData.eligibility.tier = policy.tier;
      }

      // Count this as a view unless the viewer owns the posting — a recruiter
      // reloading their own job would otherwise inflate the number they are
      // being shown on their dashboard.
      //
      // Atomic INCREMENT rather than read-modify-write: two students opening
      // the same job at once must not race and lose a count. Deliberately not
      // awaited into the response — a failed counter is not worth failing the
      // page for, so it is fired off and its error only logged.
      const isOwnPosting =
        userId && (userId === job.createdBy || req.user?.organizationId === job.organizationId);
      // Only a published posting has an audience; a TPO opening a pending one
      // to review it is not a student viewing the job.
      if (!isOwnPosting && PUBLISHED_STATUSES.includes(job.status)) {
        job
          .increment('viewCount', { by: 1 })
          .catch((err) => logger.warn('Failed to record job view', { jobId: id, error: err.message }));
        // Reflect the increment in this response rather than showing a
        // one-behind number until the next load.
        jobData.viewCount = (jobData.viewCount || 0) + 1;
      }

      res.json({
        message: 'Job retrieved successfully',
        job: jobData
      });
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return validationFailure(res, errors);

      const { id } = req.params;
      const job = await Job.findByPk(id);

      if (!job) {
        return res.status(404).json({
          error: 'Job Not Found',
          message: 'Job not found'
        });
      }

      // Check if user has permission to update
      if (req.user.role !== 'admin' && job.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only update jobs from your organization'
        });
      }

      const updates = {};
      for (const field of EDITABLE_JOB_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      // A changed deadline must be in the future; an unchanged one is left
      // alone, or a closed drive could never have its description corrected.
      if (
        updates.applicationDeadline !== undefined &&
        String(updates.applicationDeadline || '').slice(0, 10) !== String(job.applicationDeadline || '').slice(0, 10)
      ) {
        const pastDeadline = deadlineError(updates.applicationDeadline);
        if (pastDeadline) {
          return res.status(400).json({
            error: 'Validation Error',
            message: pastDeadline,
            details: [{ field: 'applicationDeadline', message: pastDeadline }]
          });
        }
      }

      // The route compares a submitted pair; an update that sends only one
      // figure has to be checked against the one already stored.
      const nextMin = updates.salaryMin !== undefined ? updates.salaryMin : job.salaryMin;
      const nextMax = updates.salaryMax !== undefined ? updates.salaryMax : job.salaryMax;
      if (nextMin != null && nextMax != null && nextMin !== '' && nextMax !== '' && Number(nextMin) > Number(nextMax)) {
        const msg = 'Maximum pay must be greater than or equal to minimum pay';
        return res.status(400).json({
          error: 'Validation Error',
          message: msg,
          details: [{ field: 'salaryMax', message: msg }]
        });
      }

      // Status goes through the same gate as PATCH /:id/status, so the edit
      // form cannot be used to publish past the placement cell.
      let sentForReview = false;
      if (req.body.status !== undefined && req.body.status !== job.status) {
        const decision = resolveStatusChange(req.user, job, req.body.status);
        if (decision.error) {
          return res.status(decision.code).json({ error: 'Invalid Status Change', message: decision.error });
        }
        updates.status = decision.status;
        sentForReview = decision.status === 'pending_review' && req.body.status === 'active';
      }

      // A recruiter changing what was approved — the role, the pay, who may
      // apply — on a published posting sends it back to the queue. Otherwise
      // approval is a one-time hurdle: get a bland posting approved, then edit
      // it into something the cell would never have passed.
      if (req.user.role === 'recruiter' && PUBLISHED_STATUSES.includes(updates.status || job.status)) {
        const materialChange = MATERIAL_JOB_FIELDS.some(
          (field) => field in updates && !sameValue(updates[field], job[field])
        );
        if (materialChange) {
          updates.status = 'pending_review';
          sentForReview = true;
        }
      }

      await job.update(updates);

      const updatedJob = await Job.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ]
      });

      res.json({
        message: sentForReview
          ? 'Job updated and sent to the placement cell for review'
          : 'Job updated successfully',
        sentForReview,
        job: updatedJob
      });
      if (sentForReview) notifyReviewersOfPendingJob(updatedJob);
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req, res, next) {
    try {
      const { id } = req.params;
      const job = await Job.findByPk(id);

      if (!job) {
        return res.status(404).json({
          error: 'Job Not Found',
          message: 'Job not found'
        });
      }

      // Check permissions
      if (req.user.role !== 'admin' && job.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only delete jobs from your organization'
        });
      }

      // Soft delete by changing status
      await job.update({ status: 'cancelled' });

      res.json({
        message: 'Job deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobsByOrganization(req, res, next) {
    try {
      const { organizationId } = req.params;
      const { status, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = { organizationId };
      if (status) whereClause.status = status;

      const { count, rows: jobs } = await Job.findAndCountAll({
        where: whereClause,
        include: [
          { 
            model: Organization, 
            as: 'organization',
            attributes: ['id', 'name', 'type', 'logoUrl']
          },
          {
            model: Application,
            as: 'applications',
            attributes: ['id', 'status']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      const jobsWithCounts = jobs.map(job => {
        const jobData = job.toJSON();
        jobData.applicationCount = job.applications ? job.applications.length : 0;
        delete jobData.applications;
        return jobData;
      });

      res.json({
        message: 'Organization jobs retrieved successfully',
        jobs: jobsWithCounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalJobs: count,
          hasMore: offset + jobs.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobStats(req, res, next) {
    try {
      const { organizationId } = req.query;
      const whereClause = {};
      
      // Validate organizationId if provided
      if (organizationId) {
        if (isNaN(parseInt(organizationId))) {
          return res.status(400).json({
            error: 'Invalid Organization ID',
            message: 'Organization ID must be a valid number'
          });
        }
        whereClause.organizationId = parseInt(organizationId);
      }
      
      // For recruiters, always use their organization
      if (req.user.role === 'recruiter') {
        if (!req.user.organizationId) {
          return res.status(400).json({
            error: 'Organization Not Found',
            message: 'User is not associated with any organization'
          });
        }
        whereClause.organizationId = req.user.organizationId;
      }

      if (isJobScopedViewer(req.user)) {
        const scope = await studentVisibleJobWhere(req.user);
        whereClause[Op.and] = [...(whereClause[Op.and] || []), scope];
      }

      const stats = await Job.findAll({
        where: whereClause,
        attributes: [
          'status',
          [Job.sequelize.fn('COUNT', Job.sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const totalApplications = await Application.count({
        include: [
          {
            model: Job,
            as: 'job',
            where: whereClause,
            attributes: []
          }
        ]
      });

      res.json({
        message: 'Job statistics retrieved successfully',
        stats: {
          jobsByStatus: stats,
          totalApplications
        }
      });
    } catch (error) {
      logger.error('Error in getJobStats', error);
      next(error);
    }
  }

  async toggleJobStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'closed', 'draft'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid Status',
          message: 'Status must be active, closed, or draft'
        });
      }

      const job = await Job.findByPk(id);
      if (!job) {
        return res.status(404).json({
          error: 'Job Not Found',
          message: 'Job not found'
        });
      }

      // Check permissions
      if (req.user.role !== 'admin' && job.organizationId !== req.user.organizationId) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only modify jobs from your organization'
        });
      }

      const decision = resolveStatusChange(req.user, job, status);
      if (decision.error) {
        return res.status(decision.code).json({ error: 'Invalid Status Change', message: decision.error });
      }
      await job.update({ status: decision.status });

      res.json({
        message:
          decision.status === 'pending_review' && status === 'active'
            ? 'Job submitted to the placement cell for review'
            : `Job status updated to ${decision.status}`,
        job: {
          id: job.id,
          title: job.title,
          status: job.status
        }
      });
      if (decision.status === 'pending_review') notifyReviewersOfPendingJob(job);
    } catch (error) {
      next(error);
    }
  }

  async getRecommendedJobs(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 5 } = req.query;

      // Get user's student profile to match skills
      const user = await User.findByPk(userId, {
        include: [{ model: require('../models').StudentProfile, as: 'studentProfile' }]
      });

      // A student who has not built a profile yet is the normal state on the
      // first day of an account, not a malformed request. Answering 400 made
      // every new signup's first dashboard load report a failed request in the
      // console, and gave the page nothing to render but an error. Return the
      // empty result the dashboard can actually show, and say why it is empty.
      if (!user || !user.studentProfile) {
        return res.json({
          message: 'No recommendations yet',
          jobs: [],
          needsProfile: true,
          reason: 'Complete your student profile to get job recommendations'
        });
      }

      const userSkills = user.studentProfile.skills || [];
      const userCGPA = user.studentProfile.cgpa || 0;
      const userBranch = user.studentProfile.branch;

      // Find jobs that match user's skills and eligibility
      const jobs = await Job.findAll({
        where: {
          [Op.and]: [
            { applicationDeadline: { [Op.gte]: new Date() } },
            await studentVisibleJobWhere(req.user)
          ]
        },
        include: [
          { 
            model: Organization, 
            as: 'organization',
            attributes: ['id', 'name', 'type', 'logoUrl']
          }
        ],
        limit: parseInt(limit) * 2, // Get more to filter
        order: [['createdAt', 'DESC']]
      });

      // Score jobs based on skill match and eligibility. A role the student
      // cannot apply for is not a recommendation: it used to be listed (only
      // scored lower), and the criteria were read under the camelCase keys
      // alone with an exact branch match, so "CSE" never matched "Computer
      // Science Engineering". Both now go through utils/eligibility.
      const scoredJobs = jobs
        .filter((job) => checkEligibility(job.eligibilityCriteria, user.studentProfile).eligible)
        .map(job => {
        let score = 0;
        const jobSkills = job.skillsRequired || [];
        const eligibility = describeEligibility(job.eligibilityCriteria);

        // Skill matching
        const matchingSkills = userSkills.filter(skill => 
          jobSkills.some(jobSkill => 
            jobSkill.toLowerCase().includes(skill.toLowerCase())
          )
        );
        score += matchingSkills.length * 10;

        // CGPA eligibility
        if (eligibility.minCGPA !== null && Number(userCGPA) >= eligibility.minCGPA) {
          score += 20;
        }

        // Branch eligibility: the job names branches and the student's is one
        // of them (the eligibility filter above already ruled out a mismatch).
        if (eligibility.allowedBranches.length > 0 && userBranch) {
          score += 15;
        }

        // Experience requirement
        if (job.experienceRequired === 0) {
          score += 10; // Prefer entry-level jobs for students
        }

        return { ...job.toJSON(), matchScore: score };
      });

      // Sort by score and take top results
      const recommendedJobs = scoredJobs
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, parseInt(limit));

      res.json({
        message: 'Recommended jobs retrieved successfully',
        jobs: recommendedJobs
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new JobController();