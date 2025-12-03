// server/src/controllers/achievementController.js
const { Achievement, User } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class AchievementController {
  async getAllAchievements(req, res, next) {
    try {
      const { userId } = req.query;
      
      const whereClause = {};
      if (userId) whereClause.userId = userId;

      const achievements = await Achievement.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['issueDate', 'DESC']]
      });

      res.json({
        message: 'Achievements retrieved successfully',
        achievements
      });
    } catch (error) {
      next(error);
    }
  }

  async getAchievementById(req, res, next) {
    try {
      const { id } = req.params;

      const achievement = await Achievement.findByPk(id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      if (!achievement) {
        return res.status(404).json({
          error: 'Achievement Not Found',
          message: 'Achievement not found'
        });
      }

      res.json({
        message: 'Achievement retrieved successfully',
        achievement
      });
    } catch (error) {
      next(error);
    }
  }

  async createAchievement(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.debug('Validation errors', { errors: errors.array() });
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user.id;
      const achievementData = {
        userId,
        ...req.body
      };

      logger.info('Creating achievement', { userId: achievementData.userId });

      const achievement = await Achievement.create(achievementData);

      const createdAchievement = await Achievement.findByPk(achievement.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      res.status(201).json({
        message: 'Achievement created successfully',
        achievement: createdAchievement
      });
    } catch (error) {
      logger.error('Achievement creation error', error);
      next(error);
    }
  }

  async updateAchievement(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;

      const achievement = await Achievement.findByPk(id);

      if (!achievement) {
        return res.status(404).json({
          error: 'Achievement Not Found',
          message: 'Achievement not found'
        });
      }

      // Check if user owns this achievement (unless admin/tpo)
      if (achievement.userId !== userId && !['admin', 'tpo'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own achievements'
        });
      }

      await achievement.update(req.body);

      const updatedAchievement = await Achievement.findByPk(id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      res.json({
        message: 'Achievement updated successfully',
        achievement: updatedAchievement
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAchievement(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const achievement = await Achievement.findByPk(id);

      if (!achievement) {
        return res.status(404).json({
          error: 'Achievement Not Found',
          message: 'Achievement not found'
        });
      }

      // Check if user owns this achievement (unless admin/tpo)
      if (achievement.userId !== userId && !['admin', 'tpo'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own achievements'
        });
      }

      await achievement.destroy();

      res.json({
        message: 'Achievement deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserAchievements(req, res, next) {
    try {
      const userId = req.params.userId || req.user.id;

      const achievements = await Achievement.findAll({
        where: { userId },
        order: [['issueDate', 'DESC']]
      });

      res.json({
        message: 'User achievements retrieved successfully',
        achievements
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyAchievement(req, res, next) {
    try {
      const { id } = req.params;
      const { isVerified } = req.body;

      // Only admin/tpo can verify achievements
      if (!['admin', 'tpo'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only administrators can verify achievements'
        });
      }

      const achievement = await Achievement.findByPk(id);

      if (!achievement) {
        return res.status(404).json({
          error: 'Achievement Not Found',
          message: 'Achievement not found'
        });
      }

      await achievement.update({ isVerified });

      res.json({
        message: `Achievement ${isVerified ? 'verified' : 'unverified'} successfully`,
        achievement
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AchievementController();