const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

console.log('Starting server with enhanced security...');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Express app created');

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
        },
    },
}));

// Rate limiting for forms
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit each IP to 3 form submissions per 15 minutes
    message: {
        success: false,
        message: 'Too many form submissions. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Basic middleware
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log('Security middleware configured');

// Input validation middleware
const contactValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name must be 2-50 characters and contain only letters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    body('message')
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage('Message must be between 10-500 characters')
];

const admissionValidation = [
    body('studentName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Student name must be 2-50 characters and contain only letters'),
    body('parentName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Parent name must be 2-50 characters and contain only letters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('phone')
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    body('grade')
        .isIn(['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'])
        .withMessage('Please select a valid grade'),
    body('previousSchool')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Previous school name must not exceed 100 characters')
];

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        security: 'Enhanced'
    });
});

// Contact form endpoint with validation and rate limiting
app.post('/send-contact', formLimiter, contactValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { name, email, phone, message } = req.body;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: process.env.EMAIL_USER || 'your-email@gmail.com',
            subject: 'New Contact Form Submission - Sree Vinayasree Vidyanikethan',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c5aa0;">New Contact Message</h2>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                        <p><strong>Message:</strong></p>
                        <div style="background-color: white; padding: 15px; border-radius: 3px;">
                            ${message}
                        </div>
                    </div>
                    <p style="color: #666; margin-top: 20px;">
                        Timestamp: ${new Date().toLocaleString()}<br>
                        IP: ${req.ip}
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        
        // Log successful submission
        console.log(`Contact form submitted by ${email} at ${new Date().toISOString()}`);
        
        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send message. Please try again later.' 
        });
    }
});

// Admission form endpoint with validation and rate limiting
app.post('/send-admission', formLimiter, admissionValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { studentName, parentName, email, phone, grade, previousSchool } = req.body;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: process.env.EMAIL_USER || 'your-email@gmail.com',
            subject: 'New Admission Application - Sree Vinayasree Vidyanikethan',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c5aa0;">New Admission Application</h2>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                        <p><strong>Student Name:</strong> ${studentName}</p>
                        <p><strong>Parent/Guardian Name:</strong> ${parentName}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Phone:</strong> ${phone}</p>
                        <p><strong>Grade Applying For:</strong> ${grade}</p>
                        <p><strong>Previous School:</strong> ${previousSchool || 'Not specified'}</p>
                    </div>
                    <p style="color: #666; margin-top: 20px;">
                        Timestamp: ${new Date().toLocaleString()}<br>
                        IP: ${req.ip}
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        
        // Log successful submission
        console.log(`Admission application submitted for ${studentName} by ${email} at ${new Date().toISOString()}`);
        
        res.json({ success: true, message: 'Application submitted successfully!' });
    } catch (error) {
        console.error('Admission form error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit application. Please try again later.' 
        });
    }
});

console.log('Email routes with security configured');

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Route not found' 
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Security: Enhanced with Helmet, Rate Limiting, and Validation`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
    console.error('❌ Server failed to start:', err);
});
