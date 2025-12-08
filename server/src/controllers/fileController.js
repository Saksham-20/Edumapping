// server/src/controllers/fileController.js
const { File } = require('../models');
const fileService = require('../services/fileService');

class FileController {
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No File',
          message: 'Please select a file to upload'
        });
      }

      const { fileType = 'other' } = req.body;
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const filePath = await fileService.saveFile(req.file.buffer, fileName, req.file.mimetype);

      const file = await File.create({
        userId: req.user.id,
        originalName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileType,
        isPublic: false
      });

      res.status(201).json({
        message: 'File uploaded successfully',
        file: {
          id: file.id,
          originalName: file.originalName,
          fileType: file.fileType,
          downloadUrl: `/api/files/${file.id}/download`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadFile(req, res, next) {
    try {
      const { id } = req.params;

      const file = await File.findByPk(id);
      if (!file) {
        return res.status(404).json({
          error: 'File Not Found',
          message: 'File not found'
        });
      }

      // Check permissions
      if (!file.isPublic && file.userId !== req.user.id && req.user.role !== 'admin') {
        // Allow recruiters to download student resumes if they have access to the student's applications
        if (req.user.role === 'recruiter' && file.fileType === 'resume') {
          // Check if the recruiter has access to any applications from this student
          const { Application, Job } = require('../models');
          const hasAccess = await Application.findOne({
            include: [{
              model: Job,
              as: 'job',
              where: { organizationId: req.user.organizationId }
            }],
            where: { studentId: file.userId }
          });
          
          if (!hasAccess) {
            return res.status(403).json({
              error: 'Access Forbidden',
              message: 'You do not have permission to download this file'
            });
          }
        } else {
          return res.status(403).json({
            error: 'Access Forbidden',
            message: 'You do not have permission to download this file'
          });
        }
      }

      const fileStream = await fileService.getFile(file.filePath);
      
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      
      if (Buffer.isBuffer(fileStream)) {
        res.send(fileStream);
      } else {
        fileStream.pipe(res);
      }
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req, res, next) {
    try {
      const { id } = req.params;

      const file = await File.findByPk(id);
      if (!file) {
        return res.status(404).json({
          error: 'File Not Found',
          message: 'File not found'
        });
      }

      // Check permissions
      if (file.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only delete your own files'
        });
      }

      // Delete from storage
      await fileService.deleteFile(file.filePath);
      
      // Delete from database
      await file.destroy();

      res.json({
        message: 'File deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserFiles(req, res, next) {
    try {
      const { fileType, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      const whereClause = { userId: req.user.id };

      if (fileType) whereClause.fileType = fileType;

      const { count, rows: files } = await File.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'originalName', 'fileType', 'fileSize', 'createdAt'],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      const filesWithUrls = files.map(file => ({
        ...file.toJSON(),
        downloadUrl: `/api/files/${file.id}/download`
      }));

      res.json({
        message: 'Files retrieved successfully',
        files: filesWithUrls,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalFiles: count,
          hasMore: offset + files.length < count
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FileController();