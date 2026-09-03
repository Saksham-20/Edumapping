// server/src/models/Job.js
module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define('Job', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    organizationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'organization_id',
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    requirements: {
      type: DataTypes.TEXT
    },
    jobType: {
      type: DataTypes.ENUM('internship', 'full_time', 'part_time'),
      allowNull: false,
      field: 'job_type'
    },
    location: {
      type: DataTypes.STRING(255)
    },
    salaryMin: {
      type: DataTypes.INTEGER,
      field: 'salary_min'
    },
    salaryMax: {
      type: DataTypes.INTEGER,
      field: 'salary_max'
    },
    experienceRequired: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'experience_required'
    },
    skillsRequired: {
      type: DataTypes.JSON,
      defaultValue: [],
      field: 'skills_required'
    },
    totalPositions: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'total_positions'
    },
    applicationDeadline: {
      type: DataTypes.DATEONLY,
      field: 'application_deadline'
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending_review', 'active', 'closed', 'cancelled'),
      defaultValue: 'draft'
    },
    // Who cleared this posting for publication, and why they did or did not.
    reviewedBy: {
      type: DataTypes.INTEGER,
      field: 'reviewed_by',
      references: { model: 'users', key: 'id' }
    },
    reviewedAt: {
      type: DataTypes.DATE,
      field: 'reviewed_at'
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      field: 'review_notes'
    },
    eligibilityCriteria: {
      type: DataTypes.JSON,
      defaultValue: {},
      field: 'eligibility_criteria'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // Incremented on each detail-page view by someone other than the job's
    // own recruiter. Feeds the recruiter dashboard's views and conversion
    // tiles, which previously read a column that did not exist.
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'view_count'
    }
  }, {
    tableName: 'jobs',
    underscored: true,
    timestamps: true
  });

  Job.associate = (models) => {
    Job.belongsTo(models.Organization, {
      foreignKey: 'organizationId',
      as: 'organization'
    });
    Job.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
    Job.hasMany(models.Application, {
      foreignKey: 'jobId',
      as: 'applications'
    });
    Job.hasOne(models.Assessment, {
      foreignKey: 'jobId',
      as: 'assessment'
    });
  };

  return Job;
};
