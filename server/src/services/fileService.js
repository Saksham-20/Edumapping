// server/src/services/fileService.js
const { Client } = require('minio');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// The directory app.js serves /uploads from. Writing to process.cwd() instead
// only agreed with it when the process happened to be started from server/.
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * The name a file is stored under: timestamp, 16 random hex characters, then
 * the caller's name reduced to a safe character set.
 *
 * The random part makes a URL unguessable even though callers build names
 * from a user id and a timestamp. Sanitising matters because the generic
 * upload passed the browser-supplied original name straight into path.join,
 * so a name containing `../` could write outside the uploads directory.
 * Callers' prefixes (`resume_<id>_`, `marksheet_<id>_`, `profile_<id>_`, …)
 * survive intact; services/fileAccessService.js reads them.
 */
function storedName(fileName) {
  const safe = path.basename(String(fileName || 'file'))
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(-120) || 'file';
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safe}`;
}

class FileService {
  constructor() {
    if (process.env.STORAGE_TYPE === 'minio') {
      this.minioClient = new Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT) || 9000,
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
        secretKey: process.env.MINIO_SECRET_KEY || 'password123'
      });
      this.bucketName = process.env.MINIO_BUCKET || 'edumapping';
      this.initializeBucket();
    }
  }

  async initializeBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        logger.info('Created MinIO bucket', { bucketName: this.bucketName });
      }
    } catch (error) {
      logger.error('Error initializing MinIO bucket', error, { bucketName: this.bucketName });
    }
  }

  async saveFile(buffer, fileName, mimeType) {
    if (process.env.STORAGE_TYPE === 'minio') {
      return await this.saveToMinio(buffer, fileName, mimeType);
    } else {
      return await this.saveToLocal(buffer, fileName);
    }
  }

  async saveToMinio(buffer, fileName, mimeType) {
    try {
      const objectName = `uploads/${storedName(fileName)}`;
      
      await this.minioClient.putObject(
        this.bucketName, 
        objectName, 
        buffer, 
        buffer.length,
        { 'Content-Type': mimeType }
      );

      return objectName;
    } catch (error) {
      logger.error('Error uploading to MinIO', error, { fileName });
      throw new Error('Failed to upload file');
    }
  }

  async saveToLocal(buffer, fileName) {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });

      const filePath = path.join(UPLOADS_DIR, storedName(fileName));
      await fs.writeFile(filePath, buffer);
      
      return filePath;
    } catch (error) {
      logger.error('Error saving file locally', error, { fileName });
      throw new Error('Failed to save file');
    }
  }

  async getFile(filePath) {
    if (process.env.STORAGE_TYPE === 'minio') {
      return await this.getFromMinio(filePath);
    } else {
      return await this.getFromLocal(filePath);
    }
  }

  async getFromMinio(objectName) {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, objectName);
      return stream;
    } catch (error) {
      logger.error('Error getting file from MinIO', error, { objectName });
      throw new Error('File not found');
    }
  }

  async getFromLocal(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      logger.error('Error getting local file', error, { filePath });
      throw new Error('File not found');
    }
  }

  async deleteFile(filePath) {
    if (process.env.STORAGE_TYPE === 'minio') {
      return await this.deleteFromMinio(filePath);
    } else {
      return await this.deleteFromLocal(filePath);
    }
  }

  async deleteFromMinio(objectName) {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
    } catch (error) {
      logger.error('Error deleting file from MinIO', error, { objectName });
      throw new Error('Failed to delete file');
    }
  }

  async deleteFromLocal(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error('Error deleting local file', error, { filePath });
      throw new Error('Failed to delete file');
    }
  }

  async getSignedUrl(objectName, expiry = 24 * 60 * 60) { // 24 hours
    if (process.env.STORAGE_TYPE === 'minio') {
      try {
        const url = await this.minioClient.presignedGetObject(
          this.bucketName, 
          objectName, 
          expiry
        );
        return url;
      } catch (error) {
        logger.error('Error generating signed URL', error, { objectName });
        throw new Error('Failed to generate download URL');
      }
    } else {
      // For local storage, return a direct path
      return `/uploads/${path.basename(objectName)}`;
    }
  }

  /**
   * Get a proper download URL for a file
   * For MinIO: Returns presigned URL
   * For local: Returns relative path
   */
  async getDownloadUrl(filePath, expiry = 24 * 60 * 60) {
    if (process.env.STORAGE_TYPE === 'minio') {
      // For MinIO, generate a presigned URL
      return await this.getSignedUrl(filePath, expiry);
    } else {
      // For local storage, return relative path
      return `/uploads/${path.basename(filePath)}`;
    }
  }
}

module.exports = new FileService();
module.exports.UPLOADS_DIR = UPLOADS_DIR;