// server/src/controllers/achievementController.js
const { Achievement, User } = require('../models');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const accessService = require('../services/accessService');

// What a student writes about their own achievement. `isVerified` is the
// institution's stamp and `userId` is decided by the session; both used to be
// accepted from the body, so a student could self-verify, or file an
// achievement under somebody else's name.
const ACHIEVEMENT_FIELDS = [
  'title',
  'description',
  'achievementType',
  'issuingOrganization',
  'issueDate',
  'expiryDate',
  'credentialUrl'
];

const pickAchievementFields = (body) => {
  const out = {};
  for (const field of ACHIEVEMENT_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
};

const notFound = (res) =>
  res.status(404).json({ error: 'Achievement Not Found', message: 'Achievement not found' });

/**
 * May this user change (edit, delete, verify) an achievement owned by `owner`?
 * The owner may edit their own; staff only for students of their own
 * institution; admins anything. `tpo` alone used to be enough to edit, delete
 * or verify any student's achievements on the platform.
 */
const canModerate = (user, owner) =>
  user.role === 'admin' || accessService.isSameInstitutionStaff(user, owner);

class AchievementController {
  async getAllAchievements(req, res, next) {
    try {
      const { userId } = req.query;

      // This listing returned every achievement on the platform — with each
      // owner's name and email — to any signed-in user. A specific user's
      // list goes through the shared visibility rule; without one the result
      // is scoped to what the caller may already see.
      const whereClause = {};
      const userInclude = {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email']
      };

      if (userId) {
        const target = await User.findByPk(userId, { attributes: ['id', 'role', 'organizationId'] });
        if (!target || !(await accessService.canViewUser(req.user, target))) {
          return res.json({ message: 'Achievements retrieved successfully', achievements: [] });
        }
        whereClause.userId = target.id;
      } else if (req.user.role === 'admin') {
        // everything
      } else if (accessService.INSTITUTION_STAFF_ROLES.includes(req.user.role) && req.user.organizationId) {
        userInclude.where = { organizationId: req.user.organizationId };
        userInclude.required = true;
      } else {
        // Students — and recruiters, who should ask about one candidate at a
        // time through `userId` — see their own.
        whereClause.userId = req.user.id;
      }

      const achievements = await Achievement.findAll({
        where: whereClause,
        include: [userInclude],
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

      // 404 for out of scope too, so ids belonging to others are not confirmed.
      if (!achievement || !(await accessService.canViewUser(req.user, achievement.userId))) {
        return notFound(res);
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
          details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
      }

      const userId = req.user.id;
      const achievementData = {
        ...pickAchievementFields(req.body),
        userId
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
          details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
      }

      const { id } = req.params;
      const userId = req.user.id;

      const achievement = await Achievement.findByPk(id, {
        include: [{ model: User, as: 'user', attributes: ['id', 'role', 'organizationId'] }]
      });

      if (!achievement) return notFound(res);

      if (achievement.userId !== userId && !canModerate(req.user, achievement.user)) {
        return notFound(res);
      }

      // Editing the claim un-verifies it: the institution vouched for what was
      // there, not for whatever it was changed into. Verification itself only
      // happens through PATCH /:id/verify.
      const updates = pickAchievementFields(req.body);
      if (achievement.isVerified && achievement.userId === userId && Object.keys(updates).length) {
        updates.isVerified = false;
      }
      await achievement.update(updates);

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

      const achievement = await Achievement.findByPk(id, {
        include: [{ model: User, as: 'user', attributes: ['id', 'role', 'organizationId'] }]
      });

      if (!achievement) return notFound(res);

      if (achievement.userId !== userId && !canModerate(req.user, achievement.user)) {
        return notFound(res);
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

      // Same rule as the profile (accessService): this returned anybody's
      // achievements to anybody signed in.
      const target = await User.findByPk(userId, { attributes: ['id', 'role', 'organizationId'] });
      if (!target || !(await accessService.canViewUser(req.user, target))) {
        return res.status(404).json({ error: 'User Not Found', message: 'User not found' });
      }

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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
      }

      const { id } = req.params;
      const { isVerified } = req.body;

      // An institution vouches only for its own students. Any TPO used to be
      // able to verify any student's achievement on the platform.
      const achievement = await Achievement.findByPk(id, {
        include: [{ model: User, as: 'user', attributes: ['id', 'role', 'organizationId'] }]
      });

      if (!achievement || !canModerate(req.user, achievement.user)) return notFound(res);

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