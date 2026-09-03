// server/src/models/Offer.js
//
// An offer is the outcome of an application, held separately from it because it
// carries things an application status cannot: a salary, an acceptance, a
// revocation and a reason for it. `applications.status = 'selected'` says a
// placement happened; only this says what it was worth, whether the student
// took it, and whether it still stands.
module.exports = (sequelize, DataTypes) => {
  const Offer = sequelize.define(
    'Offer',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      applicationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'application_id',
        references: { model: 'applications', key: 'id' }
      },
      studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'student_id',
        references: { model: 'users', key: 'id' }
      },
      jobId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'job_id',
        references: { model: 'jobs', key: 'id' }
      },
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'organization_id',
        references: { model: 'organizations', key: 'id' }
      },
      ctc: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
        // DECIMAL comes back from pg as a string to avoid precision loss.
        // Callers want a number; the column keeps the precision either way.
        get() {
          const raw = this.getDataValue('ctc');
          return raw === null || raw === undefined ? null : parseFloat(raw);
        }
      },
      ctcBreakup: { type: DataTypes.JSON, field: 'ctc_breakup', defaultValue: {} },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      roleTitle: { type: DataTypes.STRING(255), field: 'role_title' },
      location: { type: DataTypes.STRING(255) },
      status: {
        type: DataTypes.ENUM('offered', 'accepted', 'declined', 'revoked'),
        allowNull: false,
        defaultValue: 'offered'
      },
      isPPO: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_ppo' },
      offerLetterUrl: { type: DataTypes.STRING(500), field: 'offer_letter_url' },
      offeredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'offered_at' },
      respondedAt: { type: DataTypes.DATE, field: 'responded_at' },
      revokedAt: { type: DataTypes.DATE, field: 'revoked_at' },
      revokedReason: { type: DataTypes.TEXT, field: 'revoked_reason' },
      joiningDate: { type: DataTypes.DATEONLY, field: 'joining_date' },
      notes: { type: DataTypes.TEXT },
      createdBy: { type: DataTypes.INTEGER, field: 'created_by', references: { model: 'users', key: 'id' } }
    },
    {
      tableName: 'offers',
      underscored: true,
      timestamps: true
    }
  );

  /** An offer still on the table, or taken. Anything else does not count as a placement. */
  Offer.LIVE_STATUSES = ['offered', 'accepted'];

  Offer.associate = (models) => {
    Offer.belongsTo(models.Application, { foreignKey: 'applicationId', as: 'application' });
    Offer.belongsTo(models.User, { foreignKey: 'studentId', as: 'student' });
    Offer.belongsTo(models.Job, { foreignKey: 'jobId', as: 'job' });
    Offer.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    Offer.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
  };

  return Offer;
};
