// server/src/routes/resume.js
const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const resumeService = require('../services/resumeService');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * @swagger
 * /api/resume/generate:
 *   post:
 *     summary: Generate resume from student profile
 *     tags: [Resume]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resume generated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only students can generate resumes
 */
router.post('/generate', 
  authenticateToken, 
  requireRole('student'), 
  async (req, res, next) => {
    try {
      const result = await resumeService.generateResumeFromProfile(req.user.id);
      
      res.json({
        message: 'Resume generated successfully',
        resume: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Upload route removed - resume generation from profile is the preferred method

/**
 * @swagger
 * /api/resume/data:
 *   get:
 *     summary: Get resume data for preview/editing
 *     tags: [Resume]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resume data retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only students can access resume data
 */
router.get('/data', 
  authenticateToken, 
  requireRole('student'), 
  async (req, res, next) => {
    try {
      const data = await resumeService.getResumeData(req.user.id);
      
      res.json({
        message: 'Resume data retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/resume/download/{fileId}:
 *   get:
 *     summary: Download resume file
 *     tags: [Resume]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: integer
 *         description: File ID to download
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 */
router.get('/download/:fileId', 
  authenticateToken, 
  async (req, res, next) => {
    try {
      const { fileId } = req.params;
      
      // This will be handled by the files route
      // Redirect to the files download endpoint
      res.redirect(`/api/files/${fileId}/download`);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;