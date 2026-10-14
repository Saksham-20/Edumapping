// server/src/controllers/fileController.js
const path = require('path');
const { File } = require('../models');
const fileService = require('../services/fileService');
const fileAccess = require('../services/fileAccessService');
const logger = require('../utils/logger');

const NOT_FOUND = { error: 'File Not Found', message: 'File not found' };

/**
 * Send a stored file with headers that stop a browser from treating it as a
 * page. Images may display inline; everything else is a download. The type
 * comes from our own extension map, never from what the uploader declared.
 */
async function sendStoredFile(res, storagePath, name, downloadName) {
  const data = await fileService.getFile(storagePath);
  const safeName = String(downloadName || name).replace(/[^\w.\- ]/g, '_');
  res.setHeader('Content-Type', fileAccess.contentTypeFor(name));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader(
    'Content-Disposition',
    `${fileAccess.isImageName(name) ? 'inline' : 'attachment'}; filename="${safeName}"`
  );
  if (Buffer.isBuffer(data)) {
    res.send(data);
  } else {
    data.pipe(res);
  }
}

/** Where fileService keeps a stored name: an absolute path locally, an object name in MinIO. */
function storagePathFor(name) {
  return process.env.STORAGE_TYPE === 'minio'
    ? `uploads/${name}`
    : path.join(fileService.UPLOADS_DIR, name);
}

class FileController {
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No File',
          message: 'Please select a file to upload'
        });
      }

      const allowedFileTypes = ['resume', 'document', 'other'];
      const fileType = allowedFileTypes.includes(req.body.fileType) ? req.body.fileType : 'other';
      // The stored name is ours, not the browser's: `upload_<userId>_` marks it
      // as this user's private file, and fileService adds a random segment. The
      // original name is kept only in the database for the download filename.
      const ext = path.extname(req.file.originalname || '').toLowerCase();
      const fileName = `upload_${req.user.id}_${Date.now()}${ext}`;
      const filePath = await fileService.saveFile(req.file.buffer, fileName, req.file.mimetype);

      const file = await File.create({
        userId: req.user.id,
        filename: path.basename(filePath),
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

  /**
   * GET /api/files/:id/download. Same visibility rule as every other way of
   * reaching a student's documents. It used to refuse the student's own TPO
   * while admitting any recruiter whose company had *any* application from
   * the student; both now follow services/accessService.
   */
  async downloadFile(req, res, next) {
    try {
      const file = await File.findByPk(req.params.id);
      if (!file) {
        return res.status(404).json(NOT_FOUND);
      }
      const name = path.basename(file.filePath);
      const access = await fileAccess.checkFileAccess(req.user, name, { fileRow: file });
      if (!access.allowed) {
        return res.status(404).json(NOT_FOUND);
      }
      await sendStoredFile(res, file.filePath, name, file.originalName);
    } catch (error) {
      if (error.message === 'File not found') {
        return res.status(404).json(NOT_FOUND);
      }
      next(error);
    }
  }

  /**
   * GET /api/files/serve?path=/uploads/<name>. The authenticated replacement
   * for the public /uploads mount: records store '/uploads/...' paths
   * (resumeUrl, marksheetUrl, offerLetterUrl), and this resolves one to its
   * owner and checks the viewer against them. Not-yours and not-there are
   * both 404, so the endpoint cannot be used to probe for file names.
   */
  async serveFile(req, res, next) {
    try {
      const name = fileAccess.storedNameFromPath(req.query.path);
      if (!name) {
        return res.status(404).json(NOT_FOUND);
      }
      const access = await fileAccess.checkFileAccess(req.user, name);
      if (!access.allowed) {
        logger.debug('File access refused', { userId: req.user.id, file: name });
        return res.status(404).json(NOT_FOUND);
      }
      await sendStoredFile(res, storagePathFor(name), name, access.downloadName);
    } catch (error) {
      if (error.message === 'File not found') {
        return res.status(404).json(NOT_FOUND);
      }
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