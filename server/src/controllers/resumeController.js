// server/src/controllers/resumeController.js
const resumeService = require('../services/resumeService');

class ResumeController {
  async generateResume(req, res, next) {
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

  // uploadResume method removed - custom resume upload feature disabled
  // Resume generation from profile is the preferred method

  async getResumeData(req, res, next) {
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

  async downloadResume(req, res, next) {
    try {
      const { fileId } = req.params;
      
      // Redirect to the files download endpoint
      res.redirect(`/api/files/${fileId}/download`);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ResumeController();