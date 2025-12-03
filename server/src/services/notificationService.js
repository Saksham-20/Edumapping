// server/src/services/notificationService.js
const { Notification, User, Application, Job, Organization } = require('../models');
const emailService = require('./emailService');
const logger = require('../utils/logger');

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