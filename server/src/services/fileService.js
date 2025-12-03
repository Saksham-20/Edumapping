// server/src/services/fileService.js
const { Client } = require('minio');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

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
      const objectName = `uploads/${Date.now()}-${fileName}`;
      
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
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const filePath = path.join(uploadsDir, `${Date.now()}-${fileName}`);
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
      logger.error('Error getting file from MinIO', error, { filePath });
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
      logger.error('Error deleting file from MinIO', error, { filePath });
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
        logger.error('Error generating signed URL', error, { filePath });
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