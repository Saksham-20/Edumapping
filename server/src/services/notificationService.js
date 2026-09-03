// server/src/services/notificationService.js
// `Event` was missing here while notifyEventReminder referenced it — the method
// would have thrown a ReferenceError on its first call. It had no callers, so
// nothing ever found out.
const { Notification, User, Application, Job, Organization, Event, StudentProfile } = require('../models');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const { checkEligibility } = require('../utils/eligibility');

class NotificationService {
  async createNotification(userId, title, message, type = 'general', metadata = {}, priority = 'medium') {
    try {
      const notification = await Notification.create({
        userId,
        title,
        message,
        notificationType: type,
        metadata,
        priority
      });

      return notification;
    } catch (error) {
      logger.error('Error creating notification', error, { userId, type });
      throw error;
    }
  }

  async notifyNewApplication(applicationId) {
    try {
      const application = await Application.findByPk(applicationId, {
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

      if (!application) return;

      const job = application.job;
      const student = application.student;
      const company = job.organization;

      // Find recruiters from the same organization
      const recruiters = await User.findAll({
        where: {
          role: 'recruiter',
          organizationId: company.id,
          isActive: true
        }
      });

      // Notify each recruiter
      for (const recruiter of recruiters) {
        await this.createNotification(
          recruiter.id,
          'New Job Application',
          `${student.firstName} ${student.lastName} has applied for ${job.title}`,
          'application_update',
          { jobId: job.id, applicationId: application.id },
          'medium'
        );
      }
    } catch (error) {
      logger.error('Error notifying new application', error, { applicationId });
    }
  }

  async notifyApplicationStatusUpdate(applicationId, newStatus) {
    try {
      const application = await Application.findByPk(applicationId, {
        include: [
          {
            model: Job,
            as: 'job',
            include: [{ model: Organization, as: 'organization' }]
          },
          {
            model: User,
            as: 'student'
          }
        ]
      });

      if (!application) return;

      const job = application.job;
      const student = application.student;
      const company = job.organization;

      const statusMessages = {
        shortlisted: `Congratulations! Your application for ${job.title} at ${company.name} has been shortlisted.`,
        interviewed: `Your interview for ${job.title} at ${company.name} has been scheduled.`,
        selected: `Congratulations! You have been selected for ${job.title} at ${company.name}.`,
        rejected: `Your application for ${job.title} at ${company.name} was not successful this time.`
      };

      const priority = newStatus === 'selected' ? 'high' : 
                      newStatus === 'rejected' ? 'medium' : 'medium';

      // Create notification
      await this.createNotification(
        student.id,
        'Application Status Update',
        statusMessages[newStatus] || `Your application status has been updated to ${newStatus}`,
        'application_update',
        { jobId: job.id, applicationId: application.id },
        priority
      );

      // Send email notification
      try {
        await emailService.sendApplicationStatusUpdate(application, newStatus);
      } catch (emailError) {
        logger.error('Error sending email notification', emailError, { applicationId });
      }
    } catch (error) {
      logger.error('Error notifying application status update', error, { applicationId, status });
    }
  }

  async notifyJobAlert(userId, jobId) {
    try {
      const user = await User.findByPk(userId);
      const job = await Job.findByPk(jobId, {
        include: [{ model: Organization, as: 'organization' }]
      });

      if (!user || !job) return;

      const company = job.organization;

      await this.createNotification(
        userId,
        'New Job Opportunity',
        `A new job matching your profile: ${job.title} at ${company.name}`,
        'job_alert',
        { jobId: job.id },
        'medium'
      );

      // Send email alert
      try {
        await emailService.sendNewJobAlert(user, job);
      } catch (emailError) {
        logger.error('Error sending job alert email', emailError, { userId, jobId });
      }
    } catch (error) {
      logger.error('Error sending job alert', error, { userId, jobId });
    }
  }

  /**
   * Alert the students who are actually eligible for a newly published job.
   *
   * `notifyJobAlert` has existed since the notification service was written and
   * had no caller, so posting a job told nobody — a student only ever found a
   * new opening by going and looking for it.
   *
   * Eligibility is evaluated per student against the job's criteria, so this
   * does not spam a whole campus with a role none of them can apply for.
   * Returns the number notified.
   */
  async notifyEligibleStudentsOfJob(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job || job.status !== 'active') return 0;

    const students = await User.findAll({
      where: { role: 'student', isActive: true },
      include: [
        // `required: true` — a student with no profile has no CGPA, branch or
        // batch to match against, so `checkEligibility` would wave them
        // through. That is the right answer when deciding whether to BLOCK an
        // application (absent data must not be read as a low score) but the
        // wrong one here: alerting someone we know nothing about is spam.
        { model: StudentProfile, as: 'studentProfile', required: true },
        // School students have no jobs surface at all — the app hides the whole
        // section from them — so a full-time vacancy is not something to put in
        // front of a Year 9 pupil.
        {
          model: Organization,
          as: 'organization',
          required: false,
          attributes: ['id', 'type']
        }
      ],
      attributes: ['id']
    });

    const eligible = students.filter(
      (student) =>
        student.organization?.type !== 'school' &&
        checkEligibility(job.eligibilityCriteria, student.studentProfile).eligible
    );

    // Sequentially rather than all at once: this fans out one database write
    // and one email per student, and a large campus would otherwise open
    // hundreds of concurrent connections the moment a job is posted.
    for (const student of eligible) {
      // eslint-disable-next-line no-await-in-loop
      await this.notifyJobAlert(student.id, jobId);
    }

    logger.info('Job alert fan-out complete', {
      jobId,
      considered: students.length,
      notified: eligible.length
    });
    return eligible.length;
  }

  async notifyEventReminder(userId, eventId) {
    try {
      const user = await User.findByPk(userId);
      const event = await Event.findByPk(eventId, {
        include: [{ model: Organization, as: 'organization' }]
      });

      if (!user || !event) return;

      const eventDate = new Date(event.startTime).toLocaleDateString();

      await this.createNotification(
        userId,
        'Event Reminder',
        `Reminder: ${event.title} is scheduled for ${eventDate}`,
        'event_reminder',
        { eventId: event.id },
        'medium'
      );

      // Send email reminder
      try {
        await emailService.sendEventReminder(user, event);
      } catch (emailError) {
        logger.error('Error sending event reminder email', emailError, { userId, eventId });
      }
    } catch (error) {
      logger.error('Error sending event reminder', error, { userId, eventId });
    }
  }

  async sendSystemAlert(title, message, userIds = [], priority = 'low') {
    try {
      let targetUsers = [];

      if (userIds.length > 0) {
        targetUsers = userIds;
      } else {
        // Send to all active users
        const users = await User.findAll({
          where: { isActive: true },
          attributes: ['id']
        });
        targetUsers = users.map(user => user.id);
      }

      const notifications = targetUsers.map(userId => ({
        userId,
        title,
        message,
        notificationType: 'system_alert',
        priority,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await Notification.bulkCreate(notifications);
    } catch (error) {
      logger.error('Error sending system alert', error);
    }
  }

  async cleanupExpiredNotifications() {
    try {
      const deletedCount = await Notification.destroy({
        where: {
          expiresAt: {
            [Op.lt]: new Date()
          }
        }
      });

      logger.info('Cleaned up expired notifications', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up notifications', error);
    }
  }

  async markNotificationAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (notification) {
        await notification.update({ isRead: true });
        return notification;
      }

      return null;
    } catch (error) {
      logger.error('Error marking notification as read', error, { notificationId, userId });
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      const count = await Notification.count({
        where: {
          userId,
          isRead: false,
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gte]: new Date() } }
          ]
        }
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread count', error, { userId });
      return 0;
    }
  }
}

module.exports = new NotificationService();