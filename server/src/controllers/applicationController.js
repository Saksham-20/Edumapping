// server/src/controllers/applicationController.js
const { Application, Job, User, StudentProfile, Organization } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const notificationService = require('../services/notificationService');

class ApplicationController {
  async submitApplication(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
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

      // Check if deadline has passed
      if (job.applicationDeadline && new Date() > new Date(job.applicationDeadline)) {
        return res.status(400).json({
          error: 'Deadline Passed',
          message: 'Application deadline has passed'
        });
      }

      // Check if user already applied
      const existingApplication = await Application.findOne({
        where: { jobId, studentId }
      });

      if (existingApplication) {
        return res.status(409).json({
          error: 'Already Applied',
          message: 'You have already applied for this job'
        });
      }

      // Check eligibility
      const studentProfile = await StudentProfile.findOne({ where: { userId: studentId } });
      if (studentProfile && job.eligibilityCriteria) {
        const criteria = job.eligibilityCriteria;
        
        if (criteria.minCGPA && studentProfile.cgpa < criteria.minCGPA) {
          return res.status(400).json({
            error: 'Eligibility Criteria Not Met',
            message: `Minimum CGPA requirement: ${criteria.minCGPA}`
          });
        }

        if (criteria.allowedBranches && 
            !criteria.allowedBranches.includes(studentProfile.branch)) {
          return res.status(400).json({
            error: 'Eligibility Criteria Not Met',
            message: 'Your branch is not eligible for this position'
          });
        }

        if (criteria.graduationYear && 
            studentProfile.graduationYear !== criteria.graduationYear) {
          return res.status(400).json({
            error: 'Eligibility Criteria Not Met',
            message: `This position is for ${criteria.graduationYear} graduates only`
          });
        }
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
        return res.status(400).json({
          error: 'Profile Incomplete',
          message:
            'Your profile is incomplete. Please fill in all required details before applying for jobs.',
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
            'You must generate your resume from your profile before applying for jobs.'
        });
      }

      // Create application (always use resume from student profile)
      const application = await Application.create({
        jobId,
        studentId,
        coverLetter,
        resumeUrl: studentProfile.resumeUrl,
        status: 'applied'
      });

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
        console.error('Notification error:', notifError);
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
      const {
        page = 1,
        limit = 10,
        status,
        jobId,
        studentId,
        organizationId
      } = req.query;

      const offset = (page - 1) * limit;
      const whereClause = {};

      // Apply filters
      if (status) whereClause.status = status;
      if (jobId) whereClause.jobId = jobId;
      if (studentId) whereClause.studentId = studentId;

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

      // For TPO users, we need to filter applications by student organization
      if (req.user.role === 'tpo') {
        // Get all students in the TPO's organization
        const studentsInOrg = await User.findAll({
          where: { 
            role: 'student',
            organizationId: req.user.organizationId 
          },
          attributes: ['id']
        });
        
        const studentIds = studentsInOrg.map(student => student.id);
        
        // Only show applications from these students
        whereClause.studentId = { [Op.in]: studentIds };
        
        console.log('TPO Student Filter:', {
          tpoOrgId: req.user.organizationId,
          studentIds,
          studentCount: studentIds.length
        });
      }

      const { count, rows: applications } = await Application.findAndCountAll({
        where: whereClause,
        include: includeOptions,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      // Debug logging
      console.log('Applications Query Debug:', {
        userId: req.user.id,
        userRole: req.user.role,
        userOrgId: req.user.organizationId,
        whereClause,
        count,
        applicationsCount: applications.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Ensure pagination object has all required fields
      const pagination = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        totalApplications: count,
        hasMore: offset + applications.length < count,
        limit: parseInt(limit)
      };

      res.json({
        message: 'Applications retrieved successfully',
        applications,
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
      } else if (req.user.role === 'tpo') {
        // TPO can only view applications from students in their own university
        canView = application.student && application.student.organizationId === req.user.organizationId;
      }

      // Debug logging for permission issues
      console.log('Permission Check Debug:', {
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
        application
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

      // Send notification to student
      try {
        await notificationService.notifyApplicationStatusUpdate(application.id, status);
      } catch (notifError) {
        console.error('Notification error:', notifError);
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

      // Check if application can be withdrawn
      if (['selected', 'rejected'].includes(application.status)) {
        return res.status(400).json({
          error: 'Cannot Withdraw',
          message: 'Cannot withdraw application that has been finalized'
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
      }

      if (jobId) whereClause.jobId = jobId;

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

  async bulkUpdateApplications(req, res, next) {
    try {
      const { applicationIds, status, feedback } = req.body;

      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(400).json({
          error: 'Invalid Data',
          message: 'Application IDs must be provided as an array'
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

      const whereClause = { id: { [Op.in]: applicationIds } };

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
        case 'rejected':
          updateData.resultAt = now;
          break;
      }

      const [updatedCount] = await Application.update(updateData, {
        where: whereClause
      });

      res.json({
        message: `${updatedCount} applications updated successfully`,
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

      const canView = req.user.role === 'admin' ||
                     (req.user.role === 'recruiter' && 
                      job.organizationId === req.user.organizationId) ||
                     req.user.role === 'tpo';

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
            attributes: ['id', 'firstName', 'lastName', 'email'],
            include: [{ model: StudentProfile, as: 'studentProfile' }]
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'Job applications retrieved successfully',
        applications,
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