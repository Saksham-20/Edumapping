// server/src/controllers/jobController.js
const { Job, Organization, User, Application, Assessment } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class JobController {
  async createJob(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
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

      const job = await Job.create(normalizedJobData);

      const jobWithDetails = await Job.findByPk(job.id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ]
      });

      res.status(201).json({
        message: 'Job created successfully',
        job: jobWithDetails
      });
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
        page = 1,
        limit = 10,
        status,
        jobType,
        location,
        organizationId,
        search,
        salaryMin,
        salaryMax,
        experienceRequired
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = {};

      // Filters - only apply status filter if explicitly provided
      // For recruiters viewing their own jobs, show all statuses by default
      if (status) whereClause.status = status;
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
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { skillsRequired: { [Op.contains]: [search] } }
        ];
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
        limit: parseInt(limit),
        offset: parseInt(offset),
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
            attributes: ['id', 'firstName', 'lastName', 'email'] 
          },
          {
            model: Application,
            as: 'applications',
            include: [
              {
                model: User,
                as: 'student',
                attributes: ['id', 'firstName', 'lastName', 'email']
              }
            ]
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

      // Check if current user has applied
      let userApplication = null;
      if (userId && job.applications) {
        userApplication = job.applications.find(app => app.studentId === userId);
      }

      const jobData = job.toJSON();
      jobData.userApplication = userApplication;
      jobData.applicationCount = job.applications ? job.applications.length : 0;

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
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

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

      await job.update(req.body);

      const updatedJob = await Job.findByPk(id, {
        include: [
          { model: Organization, as: 'organization' },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ]
      });

      res.json({
        message: 'Job updated successfully',
        job: updatedJob
      });
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

      await job.update({ status });

      res.json({
        message: `Job status updated to ${status}`,
        job: {
          id: job.id,
          title: job.title,
          status: job.status
        }
      });
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

      if (!user || !user.studentProfile) {
        return res.status(400).json({
          error: 'Profile Incomplete',
          message: 'Please complete your student profile to get recommendations'
        });
      }

      const userSkills = user.studentProfile.skills || [];
      const userCGPA = user.studentProfile.cgpa || 0;
      const userBranch = user.studentProfile.branch;

      // Find jobs that match user's skills and eligibility
      const jobs = await Job.findAll({
        where: {
          status: 'active',
          applicationDeadline: { [Op.gte]: new Date() }
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

      // Score jobs based on skill match and eligibility
      const scoredJobs = jobs.map(job => {
        let score = 0;
        const jobSkills = job.skillsRequired || [];
        const eligibility = job.eligibilityCriteria || {};

        // Skill matching
        const matchingSkills = userSkills.filter(skill => 
          jobSkills.some(jobSkill => 
            jobSkill.toLowerCase().includes(skill.toLowerCase())
          )
        );
        score += matchingSkills.length * 10;

        // CGPA eligibility
        if (eligibility.minCGPA && userCGPA >= eligibility.minCGPA) {
          score += 20;
        }

        // Branch eligibility
        if (eligibility.allowedBranches && 
            eligibility.allowedBranches.includes(userBranch)) {
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