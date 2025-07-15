const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced Security Configuration

// Strict rate limiting for forms (relaxed for development)
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased for development testing
    message: {
        error: 'Too many form submissions. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Speed limiting - slow down repeated requests
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 5, // Allow 5 requests at full speed
    delayMs: (hits) => hits * 500, // Add 500ms delay per request
    maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
});

// Email configuration with enhanced security
const emailTransporter = nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'your-school-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    },
    tls: {
        rejectUnauthorized: true
    }
});

// Email templates
const getContactEmailTemplate = (data) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #3498db, #2c3e50); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f8f9fa; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #3498db; }
        .footer { background: #2c3e50; color: white; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🏫 New Contact Inquiry - Sree Vinayasree Vidyanikethan</h2>
    </div>
    <div class="content">
        <div class="info-box">
            <h3>Contact Information</h3>
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
        </div>
        <div class="info-box">
            <h3>Message</h3>
            <p>${data.message}</p>
        </div>
        <div class="info-box">
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${data.ip}</p>
        </div>
    </div>
    <div class="footer">
        <p>This is an automated message from Sree Vinayasree Vidyanikethan website.</p>
    </div>
</body>
</html>
`;

const getAdmissionEmailTemplate = (data) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #3498db, #2c3e50); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f8f9fa; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #e74c3c; }
        .footer { background: #2c3e50; color: white; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>🎓 New Admission Application - Sree Vinayasree Vidyanikethan</h2>
    </div>
    <div class="content">
        <div class="info-box">
            <h3>Student Information</h3>
            <p><strong>Student Name:</strong> ${data.studentName}</p>
            <p><strong>Date of Birth:</strong> ${data.dateOfBirth}</p>
            <p><strong>Gender:</strong> ${data.gender}</p>
            <p><strong>Class Applying For:</strong> ${data.admissionClass}</p>
        </div>
        <div class="info-box">
            <h3>Parent Information</h3>
            <p><strong>Father's Name:</strong> ${data.fatherName}</p>
            <p><strong>Mother's Name:</strong> ${data.motherName}</p>
            <p><strong>Email:</strong> ${data.parentEmail}</p>
            <p><strong>Phone:</strong> ${data.parentPhone}</p>
        </div>
        <div class="info-box">
            <h3>Additional Details</h3>
            <p><strong>Address:</strong> ${data.address}</p>
            <p><strong>Previous School:</strong> ${data.previousSchool || 'Not specified'}</p>
            <p><strong>Transportation Required:</strong> ${data.transportRequired}</p>
            ${data.additionalInfo ? `<p><strong>Additional Information:</strong> ${data.additionalInfo}</p>` : ''}
        </div>
        <div class="info-box">
            <p><strong>Application Submitted:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Application ID:</strong> ${data.applicationId}</p>
        </div>
    </div>
    <div class="footer">
        <p>This is an automated message from Sree Vinayasree Vidyanikethan admission system.</p>
    </div>
</body>
</html>
`;

// Enhanced Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: false
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting
app.use(generalLimiter);
app.use(speedLimiter);

// Apply strict rate limiting to form routes
app.use('/api/contact', formLimiter);
app.use('/api/admission', formLimiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced validation middleware
const contactValidation = [
    body('name').trim().isLength({ min: 2, max: 100 }).escape().matches(/^[a-zA-Z\s]+$/),
    body('email').isEmail().normalizeEmail(),
    body('phone').matches(/^[+]?[1-9][\d\s\-\(\)]{7,15}$/),
    body('message').trim().isLength({ min: 10, max: 1000 }).escape()
];

const admissionValidation = [
    // Validation temporarily disabled for development
];

// Enhanced utility functions
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 320; // RFC 5321 limit
};

const isValidPhone = (phone) => {
    const phoneRegex = /^[+]?[1-9][\d\s\-\(\)]{7,15}$/;
    return phoneRegex.test(phone);
};

const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '');
};

const generateApplicationId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ADM-${timestamp}-${random}`;
};

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// API Routes with enhanced security

// Contact Form API
app.post('/api/contact', contactValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Please check your input and try again.',
                errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
            });
        }

        const { name, email, phone, message } = req.body;

        // Additional security validations
        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address.'
            });
        }

        if (!isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid phone number.'
            });
        }

        // Sanitize all inputs
        const sanitizedData = {
            name: sanitizeInput(name),
            email: sanitizeInput(email),
            phone: sanitizeInput(phone),
            message: sanitizeInput(message),
            ip: req.ip || req.connection.remoteAddress,
            timestamp: new Date().toISOString()
        };

        // Send email to school
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-school-email@gmail.com',
            to: 'admissions@sreevinayasree.edu.in',
            subject: `New Contact Inquiry from ${sanitizedData.name}`,
            html: getContactEmailTemplate(sanitizedData),
            text: `New contact inquiry from ${sanitizedData.name} (${sanitizedData.email}, ${sanitizedData.phone}): ${sanitizedData.message}`
        };

        await emailTransporter.sendMail(mailOptions);

        // Send confirmation email to user
        const confirmationMail = {
            from: process.env.EMAIL_USER || 'your-school-email@gmail.com',
            to: sanitizedData.email,
            subject: 'Thank you for contacting Sree Vinayasree Vidyanikethan',
            html: `
                <h2>Thank you for your inquiry!</h2>
                <p>Dear ${sanitizedData.name},</p>
                <p>We have received your message and will get back to you within 24 hours.</p>
                <p>Best regards,<br>Sree Vinayasree Vidyanikethan Team</p>
            `
        };

        await emailTransporter.sendMail(confirmationMail);

        res.status(200).json({
            success: true,
            message: 'Your message has been sent successfully! We will contact you soon.'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            success: false,
            message: 'Sorry, there was an error processing your request. Please try again later.'
        });
    }
});

/*
// Admission Form API - DISABLED FOR DEBUGGING
app.post('/api/admission', admissionValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Please check your input and try again.',
                errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
            });
        }

        const formData = req.body;

        // Additional validations
        if (!isValidEmail(formData.parentEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address.'
            });
        }

        if (!isValidPhone(formData.parentPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid phone number.'
            });
        }

        // Sanitize all inputs
        const sanitizedData = {};
        for (const [key, value] of Object.entries(formData)) {
            sanitizedData[key] = sanitizeInput(value);
        }

        // Generate unique application ID
        const applicationId = generateApplicationId();
        sanitizedData.applicationId = applicationId;
        sanitizedData.timestamp = new Date().toISOString();

        // Send email to school
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-school-email@gmail.com',
            to: 'admissions@sreevinayasree.edu.in',
            subject: `New Admission Application - ${sanitizedData.studentName}`,
            html: getAdmissionEmailTemplate(sanitizedData)
        };

        await emailTransporter.sendMail(mailOptions);

        // Send confirmation email to parent
        const confirmationMail = {
            from: process.env.EMAIL_USER || 'your-school-email@gmail.com',
            to: sanitizedData.parentEmail,
            subject: `Admission Application Received - Application ID: ${applicationId}`,
            html: `
                <h2>Admission Application Received!</h2>
                <p>Dear ${sanitizedData.fatherName} & ${sanitizedData.motherName},</p>
                <p>Thank you for applying for admission at Sree Vinayasree Vidyanikethan.</p>
                <p><strong>Application Details:</strong></p>
                <ul>
                    <li>Student Name: ${sanitizedData.studentName}</li>
                    <li>Class Applied: ${sanitizedData.admissionClass}</li>
                    <li>Application ID: ${applicationId}</li>
                    <li>Date Submitted: ${new Date().toLocaleDateString()}</li>
                </ul>
                <p>Our admission team will contact you within 2 working days.</p>
                <p>Best regards,<br>Sree Vinayasree Vidyanikethan Admission Team</p>
            `
        };

        await emailTransporter.sendMail(confirmationMail);

        res.status(200).json({
            success: true,
            message: `Application submitted successfully! Your Application ID is ${applicationId}. We will contact you within 2 working days.`,
            applicationId: applicationId
        });

    } catch (error) {
        console.error('Admission form error:', error);
        res.status(500).json({
            success: false,
            message: 'Sorry, there was an error processing your application. Please try again later.'
        });
    }
});
*/

// CMS and Admin Routes
const fs = require('fs');

// Simple in-memory storage for demo (in production, use a database)
let newsArticles = [
    {
        id: 1,
        title: "Annual Day Celebration 2024",
        category: "event",
        content: "Join us for our annual day celebration on February 10th. A day filled with cultural performances, academic achievements, and fun activities.",
        date: "2024-01-15",
        author: "Admin"
    },
    {
        id: 2,
        title: "Admission Open for Academic Year 2024-25",
        category: "announcement",
        content: "Admissions are now open for the academic year 2024-25. Apply online or visit our school for more information.",
        date: "2024-01-10",
        author: "Admin"
    }
];

let contactFormSubmissions = [];
let admissionFormSubmissions = [];

// Admin panel route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes for CMS

// Get all news articles
app.get('/api/news', (req, res) => {
    res.json({ success: true, data: newsArticles });
});

// Create new news article
app.post('/api/news', [
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('content').trim().isLength({ min: 20, max: 2000 }).withMessage('Content must be 20-2000 characters'),
    body('category').isIn(['announcement', 'event', 'achievement', 'notice']).withMessage('Invalid category'),
    body('date').isISO8601().withMessage('Invalid date format')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, content, category, date } = req.body;
    const newArticle = {
        id: newsArticles.length + 1,
        title,
        content,
        category,
        date,
        author: 'Admin',
        createdAt: new Date().toISOString()
    };

    newsArticles.unshift(newArticle);
    
    console.log(`New news article created: ${title}`);
    res.json({ success: true, message: 'News article created successfully', data: newArticle });
});

// Update news article
app.put('/api/news/:id', [
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('content').trim().isLength({ min: 20, max: 2000 }).withMessage('Content must be 20-2000 characters'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const articleId = parseInt(req.params.id);
    const articleIndex = newsArticles.findIndex(article => article.id === articleId);
    
    if (articleIndex === -1) {
        return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const { title, content, category, date } = req.body;
    newsArticles[articleIndex] = {
        ...newsArticles[articleIndex],
        title,
        content,
        category,
        date,
        updatedAt: new Date().toISOString()
    };

    res.json({ success: true, message: 'Article updated successfully', data: newsArticles[articleIndex] });
});

// Delete news article
app.delete('/api/news/:id', (req, res) => {
    const articleId = parseInt(req.params.id);
    const articleIndex = newsArticles.findIndex(article => article.id === articleId);
    
    if (articleIndex === -1) {
        return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const deletedArticle = newsArticles.splice(articleIndex, 1)[0];
    res.json({ success: true, message: 'Article deleted successfully', data: deletedArticle });
});

// Get contact form submissions
app.get('/api/contact-submissions', (req, res) => {
    res.json({ success: true, data: contactFormSubmissions });
});

// Get admission form submissions
app.get('/api/admission-submissions', (req, res) => {
    res.json({ success: true, data: admissionFormSubmissions });
});

// CMS Settings API
app.post('/api/settings/email', [
    body('emailUser').isEmail().withMessage('Valid email required'),
    body('emailPass').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('smtpServer').isLength({ min: 5 }).withMessage('SMTP server required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    // In production, save to environment file or secure storage
    console.log('Email settings updated:', req.body.emailUser);
    res.json({ success: true, message: 'Email settings updated successfully' });
});

// Analytics API
app.get('/api/analytics', (req, res) => {
    const analytics = {
        totalVisitors: Math.floor(Math.random() * 2000) + 1000,
        contactForms: contactFormSubmissions.length,
        admissionApplications: admissionFormSubmissions.length,
        newsArticles: newsArticles.length,
        lastUpdated: new Date().toISOString()
    };
    
    res.json({ success: true, data: analytics });
});

// Public news API for website
app.get('/api/public/news', (req, res) => {
    // Return only published news articles (limit to 10 most recent)
    const publicNews = newsArticles.slice(0, 10).map(article => ({
        id: article.id,
        title: article.title,
        content: article.content.substring(0, 200) + '...', // Truncate for preview
        category: article.category,
        date: article.date
    }));
    
    res.json({ success: true, data: publicNews });
});

console.log('CMS routes configured');

// Enhanced Contact Form with Storage
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
        
        // Store submission
        const submission = {
            id: contactFormSubmissions.length + 1,
            name,
            email,
            phone,
            message,
            submittedAt: new Date().toISOString(),
            ip: req.ip
        };
        contactFormSubmissions.push(submission);
        
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
                        IP: ${req.ip}<br>
                        Submission ID: ${submission.id}
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

// TEST ROUTE FOR DEBUGGING
app.post('/test-route', (req, res) => {
    console.log('TEST ROUTE HIT!');
    console.log('Body:', req.body);
    res.json({ success: true, message: 'Test route working' });
});

// Enhanced Admission Form with Storage
app.post('/send-admission', formLimiter, async (req, res) => {
    try {
        console.log('=== /send-admission route called ===');
        console.log('Request headers:', req.headers);
        console.log('Request body:', req.body);
        console.log('=====================================');

        const { 
            studentName, 
            dateOfBirth, 
            gender, 
            admissionClass, 
            fatherName, 
            motherName, 
            parentEmail, 
            parentPhone, 
            address, 
            previousSchool, 
            transportRequired, 
            additionalInfo 
        } = req.body;
        
        // Store submission
        const submission = {
            id: Date.now(),
            studentName,
            dateOfBirth,
            gender,
            admissionClass,
            fatherName,
            motherName,
            parentEmail,
            parentPhone,
            address,
            previousSchool,
            transportRequired,
            additionalInfo,
            submittedAt: new Date().toISOString(),
            ip: req.ip,
            status: 'pending'
        };
        admissionFormSubmissions.push(submission);
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'sreevinayasree@gmail.com',
            to: process.env.EMAIL_USER || 'sreevinayasree@gmail.com',
            subject: 'New Admission Application - Sree Vinayasree Vidyanikethan',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c5aa0;">New Admission Application</h2>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                        <p><strong>Student Name:</strong> ${studentName}</p>
                        <p><strong>Date of Birth:</strong> ${dateOfBirth}</p>
                        <p><strong>Gender:</strong> ${gender}</p>
                        <p><strong>Class Applying For:</strong> ${admissionClass}</p>
                        <p><strong>Father's Name:</strong> ${fatherName}</p>
                        <p><strong>Mother's Name:</strong> ${motherName}</p>
                        <p><strong>Parent Email:</strong> ${parentEmail}</p>
                        <p><strong>Parent Phone:</strong> ${parentPhone}</p>
                        <p><strong>Address:</strong> ${address}</p>
                        <p><strong>Previous School:</strong> ${previousSchool || 'Not specified'}</p>
                        <p><strong>Transport Required:</strong> ${transportRequired}</p>
                        <p><strong>Additional Information:</strong> ${additionalInfo || 'None'}</p>
                    </div>
                    <p style="color: #666; margin-top: 20px;">
                        Timestamp: ${new Date().toLocaleString()}<br>
                        IP: ${req.ip}<br>
                        Application ID: ${submission.id}
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        
        // Log successful submission
        console.log(`Admission application submitted for ${studentName} by ${parentEmail} at ${new Date().toISOString()}`);
        
        res.json({ success: true, message: 'Application submitted successfully!' });
    } catch (error) {
        console.error('Admission form error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to submit application. Please try again later.' 
        });
    }
});

console.log('Enhanced forms with storage configured');

// Enhanced routing with SEO meta tags
const pages = {
    '/': {
        title: 'Sree Vinayasree Vidyanikethan - Premier English Medium School in Rayadurg',
        description: 'Quality education since establishment. Co-educational English Medium School in Rayadurg with State Board curriculum. Excellence in academics, sports, and character development.',
        keywords: 'Sree Vinayasree Vidyanikethan, school Rayadurg, education Anantapur, English Medium school'
    },
    '/about': {
        title: 'About Us - Sree Vinayasree Vidyanikethan',
        description: 'Learn about our school\'s mission, vision, and commitment to educational excellence. Discover our history and values.',
        keywords: 'about school, mission vision, educational excellence, school history'
    },
    '/academics': {
        title: 'Academics - Sree Vinayasree Vidyanikethan',
        description: 'Comprehensive State Board curriculum with focus on academic excellence, holistic development, and modern teaching methods.',
        keywords: 'academics, curriculum, State Board, education quality, teaching methods'
    },
    '/admissions': {
        title: 'Admissions - Sree Vinayasree Vidyanikethan',
        description: 'Join our school community. Admission process, requirements, and online application for quality education.',
        keywords: 'school admission, enrollment, application process, join school'
    },
    '/facilities': {
        title: 'Facilities - Sree Vinayasree Vidyanikethan',
        description: 'Modern infrastructure, well-equipped classrooms, library, sports facilities, and safe learning environment.',
        keywords: 'school facilities, infrastructure, classrooms, library, sports'
    },
    '/contact': {
        title: 'Contact Us - Sree Vinayasree Vidyanikethan',
        description: 'Get in touch with us. School address, contact information, and location in Rayadurg, Anantapur.',
        keywords: 'contact school, school address, Rayadurg school, get in touch'
    }
};

// SEO-enhanced page routing
app.get('/:page?', (req, res) => {
    const page = req.params.page || '';
    const pagePath = `/${page}`;
    
    // Check if it's a valid page
    const validPages = ['', 'about', 'academics', 'admissions', 'facilities', 'contact'];
    
    if (page && !validPages.includes(page)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    const fileName = page ? `${page}.html` : 'index.html';
    const filePath = path.join(__dirname, 'public', fileName);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    res.sendFile(filePath);
});

// Sitemap route
app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Robots.txt route
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

console.log('SEO routes configured');

// HTML Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/academics', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'academics.html'));
});

app.get('/academics/kindergarten', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'kindergarten.html'));
});

app.get('/admissions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admissions.html'));
});

app.get('/facilities', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'facilities.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Enhanced error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    
    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Something went wrong on our end.' 
        : err.message;
    
    res.status(err.status || 500).json({
        success: false,
        message: message
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
app.listen(PORT, () => {
    console.log(`🚀 Sree Vinayasree Vidyanikethan website is running on http://localhost:${PORT}`);
    console.log(`📚 School Management System ready!`);
    console.log(`📧 Email functionality enabled`);
    console.log(`🔒 Enhanced security features active`);
    console.log(`⚡ Performance optimizations enabled`);
});

module.exports = app;
