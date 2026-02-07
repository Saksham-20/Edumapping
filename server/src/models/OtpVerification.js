// server/src/models/OtpVerification.js
module.exports = (sequelize, DataTypes) => {
  const OtpVerification = sequelize.define('OtpVerification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    identifier: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    otpHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'otp_hash'
    },
    purpose: {
      type: DataTypes.ENUM('registration', 'forgot_password'),
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    },
    usedAt: {
      type: DataTypes.DATE,
      field: 'used_at'
    }
  }, {
    tableName: 'otp_verifications',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  return OtpVerification;
};
