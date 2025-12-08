// server/src/services/resumeService.js
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const { User, StudentProfile, Achievement, File } = require('../models');
const fileService = require('./fileService');
const logger = require('../utils/logger');

class ResumeService {
  async generateResumeFromProfile(userId) {
    // Get user data with all related information
    const user = await User.findByPk(userId, {
      include: [
        {
          model: StudentProfile,
          as: 'studentProfile'
        },
        {
          model: Achievement,
          as: 'achievements',
          order: [['issueDate', 'DESC']]
        }
      ]
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.studentProfile) {
      throw new Error('Student profile not found');
    }

    // Delete old resume if exists
    if (user.studentProfile.resumeUrl) {
      try {
        // Find and delete old file record
        const oldFileRecord = await File.findOne({
          where: {
            userId: user.id,
            fileType: 'resume'
          },
          order: [['createdAt', 'DESC']]
        });

        if (oldFileRecord) {
          // Delete the physical file
          await fileService.deleteFile(oldFileRecord.filePath);
          // Delete the database record
          await oldFileRecord.destroy();
          logger.info('Deleted old resume', { userId: user.id });
        }
      } catch (error) {
        logger.warn('Error deleting old resume', { userId: user.id, error: error.message });
        // Continue with generation even if deletion fails
      }
    }

    // Generate PDF
    const pdfBuffer = await this.createResumePDF(user);

    // Save to file storage
    const fileName = `resume_${user.id}_${Date.now()}.pdf`;
    const filePath = await fileService.saveFile(pdfBuffer, fileName, 'application/pdf');

    // Determine resume URL based on storage type
    let resumeUrl = filePath;
    if (process.env.STORAGE_TYPE !== 'minio') {
      // For local storage, convert absolute path to relative URL
      resumeUrl = `/uploads/${path.basename(filePath)}`;
    }

    // Save file record
    const fileRecord = await File.create({
      userId: user.id,
      originalName: fileName,
      filePath, // Keep original path/object name for file management
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      fileType: 'resume',
      isPublic: false
    });

    // Update student profile with new resume URL (keep for backward compatibility)
    await user.studentProfile.update({
      resumeUrl
    });

    return {
      fileId: fileRecord.id,
      fileName,
      filePath,
      downloadUrl: `/api/files/${fileRecord.id}/download` // Use File ID-based download endpoint
    };
  }

  async createResumePDF(user) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Add content to PDF
        this.addResumeContent(doc, user);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  addResumeContent(doc, user) {
    const profile = user.studentProfile;
    const margin = 50;
    const pageWidth = 595.28 - (margin * 2); // A4 width minus margins

    // Header with name and contact info
    this.addHeader(doc, user, profile);

    // Professional Summary/Bio
    if (profile.bio) {
      this.addSection(doc, 'PROFESSIONAL SUMMARY', profile.bio);
    }

    // Education
    this.addEducationSection(doc, profile);

    // Skills
    if (profile.skills && profile.skills.length > 0) {
      this.addSkillsSection(doc, profile.skills);
    }

    // Achievements/Experience
    if (user.achievements && user.achievements.length > 0) {
      this.addAchievementsSection(doc, user.achievements);
    }

    // Contact Information
    this.addContactSection(doc, user, profile);
  }

  addHeader(doc, user, profile) {
    const fullName = `${user.firstName} ${user.lastName}`;

    // Name
    doc.fontSize(24)
      .font('Helvetica-Bold')
      .text(fullName, 50, 50, { align: 'center' });

    // Course and Year
    if (profile.course && profile.yearOfStudy) {
      doc.fontSize(14)
        .font('Helvetica')
        .text(`${profile.course} - Year ${profile.yearOfStudy}`, { align: 'center' });
    }

    // Contact info
    const contactInfo = [];
    if (user.email) contactInfo.push(user.email);
    if (user.phone) contactInfo.push(user.phone);
    if (profile.linkedinUrl) contactInfo.push('LinkedIn Profile');

    if (contactInfo.length > 0) {
      doc.fontSize(10)
        .text(contactInfo.join(' | '), { align: 'center' });
    }

    doc.moveDown(2);
  }

  addSection(doc, title, content) {
    // Section title
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text(title, 50, doc.y);

    // Underline
    doc.moveTo(50, doc.y + 2)
      .lineTo(545, doc.y + 2)
      .stroke();

    doc.moveDown(0.5);

    // Content
    doc.fontSize(11)
      .font('Helvetica')
      .text(content, 50, doc.y, {
        width: 495,
        align: 'justify'
      });

    doc.moveDown(1.5);
  }

  addEducationSection(doc, profile) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('EDUCATION', 50, doc.y);

    doc.moveTo(50, doc.y + 2)
      .lineTo(545, doc.y + 2)
      .stroke();

    doc.moveDown(0.5);

    // University/College name (from organization)
    if (profile.course) {
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(profile.course, 50, doc.y);

      if (profile.branch) {
        doc.fontSize(11)
          .font('Helvetica')
          .text(`Specialization: ${profile.branch}`, 50, doc.y);
      }

      // Grades
      const gradeInfo = [];
      if (profile.cgpa) gradeInfo.push(`CGPA: ${profile.cgpa}`);
      if (profile.percentage) gradeInfo.push(`Percentage: ${profile.percentage}%`);
      if (profile.graduationYear) gradeInfo.push(`Year: ${profile.graduationYear}`);

      if (gradeInfo.length > 0) {
        doc.fontSize(11)
          .text(gradeInfo.join(' | '), 50, doc.y);
      }
    }

    doc.moveDown(1.5);
  }

  addSkillsSection(doc, skills) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('TECHNICAL SKILLS', 50, doc.y);

    doc.moveTo(50, doc.y + 2)
      .lineTo(545, doc.y + 2)
      .stroke();

    doc.moveDown(0.5);

    // Group skills by type if they're objects, otherwise just list them
    if (Array.isArray(skills)) {
      const skillText = skills.join(', ');
      doc.fontSize(11)
        .font('Helvetica')
        .text(skillText, 50, doc.y, { width: 495 });
    } else if (typeof skills === 'object') {
      Object.entries(skills).forEach(([category, skillList]) => {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .text(`${category}: `, 50, doc.y, { continued: true })
          .font('Helvetica')
          .text(Array.isArray(skillList) ? skillList.join(', ') : skillList);
      });
    }

    doc.moveDown(1.5);
  }

  addAchievementsSection(doc, achievements) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('ACHIEVEMENTS & EXPERIENCE', 50, doc.y);

    doc.moveTo(50, doc.y + 2)
      .lineTo(545, doc.y + 2)
      .stroke();

    doc.moveDown(0.5);

    achievements.forEach((achievement, index) => {
      // Achievement title
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(achievement.title, 50, doc.y);

      // Organization and date
      const orgDate = [];
      if (achievement.issuingOrganization) orgDate.push(achievement.issuingOrganization);
      if (achievement.issueDate) {
        const date = new Date(achievement.issueDate);
        orgDate.push(date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }));
      }

      if (orgDate.length > 0) {
        doc.fontSize(10)
          .font('Helvetica-Oblique')
          .text(orgDate.join(' | '), 50, doc.y);
      }

      // Description
      if (achievement.description) {
        doc.fontSize(11)
          .font('Helvetica')
          .text(achievement.description, 50, doc.y, { width: 495 });
      }

      // Add space between achievements
      if (index < achievements.length - 1) {
        doc.moveDown(1);
      }
    });

    doc.moveDown(1.5);
  }

  addContactSection(doc, user, profile) {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('ADDITIONAL INFORMATION', 50, doc.y);

    doc.moveTo(50, doc.y + 2)
      .lineTo(545, doc.y + 2)
      .stroke();

    doc.moveDown(0.5);

    // Portfolio links
    const links = [];
    if (profile.githubUrl) links.push(`GitHub: ${profile.githubUrl}`);
    if (profile.portfolioUrl) links.push(`Portfolio: ${profile.portfolioUrl}`);
    if (profile.linkedinUrl) links.push(`LinkedIn: ${profile.linkedinUrl}`);

    if (links.length > 0) {
      doc.fontSize(11)
        .font('Helvetica')
        .text(links.join('\n'), 50, doc.y);
    }

    // Address
    if (profile.address) {
      doc.moveDown(0.5);
      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('Address: ', 50, doc.y, { continued: true })
        .font('Helvetica')
        .text(profile.address);
    }
  }

  async uploadCustomResume(userId, file) {
    // Validate file type
    if (!file.mimetype.includes('pdf')) {
      throw new Error('Only PDF files are allowed for resume upload');
    }

    // Delete old resume if exists
    try {
      const oldFileRecord = await File.findOne({
        where: {
          userId,
          fileType: 'resume'
        },
        order: [['createdAt', 'DESC']]
      });

      if (oldFileRecord) {
        await fileService.deleteFile(oldFileRecord.filePath);
        await oldFileRecord.destroy();
        logger.info('Deleted old resume', { userId });
      }
    } catch (error) {
      logger.warn('Error deleting old resume', { userId, error: error.message });
    }

    // Save file
    const fileName = `resume_${userId}_${Date.now()}.pdf`;
    const filePath = await fileService.saveFile(file.buffer, fileName, file.mimetype);

    // Determine resume URL based on storage type
    let resumeUrl = filePath;
    if (process.env.STORAGE_TYPE !== 'minio') {
      // For local storage, convert absolute path to relative URL
      resumeUrl = `/uploads/${path.basename(filePath)}`;
    }

    // Save file record
    const fileRecord = await File.create({
      userId,
      originalName: file.originalname,
      filePath, // Keep original path/object name
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: 'resume',
      isPublic: false
    });

    // Update student profile
    const user = await User.findByPk(userId, {
      include: [{ model: StudentProfile, as: 'studentProfile' }]
    });

    if (user && user.studentProfile) {
      await user.studentProfile.update({
        resumeUrl
      });
    }

    return {
      fileId: fileRecord.id,
      fileName: file.originalname,
      filePath,
      downloadUrl: resumeUrl
    };
  }

  async getResumeData(userId) {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: StudentProfile,
          as: 'studentProfile'
        },
        {
          model: Achievement,
          as: 'achievements',
          order: [['issueDate', 'DESC']]
        }
      ]
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Find the resume file record if it exists
    let resumeFile = null;
    if (user.studentProfile && user.studentProfile.resumeUrl) {
      resumeFile = await File.findOne({
        where: {
          userId: user.id,
          fileType: 'resume'
        },
        order: [['createdAt', 'DESC']]
      });
    }

    // Build profile object with file information
    const profileData = user.studentProfile ? { ...user.studentProfile.toJSON() } : null;
    
    if (profileData && resumeFile) {
      // Add file ID and download URL to profile
      profileData.resumeFileId = resumeFile.id;
      profileData.resumeDownloadUrl = `/api/files/${resumeFile.id}/download`;
    }

    return {
      personalInfo: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone
      },
      profile: profileData,
      achievements: user.achievements
    };
  }
}

module.exports = new ResumeService();