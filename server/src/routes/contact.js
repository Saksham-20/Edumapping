const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// POST /api/contact
router.post('/', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Send email to admin (hello@edumapping.com)
        const subject = `New Contact Form Submission from ${name}`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #156395;">New Contact Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          ${message.replace(/\n/g, '<br>')}
        </div>
      </div>
    `;
        const text = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;

        await emailService.sendEmail('hello@edumapping.com', subject, html, text);

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        logger.error('Contact form error', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
