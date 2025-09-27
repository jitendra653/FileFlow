import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Contact from './models/contact';
import nodemailer from 'nodemailer';
import logger from './utils/logger';

const contactApiRouter = Router();

contactApiRouter.post('/contact',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('contactus', {
        success: null,
        error: errors.array().map(e => e.msg).join(', ')
      });
    }
    try {
      const contact = new Contact({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        subject: req.body.subject,
        message: req.body.message
      });
      await contact.save();

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'youradminemail@gmail.com',
          pass: process.env.SMTP_PASS || 'yourpassword'
        }
      });
      const mailOptions = {
        from: req.body.email,
        to: process.env.ADMIN_EMAIL || 'youradminemail@gmail.com',
        subject: `Contact Form: ${req.body.subject}`,
        text: `Name: ${req.body.firstName} ${req.body.lastName}\nEmail: ${req.body.email}\nSubject: ${req.body.subject}\nMessage: ${req.body.message}`
      };

      await transporter.sendMail(mailOptions);

      res.render('contactus', {
        success: 'Your message has been sent successfully!',
        error: null
      });
    } catch (err) {
      logger.error('Contact form error', { error: err });
      res.render('contactus', {
        success: null,
        error: 'Failed to send message. Please try again later.'
      });
    }
  }
);

export default contactApiRouter;
