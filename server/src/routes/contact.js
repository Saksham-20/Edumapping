const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const { contactLimiter } = require('../middleware/rateLimiter');

// The submitted fields go into an HTML email. Unescaped, a visitor could put
// markup and links into a message that arrives looking like it came from the
// site itself.
const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

// POST /api/contact
router.post('/', contactLimiter, async (req, res, next) => {
    try {
        const { name, email, message } = req.body;

        // Without SMTP the message cannot go anywhere; say so plainly and
        // point to a channel that works, instead of failing with a 500.
        if (!emailService.isConfigured()) {
            return res.status(503).json({
                error: 'Email Not Configured',
                message: 'Our contact form is offline. Write to hello@edumapping.com or WhatsApp +91 91049 91059.'
            });
        }

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (
            String(name).length > 200 ||
            String(email).length > 254 ||
            String(message).length > 5000 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))
        ) {
            return res.status(400).json({ error: 'Please check the name, email and message' });
        }

        // Send email to admin (hello@edumapping.com)
        // Header injection: a newline in the subject must not reach the mailer.
        const subject = `New Contact Form Submission from ${String(name).replace(/[\r\n]+/g, ' ')}`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #156395;">New Contact Message</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          ${escapeHtml(message).replace(/\n/g, '<br>')}
        </div>
      </div>
    `;
        const text = `Name: ${name}\nEmail: ${email}\nMessage: ${message}`;

        await emailService.sendEmail('hello@edumapping.com', subject, html, text);

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        logger.error('Contact form error', error);
        next(error);
    }
});

module.exports = router;
