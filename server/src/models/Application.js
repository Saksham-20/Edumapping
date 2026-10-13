// server/src/models/Application.js
module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define('Application', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    jobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'job_id',
      references: {
        model: 'jobs',
        key: 'id'
      }
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'student_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    resumeUrl: {
      type: DataTypes.STRING(500),
      field: 'resume_url'
    },
    coverLetter: {
      type: DataTypes.TEXT,
      field: 'cover_letter'
    },
    status: {
      type: DataTypes.ENUM(
        'applied', 'screening', 'shortlisted', 'interviewed', 
        'selected', 'rejected', 'withdrawn'
      ),
      defaultValue: 'applied'
    },
    appliedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'applied_at'
    },
    shortlistedAt: {
      type: DataTypes.DATE,
      field: 'shortlisted_at'
    },
    interviewedAt: {
      type: DataTypes.DATE,
      field: 'interviewed_at'
    },
    resultAt: {
      type: DataTypes.DATE,
      field: 'result_at'
    },
    feedback: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'applications',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['job_id', 'student_id']
      }
    ]
  });

  Application.associate = (models) => {
    Application.hasMany(models.RoundParticipant, { foreignKey: 'applicationId', as: 'roundParticipations' });
    Application.belongsTo(models.Job, {
      foreignKey: 'jobId',
      as: 'job'
    });
    Application.belongsTo(models.User, {
      foreignKey: 'studentId',
      as: 'student'
    });
  };

  return Application;
};