// server/src/models/File.js
module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define('File', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // The stored file's own name. Migration 13 created `files.filename` NOT
    // NULL with no default, but the model never declared it, so every insert
    // on a migrated database (production) failed with a not-null violation:
    // no student could generate or upload a resume. Development hid it,
    // because `sync({ alter: true })` drops columns the model does not know.
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'unnamed_file',
      field: 'filename'
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'original_name'
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'file_path'
    },
    fileSize: {
      type: DataTypes.INTEGER,
      field: 'file_size'
    },
    mimeType: {
      type: DataTypes.STRING(100),
      field: 'mime_type'
    },
    fileType: {
      type: DataTypes.ENUM('resume', 'profile_picture', 'document', 'other'),
      defaultValue: 'other',
      field: 'file_type'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_public'
    }
  }, {
    tableName: 'files',
    underscored: true,
    timestamps: true
  });

  File.associate = (models) => {
    File.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return File;
};
