const { User, Organization, RecruiterProfile } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class ApprovalController {
  // Get pending approvals for TPO
  async getPendingApprovals(req, res, next) {
    try {
      const { organizationId } = req.user;
      
      if (!organizationId) {
        return res.status(400).json({
          error: 'Organization Not Found',
          message: 'User is not associated with any organization'
        });
      }

      const [pendingOrganizations, pendingRecruiters] = await Promise.all([
        // Get pending company organizations
        Organization.findAll({
          where: {
            type: 'company',
            approvalStatus: 'pending'
          },
          include: [
            {
              model: User,
              as: 'users',
              where: { role: 'recruiter' },
              attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt'],
              required: false
            }
          ],
          order: [['createdAt', 'ASC']]
        }),

        // Get pending recruiter users
        User.findAll({
          where: {
            role: 'recruiter',
            approvalStatus: 'pending',
            organizationId: {
              [Op.ne]: organizationId // Exclude TPO's own organization
            }
          },
          include: [
            {
              model: Organization,
              as: 'organization',
              attributes: ['id', 'name', 'type', 'logoUrl']
            },
            {
              model: RecruiterProfile,
              as: 'recruiterProfile',
              attributes: ['designation', 'department', 'experience']
            }
          ],
          order: [['createdAt', 'ASC']]
        })
      ]);

      res.json({
        message: 'Pending approvals retrieved successfully',
        data: {
          organizations: pendingOrganizations,
          recruiters: pendingRecruiters,
          total: pendingOrganizations.length + pendingRecruiters.length
        }
      });
    } catch (error) {
      logger.error('Error in getPendingApprovals', error);
      next(error);
    }
  }

  // Approve/reject organization
  async approveOrganization(req, res, next) {
    try {
      const { organizationId } = req.params;
      const { action, notes } = req.body; // action: 'approve' or 'reject'
      const { id: approverId } = req.user;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid Action',
          message: 'Action must be either "approve" or "reject"'
        });
      }

      const organization = await Organization.findByPk(organizationId);
      if (!organization) {
        return res.status(404).json({
          error: 'Organization Not Found',
          message: 'Organization not found'
        });
      }

      if (organization.approvalStatus !== 'pending') {
        return res.status(400).json({
          error: 'Invalid Status',
          message: 'Organization is not pending approval'
        });
      }

      const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
      const updateData = {
        approvalStatus,
        approvedBy: approverId,
        approvedAt: new Date(),
        approvalNotes: notes || null
      };

      await organization.update(updateData);

      // If approved, also approve all recruiter users in the organization
      if (action === 'approve') {
        await User.update(
          {
            approvalStatus: 'approved',
            approvedBy: approverId,
            approvedAt: new Date()
          },
          {
            where: {
              organizationId,
              role: 'recruiter',
              approvalStatus: 'pending'
            }
          }
        );
      }

      res.json({
        message: `Organization ${action}d successfully`,
        organization: {
          id: organization.id,
          name: organization.name,
          approvalStatus: organization.approvalStatus,
          approvedAt: organization.approvedAt
        }
      });
    } catch (error) {
      logger.error('Error in approveOrganization', error);
      next(error);
    }
  }

  // Approve/reject individual recruiter
  async approveRecruiter(req, res, next) {
    try {
      const { userId } = req.params;
      const { action, notes } = req.body; // action: 'approve' or 'reject'
      const { id: approverId } = req.user;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid Action',
          message: 'Action must be either "approve" or "reject"'
        });
      }

      const user = await User.findByPk(userId, {
        include: [
          {
            model: Organization,
            as: 'organization',
            attributes: ['id', 'name', 'type']
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'User not found'
        });
      }

      if (user.role !== 'recruiter') {
        return res.status(400).json({
          error: 'Invalid User Role',
          message: 'User is not a recruiter'
        });
      }

      if (user.approvalStatus !== 'pending') {
        return res.status(400).json({
          error: 'Invalid Status',
          message: 'User is not pending approval'
        });
      }

      const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
      const updateData = {
        approvalStatus,
        approvedBy: approverId,
        approvedAt: new Date(),
        approvalNotes: notes || null
      };

      await user.update(updateData);

      res.json({
        message: `Recruiter ${action}d successfully`,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          organization: user.organization?.name,
          approvalStatus: user.approvalStatus,
          approvedAt: user.approvedAt
        }
      });
    } catch (error) {
      logger.error('Error in approveRecruiter', error);
      next(error);
    }
  }

  // Bulk approve/reject organizations
  async bulkApproveOrganizations(req, res, next) {
    try {
      const { organizationIds, action, notes } = req.body;
      const { id: approverId } = req.user;

      if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
        return res.status(400).json({
          error: 'Invalid Data',
          message: 'Organization IDs must be provided as an array'
        });
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid Action',
          message: 'Action must be either "approve" or "reject"'
        });
      }

      const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
      const updateData = {
        approvalStatus,
        approvedBy: approverId,
        approvedAt: new Date(),
        approvalNotes: notes || null
      };

      // Update organizations
      const [updatedOrgs] = await Organization.update(updateData, {
        where: {
          id: { [Op.in]: organizationIds },
          approvalStatus: 'pending'
        }
      });

      // If approved, also approve all recruiter users in these organizations
      if (action === 'approve') {
        await User.update(
          {
            approvalStatus: 'approved',
            approvedBy: approverId,
            approvedAt: new Date()
          },
          {
            where: {
              organizationId: { [Op.in]: organizationIds },
              role: 'recruiter',
              approvalStatus: 'pending'
            }
          }
        );
      }

      res.json({
        message: `${updatedOrgs} organizations ${action}d successfully`,
        updatedCount: updatedOrgs
      });
    } catch (error) {
      logger.error('Error in bulkApproveOrganizations', error);
      next(error);
    }
  }

  // Get approval statistics for TPO
  async getApprovalStats(req, res, next) {
    try {
      const { organizationId } = req.user;
      
      if (!organizationId) {
        return res.status(400).json({
          error: 'Organization Not Found',
          message: 'User is not associated with any organization'
        });
      }

      const [orgStats, recruiterStats, recentApprovals] = await Promise.all([
        // Organization approval statistics (only companies)
        Organization.findAll({
          where: { 
            type: 'company',
            approvalStatus: { [Op.ne]: null }
          },
          attributes: [
            'approvalStatus',
            [Organization.sequelize.fn('COUNT', Organization.sequelize.col('id')), 'count']
          ],
          group: ['approvalStatus'],
          raw: true
        }),

        // Recruiter approval statistics (only from companies)
        User.findAll({
          where: { 
            role: 'recruiter',
            organizationId: { [Op.ne]: organizationId },
            approvalStatus: { [Op.ne]: null }
          },
          include: [
            {
              model: Organization,
              as: 'organization',
              where: { type: 'company' },
              attributes: []
            }
          ],
          attributes: [
            'approvalStatus',
            [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
          ],
          group: ['approvalStatus'],
          raw: true
        }),

        // Recent approvals (only companies)
        Organization.findAll({
          where: {
            type: 'company',
            approvalStatus: { [Op.in]: ['approved', 'rejected'] }
          },
          include: [
            {
              model: User,
              as: 'approver',
              attributes: ['firstName', 'lastName']
            }
          ],
          order: [['approvedAt', 'DESC']],
          limit: 10
        })
      ]);

      res.json({
        message: 'Approval statistics retrieved successfully',
        stats: {
          organizations: orgStats,
          recruiters: recruiterStats,
          recentApprovals
        }
      });
    } catch (error) {
      logger.error('Error in getApprovalStats', error);
      next(error);
    }
  }
}

module.exports = new ApprovalController();
