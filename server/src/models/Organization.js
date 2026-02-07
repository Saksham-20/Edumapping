// server/src/models/Organization.js
module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define('Organization', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 255]
      }
    },
    type: {
      type: DataTypes.ENUM('university', 'company', 'school', 'college'),
      allowNull: false
    },
    domain: {
      type: DataTypes.STRING(100),
      unique: true,
      validate: {
        isEmail: true
      }
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      field: 'logo_url'
    },
    address: {
      type: DataTypes.TEXT
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      field: 'contact_email',
      validate: {
        isEmail: true
      }
    },
    contactPhone: {
      type: DataTypes.STRING(20),
      field: 'contact_phone'
    },
    website: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: true
      }
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified'
    },
    approvalStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      field: 'approval_status'
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      field: 'approved_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approvedAt: {
      type: DataTypes.DATE,
      field: 'approved_at'
    },
    approvalNotes: {
      type: DataTypes.TEXT,
      field: 'approval_notes'
    },
    region: {
      type: DataTypes.STRING(100)
    },
    state: {
      type: DataTypes.STRING(100)
    },
    city: {
      type: DataTypes.STRING(100)
    },
    zone: {
      type: DataTypes.STRING(100)
    },
    workMode: {
      type: DataTypes.STRING(20),
      field: 'work_mode'
    },
    locations: {
      type: DataTypes.JSON,
      defaultValue: []
    }
  }, {
    tableName: 'organizations',
    underscored: true,
    timestamps: true
  });

  Organization.associate = (models) => {
    Organization.hasMany(models.User, {
      foreignKey: 'organizationId',
      as: 'users'
    });
    Organization.hasMany(models.Job, {
      foreignKey: 'organizationId',
      as: 'jobs'
    });
    Organization.hasMany(models.Event, {
      foreignKey: 'organizationId',
      as: 'events'
    });
    Organization.belongsTo(models.User, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });
  };

  return Organization;
};