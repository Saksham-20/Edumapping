// server/src/utils/constants.js
module.exports = {
  USER_ROLES: {
    STUDENT: 'student',
    RECRUITER: 'recruiter',
    TPO: 'tpo',
    ADMIN: 'admin',
    PRINCIPAL: 'principal',
    TEACHER: 'teacher',
    SCHOOL_ADMIN: 'school_admin',
    CAREER_COUNSELOR: 'career_counselor'
  },

  APPROVAL_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  JOB_TYPES: {
    INTERNSHIP: 'internship',
    FULL_TIME: 'full_time',
    PART_TIME: 'part_time'
  },

  JOB_STATUS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    CLOSED: 'closed',
    CANCELLED: 'cancelled'
  },

  APPLICATION_STATUS: {
    APPLIED: 'applied',
    SCREENING: 'screening',
    SHORTLISTED: 'shortlisted',
    INTERVIEWED: 'interviewed',
    SELECTED: 'selected',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn'
  },

  EVENT_TYPES: {
    CAMPUS_DRIVE: 'campus_drive',
    INFO_SESSION: 'info_session',
    WORKSHOP: 'workshop',
    SEMINAR: 'seminar',
    JOB_FAIR: 'job_fair',
    OTHER: 'other'
  },

  EVENT_STATUS: {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  NOTIFICATION_TYPES: {
    APPLICATION_UPDATE: 'application_update',
    JOB_ALERT: 'job_alert',
    EVENT_REMINDER: 'event_reminder',
    SYSTEM_ALERT: 'system_alert',
    GENERAL: 'general'
  },

  NOTIFICATION_PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },

  ASSESSMENT_TYPES: {
    TECHNICAL: 'technical',
    APTITUDE: 'aptitude',
    PERSONALITY: 'personality',
    CODING: 'coding',
    OTHER: 'other'
  },

  ACHIEVEMENT_TYPES: {
    ACADEMIC: 'academic',
    PROJECT: 'project',
    CERTIFICATION: 'certification',
    COMPETITION: 'competition',
    PUBLICATION: 'publication',
    OTHER: 'other'
  },

  ORGANIZATION_TYPES: {
    UNIVERSITY: 'university',
    COMPANY: 'company',
    SCHOOL: 'school'
  },

  FILE_TYPES: {
    RESUME: 'resume',
    PROFILE_PICTURE: 'profile_picture',
    DOCUMENT: 'document',
    OTHER: 'other'
  },

  PLACEMENT_STATUS: {
    PLACED: 'placed',
    UNPLACED: 'unplaced',
    DEFERRED: 'deferred'
  },

  GENDERS: {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other'
  },

  // File constraints
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,

  // Rate limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  // JWT
  JWT_EXPIRY: '1h',
  JWT_REFRESH_EXPIRY: '7d',

  // Email templates
  EMAIL_TEMPLATES: {
    WELCOME: 'welcome',
    PASSWORD_RESET: 'password_reset',
    APPLICATION_UPDATE: 'application_update',
    JOB_ALERT: 'job_alert',
    EVENT_REMINDER: 'event_reminder'
  },

  // Error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE'
  },

  // Success messages
  SUCCESS_MESSAGES: {
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    JOB_CREATED: 'Job created successfully',
    JOB_UPDATED: 'Job updated successfully',
    APPLICATION_SUBMITTED: 'Application submitted successfully',
    APPLICATION_UPDATED: 'Application updated successfully',
    EVENT_CREATED: 'Event created successfully',
    EVENT_UPDATED: 'Event updated successfully',
    FILE_UPLOADED: 'File uploaded successfully',
    NOTIFICATION_SENT: 'Notification sent successfully'
  }
};