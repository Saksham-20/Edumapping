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
    // The institution's email domain, stored bare ("college.edu"). This was
    // validated as an email address, which no bare domain can pass, so every
    // college and company that tried to sign itself up was rejected.
    domain: {
      type: DataTypes.STRING(100),
      unique: true,
      set(value) {
        if (value === null || value === undefined) return this.setDataValue('domain', value);
        const bare = String(value)
          .trim()
          .toLowerCase()
          .replace(/^.*@/, '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '');
        this.setDataValue('domain', bare || null);
      },
      validate: {
        isDomain(value) {
          if (!value) return;
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
            throw new Error('Email domain should look like college.edu');
          }
        }
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
      // Phones add a trailing space after an autocompleted address.
      set(value) {
        this.setDataValue('contactEmail', value ? String(value).trim().toLowerCase() : value || null);
      },
      validate: {
        isEmail: { msg: 'Contact email is not a valid email address' }
      }
    },
    contactPhone: {
      type: DataTypes.STRING(20),
      field: 'contact_phone',
      set(value) {
        this.setDataValue('contactPhone', value ? String(value).trim() : null);
      }
    },
    website: {
      type: DataTypes.STRING(255),
      // "college.edu" and "www.college.edu" are what people type; store a link.
      set(value) {
        if (!value || !String(value).trim()) return this.setDataValue('website', null);
        const v = String(value).trim();
        this.setDataValue('website', /^https?:\/\//i.test(v) ? v : `https://${v}`);
      },
      validate: {
        isUrl: { msg: 'Website must be a web address, such as https://college.edu' }
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