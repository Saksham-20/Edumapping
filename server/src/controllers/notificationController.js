// server/src/controllers/notificationController.js
const { Notification, User, StudentProfile, Organization, AuditLog } = require('../models');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Roles an admin may address an announcement to. 'all' means every active
// account except the sender.
const ANNOUNCE_ROLES = [
  'all', 'student', 'tpo', 'recruiter', 'principal', 'teacher', 'school_admin', 'career_counselor'
];

// Notification rows are written a few at a time rather than all at once: a
// campus-wide announcement is thousands of inserts, and firing them in one
// Promise.all would take every connection in the pool.
const WRITE_CONCURRENCY = 20;

const mapLimit = async (items, limit, fn) => {
  let cursor = 0;
  let failed = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        await fn(item);
      } catch (err) {
        failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return failed;
};

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Who an announcement reaches.
 *
 * A TPO can only ever address their own institution's students — the
 * organisation and role are fixed server-side whatever the body says. An admin
 * can address everyone, one organisation, one role, or a combination. The
 * academic filters (graduation year, branch) only mean something for students,
 * so supplying one narrows the audience to students.
 *
 * Returns `{ where, include, description }` or `{ error }`.
 */
const buildAudience = async (actor, audience = {}) => {
  const where = { isActive: true, id: { [Op.ne]: actor.id } };
  const profileWhere = {};
  const graduationYear = audience.graduationYear ? parseInt(audience.graduationYear, 10) : null;
  const branch = audience.branch ? String(audience.branch).trim() : '';
  if (graduationYear) profileWhere.graduationYear = graduationYear;
  // Case-insensitive exact match: branch names are free text on the profile
  // ("Computer Science Engineering" vs "computer science engineering").
  if (branch) profileWhere.branch = { [Op.iLike]: branch.replace(/[%_\\]/g, '\\$&') };

  let organization = null;
  if (actor.role === 'tpo') {
    if (!actor.organizationId) return { error: 'Your account is not attached to an institution' };
    where.organizationId = actor.organizationId;
    where.role = 'student';
    organization = actor.organization || null;
  } else {
    if (audience.organizationId) {
      organization = await Organization.findByPk(parseInt(audience.organizationId, 10), {
        attributes: ['id', 'name', 'type']
      });
      if (!organization) return { error: 'Organization not found' };
      where.organizationId = organization.id;
    }
    const role = audience.role || 'all';
    if (Object.keys(profileWhere).length > 0) {
      where.role = 'student';
    } else if (role !== 'all') {
      where.role = role;
    }
  }

  const include = Object.keys(profileWhere).length
    ? [{ model: StudentProfile, as: 'studentProfile', where: profileWhere, attributes: [], required: true }]
    : [];

  const parts = [];
  parts.push(where.role ? `${String(where.role).replace(/_/g, ' ')}s` : 'all users');
  if (organization) parts.push(`at ${organization.name}`);
  if (graduationYear) parts.push(`graduating ${graduationYear}`);
  if (branch) parts.push(`in ${branch}`);

  return {
    where,
    include,
    description: parts.join(' '),
    audience: {
      organizationId: organization?.id || null,
      role: where.role || 'all',
      graduationYear,
      branch: branch || null
    }
  };
};

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const { page = 1, limit = 20, isRead } = req.query;
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const offset = (pageNum - 1) * limitNum;
      const whereClause = { userId: req.user.id };

      if (isRead !== undefined) {
        whereClause.isRead = isRead === 'true';
      }

      // Filter out expired notifications
      whereClause[Op.or] = [
        { expiresAt: null },
        { expiresAt: { [Op.gte]: new Date() } }
      ];

      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: whereClause,
        limit: limitNum,
        offset,
        order: [['createdAt', 'DESC']]
      });

      res.json({
        message: 'Notifications retrieved successfully',
        notifications,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(count / limitNum),
          totalNotifications: count,
          hasMore: offset + notifications.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;

      const notification = await Notification.findOne({
        where: { id, userId: req.user.id }
      });

      if (!notification) {
        return res.status(404).json({
          error: 'Notification Not Found',
          message: 'Notification not found'
        });
      }

      await notification.update({ isRead: true });

      res.json({
        message: 'Notification marked as read',
        notification
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const [updatedCount] = await Notification.update(
        { isRead: true },
        { where: { userId: req.user.id, isRead: false } }
      );

      res.json({
        message: `${updatedCount} notifications marked as read`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /notifications/announce/preview — how many people an announcement
   * with this audience would reach, so the sender sees "42 students" before
   * pressing send rather than after.
   */
  async previewAnnouncement(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', message: errors.array()[0].msg, details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
      }
      const target = await buildAudience(req.user, req.body.audience);
      if (target.error) return res.status(400).json({ error: 'Invalid Audience', message: target.error });

      const recipients = await User.count({ where: target.where, include: target.include, distinct: true, col: 'id' });
      res.json({ message: 'Audience resolved', recipients, description: target.description });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /notifications/announce — a placement officer or admin telling
   * people something.
   *
   * There was no way to do this: notifications were only ever written as a
   * side effect of an application or job changing state, so "the TCS drive
   * moved to 10am" went out on WhatsApp instead of through the platform.
   *
   * Each recipient gets an in-app notification row (through the same
   * `createNotification` every other notice uses). Email is sent only when
   * SMTP is configured and the sender asked for it, after the response, and
   * never fails the request — the in-app notice is the record.
   */
  async announce(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', message: errors.array()[0].msg, details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
      }

      const { title, message, priority = 'medium', sendEmail = false } = req.body;
      const target = await buildAudience(req.user, req.body.audience);
      if (target.error) return res.status(400).json({ error: 'Invalid Audience', message: target.error });

      const users = await User.findAll({
        where: target.where,
        include: target.include,
        attributes: ['id', 'email', 'firstName']
      });

      if (users.length === 0) {
        return res.status(400).json({
          error: 'No Recipients',
          message: `Nobody matches this audience (${target.description}).`
        });
      }

      const sender = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
      const senderOrg = req.user.organization?.name || (req.user.role === 'admin' ? 'EduMapping' : null);
      const metadata = {
        kind: 'announcement',
        sentBy: { id: req.user.id, name: sender, role: req.user.role, organization: senderOrg },
        audience: target.audience
      };

      const failed = await mapLimit(users, WRITE_CONCURRENCY, (u) =>
        notificationService.createNotification(u.id, title, message, 'general', metadata, priority)
      );
      const delivered = users.length - failed;

      AuditLog.create({
        userId: req.user.id,
        action: 'announcement_sent',
        entityType: 'notification',
        entityId: null,
        newValues: {
          title,
          priority,
          audience: target.audience,
          description: target.description,
          recipients: delivered,
          failed,
          email: Boolean(sendEmail)
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch((err) => logger.error('Audit log failed', err));

      // Email only when a real SMTP host is configured. Without one the email
      // service falls back to a localhost:1025 transport that does not exist,
      // and outside production it "succeeds" with a mock id — either way
      // nothing would be delivered, so do not pretend it was.
      const emailConfigured = Boolean(process.env.SMTP_HOST);
      const emailQueued = sendEmail && emailConfigured ? users.length : 0;

      res.status(201).json({
        message: `Announcement sent to ${delivered} ${delivered === 1 ? 'person' : 'people'}`,
        recipients: delivered,
        failed,
        description: target.description,
        email: sendEmail
          ? emailConfigured
            ? { queued: emailQueued }
            : { queued: 0, skipped: 'Email delivery is not configured on this server' }
          : { queued: 0 }
      });

      if (emailQueued > 0) {
        const subject = senderOrg ? `${senderOrg}: ${title}` : title;
        const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${escapeHtml(title)}</h2>
          <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
          <p style="color:#666;font-size:12px;">Sent by ${escapeHtml(sender)}${senderOrg ? `, ${escapeHtml(senderOrg)}` : ''} via EduMapping.</p>
        </div>`;
        // Sequential, after the response: a slow SMTP relay must not hold the
        // request open, and a burst of parallel sends gets an account throttled.
        (async () => {
          let sent = 0;
          for (const u of users) {
            if (!u.email) continue;
            try {
              // eslint-disable-next-line no-await-in-loop
              await emailService.sendEmail(u.email, subject, html, `${title}\n\n${message}`);
              sent += 1;
            } catch (err) {
              logger.error('Announcement email failed', err, { userId: u.id });
            }
          }
          logger.info('Announcement emails finished', { sent, total: users.length, by: req.user.id });
        })();
      }
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const count = await Notification.count({
        where: {
          userId: req.user.id,
          isRead: false,
          [Op.or]: [
            { expiresAt: null },
            { expiresAt: { [Op.gte]: new Date() } }
          ]
        }
      });

      res.json({
        unreadCount: count
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();