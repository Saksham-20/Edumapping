// server/src/models/User.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash'
    },
    role: {
      type: DataTypes.ENUM('student', 'recruiter', 'tpo', 'admin', 'principal', 'teacher', 'school_admin', 'career_counselor'),
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      // Normalise before validating and storing. The rule below is E.164, which
      // permits no separators at all — but people write "+1-555-0005" and
      // "+91 98765 43210", and every seeded phone in this repo contains
      // hyphens. (The seeders use bulkInsert, which skips model validation, so
      // the data and the rule have always disagreed.) Anyone registering or
      // being bulk-imported with a normally formatted number was rejected as
      // "Phone number format is invalid".
      set(value) {
        if (value === null || value === undefined || value === '') {
          this.setDataValue('phone', value);
          return;
        }
        this.setDataValue('phone', String(value).replace(/[\s\-().]/g, ''));
      },
      validate: {
        // Custom validator to allow empty strings or null values
        isValidPhone(value) {
          // Allow null, undefined, or empty string
          if (!value || value === '') {
            return;
          }
          if (!/^[+]?[1-9]\d{0,15}$/.test(value)) {
            throw new Error('Phone number format is invalid');
          }
        }
      }
    },
    profilePicture: {
      type: DataTypes.STRING(500),
      field: 'profile_picture'
    },
    organizationId: {
      type: DataTypes.INTEGER,
      field: 'organization_id',
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
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
    lastLogin: {
      type: DataTypes.DATE,
      field: 'last_login'
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    hooks: {
      beforeCreate: (user) => {
        // Convert empty string to null for phone
        if (user.phone === '') {
          user.phone = null;
        }
        
        // Only set isActive to false if approvalStatus is explicitly 'pending' and user is not admin
        // Don't override isActive if it's already been set by the service layer
        if (user.role !== 'admin' && user.approvalStatus === 'pending' && user.isActive === undefined) {
          user.isActive = false;
        }
      },
      beforeUpdate: (user) => {
        // Convert empty string to null for phone
        if (user.phone === '') {
          user.phone = null;
        }
        
        // Update isActive based on approval status
        if (user.role !== 'admin') {
          if (user.approvalStatus === 'approved') {
            user.isActive = true;
          } else if (user.approvalStatus === 'rejected') {
            user.isActive = false;
          }
        }
      }
    }
  });

  User.associate = (models) => {
    User.belongsTo(models.Organization, {
      foreignKey: 'organizationId',
      as: 'organization'
    });
    User.hasOne(models.StudentProfile, {
      foreignKey: 'userId',
      as: 'studentProfile'
    });
    User.hasOne(models.RecruiterProfile, {
      foreignKey: 'userId',
      as: 'recruiterProfile'
    });
    User.hasMany(models.Achievement, {
      foreignKey: 'userId',
      as: 'achievements'
    });
    User.hasMany(models.Application, {
      foreignKey: 'studentId',
      as: 'applications'
    });
    User.hasMany(models.EventRegistration, {
      foreignKey: 'userId',
      as: 'eventRegistrations'
    });
    User.hasMany(models.AssessmentResult, {
      foreignKey: 'studentId',
      as: 'assessmentResults'
    });
    User.hasMany(models.Notification, {
      foreignKey: 'userId',
      as: 'notifications'
    });
    User.hasMany(models.File, {
      foreignKey: 'userId',
      as: 'files'
    });
    User.hasMany(models.Organization, {
      foreignKey: 'approvedBy',
      as: 'approvedOrganizations'
    });
    User.hasMany(models.User, {
      foreignKey: 'approvedBy',
      as: 'approvedUsers'
    });
  };

  return User;
};