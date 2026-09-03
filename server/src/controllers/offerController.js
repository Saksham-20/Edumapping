// server/src/controllers/offerController.js
//
// The lifecycle of an offer: raised by the company or the placement cell,
// answered by the student, and revocable by whoever raised it.
//
// Placement status is derived from offers here rather than from
// `applications.status = 'selected'`, because an offer can be revoked and a
// selection cannot. A student whose only offer was withdrawn is not placed, and
// a placement rate that says otherwise is the exact kind of number this codebase
// has been cleaning up.

const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const models = require('../models');
const { Offer, Application, Job, User, Organization, StudentProfile, AuditLog } = models;
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { syncPlacementStatus } = require('../utils/placementStatus');

// Placement status has one definition, shared with the application flow.
const syncPlacementFromOffers = (studentId) => syncPlacementStatus(studentId, models);

/** May this user act on offers for this job's organisation? */
const canManage = (user, job) => {
  if (user.role === 'admin') return true;
  if (user.role === 'tpo') return true;
  return user.role === 'recruiter' && job.organizationId === user.organizationId;
};

class OfferController {
  /**
   * Raise an offer against an application.
   *
   * The application is moved to `selected` at the same time, so the pipeline and
   * the offer cannot disagree about whether this student got the job.
   */
  async createOffer(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array() });
      }

      const { applicationId, ctc, ctcBreakup, currency, roleTitle, location, isPPO, joiningDate, notes } = req.body;

      const application = await Application.findByPk(applicationId, {
        include: [{ model: Job, as: 'job' }]
      });
      if (!application) {
        return res.status(404).json({ error: 'Application Not Found', message: 'Application not found' });
      }
      if (!canManage(req.user, application.job)) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only raise offers for your own organization\'s jobs'
        });
      }
      if (application.status === 'withdrawn') {
        return res.status(409).json({
          error: 'Application Withdrawn',
          message: 'This student withdrew their application'
        });
      }

      const existing = await Offer.findOne({ where: { applicationId } });
      if (existing) {
        return res.status(409).json({
          error: 'Offer Exists',
          message: 'This application already has an offer'
        });
      }

      const offer = await Offer.create({
        applicationId,
        studentId: application.studentId,
        jobId: application.jobId,
        organizationId: application.job.organizationId,
        ctc: ctc ?? null,
        ctcBreakup: ctcBreakup || {},
        currency: currency || 'INR',
        roleTitle: roleTitle || application.job.title,
        location: location || application.job.location,
        isPPO: Boolean(isPPO),
        joiningDate: joiningDate || null,
        notes: notes || null,
        createdBy: req.user.id
      });

      // Keep the pipeline honest: an offer exists, so the application is a
      // selection whatever it said a moment ago.
      await application.update({ status: 'selected', resultAt: new Date() });
      await syncPlacementFromOffers(application.studentId);

      const full = await Offer.findByPk(offer.id, {
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name', 'logoUrl'] },
          { model: Job, as: 'job', attributes: ['id', 'title'] }
        ]
      });

      res.status(201).json({ message: 'Offer raised successfully', offer: full });

      notificationService
        .createNotification(
          application.studentId,
          'You have an offer',
          `${application.job.title} at ${full.organization?.name || 'a company'}.${
            ctc ? ` CTC ${currency || 'INR'} ${Number(ctc).toLocaleString('en-IN')}.` : ''
          }`,
          'application_update',
          { offerId: offer.id, jobId: application.jobId },
          'urgent'
        )
        .catch((err) => logger.error('Offer notification failed', err));

      AuditLog.create({
        userId: req.user.id,
        action: 'offer_raised',
        entityType: 'offer',
        entityId: offer.id,
        newValues: { applicationId, studentId: application.studentId, ctc: ctc ?? null },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch(() => {});
    } catch (error) {
      next(error);
    }
  }

  /**
   * List offers, scoped by who is asking.
   *
   * A student sees their own. A recruiter sees the ones their organisation
   * raised. A TPO sees the ones held by their own students, which is the view
   * the placement report is built from.
   */
  async getOffers(req, res, next) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
      const offset = (parseInt(page, 10) - 1) * limitNum;

      const where = {};
      if (status) where.status = status;

      if (req.user.role === 'student') {
        where.studentId = req.user.id;
      } else if (req.user.role === 'recruiter') {
        where.organizationId = req.user.organizationId;
      } else if (req.user.role === 'tpo') {
        const students = await User.findAll({
          where: { organizationId: req.user.organizationId, role: 'student' },
          attributes: ['id']
        });
        where.studentId = { [Op.in]: students.map((s) => s.id) };
      }

      const { count, rows } = await Offer.findAndCountAll({
        where,
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name', 'logoUrl'] },
          { model: Job, as: 'job', attributes: ['id', 'title', 'jobType'] },
          {
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            include: [{ model: StudentProfile, as: 'studentProfile', attributes: ['studentId', 'branch'] }]
          }
        ],
        order: [['offeredAt', 'DESC']],
        limit: limitNum,
        offset,
        distinct: true
      });

      res.json({
        message: 'Offers retrieved successfully',
        offers: rows,
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
   * Accept or decline an offer. The student's decision, and only theirs.
   */
  async respondToOffer(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array() });
      }

      const { id } = req.params;
      const { action } = req.body;

      const offer = await Offer.findByPk(id, {
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }]
      });
      if (!offer) {
        return res.status(404).json({ error: 'Offer Not Found', message: 'Offer not found' });
      }
      if (offer.studentId !== req.user.id) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only respond to your own offers'
        });
      }
      if (offer.status !== 'offered') {
        return res.status(409).json({
          error: 'Already Resolved',
          message: `This offer is already ${offer.status}`
        });
      }

      await offer.update({
        status: action === 'accept' ? 'accepted' : 'declined',
        respondedAt: new Date()
      });
      await syncPlacementFromOffers(offer.studentId);

      res.json({
        message: action === 'accept' ? 'Offer accepted' : 'Offer declined',
        offer
      });

      AuditLog.create({
        userId: req.user.id,
        action: action === 'accept' ? 'offer_accepted' : 'offer_declined',
        entityType: 'offer',
        entityId: offer.id,
        newValues: { status: offer.status },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch(() => {});
    } catch (error) {
      next(error);
    }
  }

  /**
   * Withdraw an offer that was already made.
   *
   * A reason is required. An offer disappearing without explanation is the
   * single worst thing that can happen to a student on a placement portal, and
   * the reason is what the placement cell needs in order to challenge it.
   */
  async revokeOffer(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation Error', details: errors.array() });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const offer = await Offer.findByPk(id, {
        include: [
          { model: Job, as: 'job' },
          { model: Organization, as: 'organization', attributes: ['id', 'name'] }
        ]
      });
      if (!offer) {
        return res.status(404).json({ error: 'Offer Not Found', message: 'Offer not found' });
      }
      if (!canManage(req.user, offer.job)) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You cannot revoke this offer'
        });
      }
      if (offer.status === 'revoked') {
        return res.status(409).json({ error: 'Already Revoked', message: 'This offer is already revoked' });
      }

      await offer.update({ status: 'revoked', revokedAt: new Date(), revokedReason: reason });
      // The student may well be unplaced again as a result. That is the point:
      // a revoked offer must not keep propping up a placement rate.
      await syncPlacementFromOffers(offer.studentId);

      res.json({ message: 'Offer revoked', offer });

      notificationService
        .createNotification(
          offer.studentId,
          'An offer has been withdrawn',
          `${offer.organization?.name || 'The company'} withdrew the offer for ${offer.roleTitle || 'a role'}. Reason: ${reason}`,
          'application_update',
          { offerId: offer.id },
          'urgent'
        )
        .catch((err) => logger.error('Revocation notification failed', err));

      AuditLog.create({
        userId: req.user.id,
        action: 'offer_revoked',
        entityType: 'offer',
        entityId: offer.id,
        newValues: { reason },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent')
      }).catch(() => {});
    } catch (error) {
      next(error);
    }
  }

  /**
   * Salary statistics for an institution's offers.
   *
   * Median rather than only mean, because one outlier package distorts a mean
   * badly and the median is what NIRF's Graduation Outcomes section asks for.
   * Revoked and declined offers are excluded — they are not placements.
   */
  async getOfferStats(req, res, next) {
    try {
      const where = { status: { [Op.in]: Offer.LIVE_STATUSES } };

      if (req.user.role === 'tpo') {
        const students = await User.findAll({
          where: { organizationId: req.user.organizationId, role: 'student' },
          attributes: ['id']
        });
        where.studentId = { [Op.in]: students.map((s) => s.id) };
      } else if (req.user.role === 'recruiter') {
        where.organizationId = req.user.organizationId;
      }

      const offers = await Offer.findAll({
        where,
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
        order: [['ctc', 'DESC']]
      });

      const packages = offers
        .map((o) => o.ctc)
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
        .sort((a, b) => a - b);

      const median = packages.length
        ? packages.length % 2
          ? packages[(packages.length - 1) / 2]
          : (packages[packages.length / 2 - 1] + packages[packages.length / 2]) / 2
        : null;

      res.json({
        message: 'Offer statistics retrieved successfully',
        stats: {
          total: offers.length,
          accepted: offers.filter((o) => o.status === 'accepted').length,
          pending: offers.filter((o) => o.status === 'offered').length,
          ppo: offers.filter((o) => o.isPPO).length,
          // Null rather than 0 when nothing is known: a median of zero would be
          // read as "everyone got nothing" instead of "no salaries recorded".
          withCtc: packages.length,
          medianCtc: median,
          averageCtc: packages.length
            ? Math.round((packages.reduce((a, b) => a + b, 0) / packages.length) * 100) / 100
            : null,
          highestCtc: packages.length ? packages[packages.length - 1] : null,
          lowestCtc: packages.length ? packages[0] : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OfferController();
module.exports.syncPlacementFromOffers = syncPlacementFromOffers;
