// server/src/routes/files.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { uploadFile } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const fileController = require('../controllers/fileController');

const router = express.Router();

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 */
// Type-checked (pdf, doc, docx, png, jpg, jpeg, webp) and rate limited. It had
// neither, so any file — including .html that /uploads then served inline from
// our own origin — could be uploaded as fast as a script could send it.
router.post('/upload',
  authenticateToken,
  uploadLimiter,
  uploadFile,
  fileController.uploadFile
);

/**
 * @swagger
 * /api/files/serve:
 *   get:
 *     summary: Download a stored upload by the path saved on a record
 *     description: >
 *       Resumes, marksheets, offer letters and documents are not publicly
 *       served. Pass the stored path (e.g. `/uploads/123-abc-resume_5_1.pdf`).
 *       Visible to the owner, admins, same-institution staff, recruiters with
 *       scoped access or to whose jobs the student applied, and (offer letters)
 *       the issuing organization. Anything else is 404.
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The file }
 *       404: { description: No such file, or not visible to you }
 */
router.get('/serve', authenticateToken, fileController.serveFile);

/**
 * @swagger
 * /api/files/{id}/download:
 *   get:
 *     summary: Download file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id(\\d+)/download', authenticateToken, fileController.downloadFile);

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Delete file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id(\\d+)', authenticateToken, fileController.deleteFile);

/**
 * @swagger
 * /api/files/my-files:
 *   get:
 *     summary: Get user files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-files', authenticateToken, fileController.getUserFiles);

module.exports = router;