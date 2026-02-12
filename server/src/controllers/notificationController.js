// server/src/controllers/notificationController.js
const { Notification } = require('../models');
const { Op } = require('sequelize'); // Add this import

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