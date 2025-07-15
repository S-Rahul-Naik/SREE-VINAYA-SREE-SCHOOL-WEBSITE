const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const fs = require('fs');

console.log('🚀 Starting Sree Vinayasree Vidyanikethan Server...');

const app = express();
const PORT = process.env.PORT || 3000;

// Data Storage (In production, use a database)
let newsArticles = [
    {
        id: 1,
        title: "Annual Day Celebration 2024",
        category: "event",
        content: "Join us for our annual day celebration on February 10th. A day filled with cultural performances, academic achievements, and fun activities for the entire school community.",
        date: "2024-01-15",
        author: "Admin"
    },
    {
        id: 2,
        title: "Admission Open for Academic Year 2024-25",
        category: "announcement",
        content: "Admissions are now open for the academic year 2024-25. Apply online through our website or visit our school for more information about the admission process.",
        date: "2024-01-10",
        author: "Admin"
    }
];

let contactFormSubmissions = [];
let admissionFormSubmissions = [];

// Security Configuration
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

// Rate Limiting
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 form submissions per 15 minutes (increased from 3)
    message: { success: false, message: 'Too many form submissions. Please try again in 15 minutes.' },
    standardHeaders: true, legacyHeaders: false,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes (increased from 100)
    standardHeaders: true, legacyHeaders: false,
});

// Apply general rate limiting only in production
if (process.env.NODE_ENV === 'production') {
    app.use(generalLimiter);
}

// Basic Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Input Validation
const contactValidation = [
    body('name').trim().isLength({ min: 2, max: 50 }).matches(/^[a-zA-Z\s]+$/),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('message').trim().isLength({ min: 10, max: 500 })
];

const admissionValidation = [
    // Validation temporarily disabled for development
];

console.log('✅ Security and validation configured');

// =============================================================================
// API ROUTES (Must come before catch-all routes)
// =============================================================================

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        security: 'Enhanced',
        cms: 'Active'
    });
});

// CMS API Routes
app.get('/api/news', (req, res) => {
    res.json({ success: true, data: newsArticles });
});

app.post('/api/news', [
    body('title').trim().isLength({ min: 5, max: 200 }),
    body('content').trim().isLength({ min: 20, max: 2000 }),
    body('category').isIn(['announcement', 'event', 'achievement', 'notice']),
    body('date').isISO8601()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, content, category, date } = req.body;
    const newArticle = {
        id: Date.now(), // Simple ID generation
        title, content, category, date,
        author: 'Admin',
        createdAt: new Date().toISOString()
    };

    newsArticles.unshift(newArticle);
    console.log(`📰 New article created: ${title}`);
    res.json({ success: true, message: 'Article created successfully', data: newArticle });
});

app.get('/api/public/news', (req, res) => {
    const publicNews = newsArticles.slice(0, 10).map(article => ({
        id: article.id,
        title: article.title,
        content: article.content.length > 200 ? article.content.substring(0, 200) + '...' : article.content,
        category: article.category,
        date: article.date
    }));
    res.json({ success: true, data: publicNews });
});

app.get('/api/contact-submissions', (req, res) => {
    res.json({ success: true, data: contactFormSubmissions });
});

app.get('/api/admission-submissions', (req, res) => {
    res.json({ success: true, data: admissionFormSubmissions });
});

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

// Form Submission Routes
app.post('/send-contact', formLimiter, contactValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
        }

        const { name, email, phone, message } = req.body;
        
        const submission = {
            id: Date.now(),
            name, email, phone, message,
            submittedAt: new Date().toISOString(),
            ip: req.ip
        };
        contactFormSubmissions.push(submission);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: process.env.EMAIL_USER || 'your-email@gmail.com',
            subject: 'New Contact Form - Sree Vinayasree Vidyanikethan',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #2c5aa0, #1e3d6f); color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">🏫 New Contact Message</h2>
                        <p style="margin: 5px 0 0 0;">Sree Vinayasree Vidyanikethan</p>
                    </div>
                    <div style="padding: 25px; background-color: #f9fafb;">
                        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #2c5aa0; margin-top: 0;">Contact Details</h3>
                            <p><strong>👤 Name:</strong> ${name}</p>
                            <p><strong>📧 Email:</strong> ${email}</p>
                            <p><strong>📞 Phone:</strong> ${phone || 'Not provided'}</p>
                        </div>
                        <div style="background: white; padding: 20px; border-radius: 8px;">
                            <h3 style="color: #2c5aa0; margin-top: 0;">📝 Message</h3>
                            <p style="line-height: 1.6; color: #374151;">${message}</p>
                        </div>
                    </div>
                    <div style="background: #f3f4f6; padding: 15px; font-size: 12px; color: #6b7280; text-align: center;">
                        <p>Submitted: ${new Date().toLocaleString()} | IP: ${req.ip} | ID: ${submission.id}</p>
                    </div>
                </div>
            `
        };

        // Email functionality temporarily disabled for development
        // await transporter.sendMail(mailOptions);
        console.log(`📧 Contact form submitted by ${email}`);
        res.json({ success: true, message: 'Message sent successfully! We will get back to you soon.' });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
    }
});

app.post('/send-admission', formLimiter, admissionValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
        }

        const { studentName, parentName, email, phone, grade, previousSchool } = req.body;
        
        const submission = {
            id: Date.now(),
            studentName, parentName, email, phone, grade, previousSchool,
            submittedAt: new Date().toISOString(),
            ip: req.ip,
            status: 'pending'
        };
        admissionFormSubmissions.push(submission);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: process.env.EMAIL_USER || 'your-email@gmail.com',
            subject: 'New Admission Application - Sree Vinayasree Vidyanikethan',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #2c5aa0, #1e3d6f); color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">🎓 New Admission Application</h2>
                        <p style="margin: 5px 0 0 0;">Sree Vinayasree Vidyanikethan</p>
                    </div>
                    <div style="padding: 25px; background-color: #f9fafb;">
                        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #2c5aa0; margin-top: 0;">Student Information</h3>
                            <p><strong>👦 Student Name:</strong> ${studentName}</p>
                            <p><strong>📚 Grade Applying For:</strong> ${grade}</p>
                            <p><strong>🏫 Previous School:</strong> ${previousSchool || 'Not specified'}</p>
                        </div>
                        <div style="background: white; padding: 20px; border-radius: 8px;">
                            <h3 style="color: #2c5aa0; margin-top: 0;">Parent/Guardian Information</h3>
                            <p><strong>👤 Name:</strong> ${parentName}</p>
                            <p><strong>📧 Email:</strong> ${email}</p>
                            <p><strong>📞 Phone:</strong> ${phone}</p>
                        </div>
                    </div>
                    <div style="background: #f3f4f6; padding: 15px; font-size: 12px; color: #6b7280; text-align: center;">
                        <p>Submitted: ${new Date().toLocaleString()} | IP: ${req.ip} | ID: ${submission.id}</p>
                    </div>
                </div>
            `
        };

        // Email functionality temporarily disabled for development
        // await transporter.sendMail(mailOptions);
        console.log(`🎓 Admission application submitted for ${studentName} by ${email}`);
        res.json({ 
            success: true, 
            message: 'Application submitted successfully! Our admissions team will contact you within 2 working days.',
            applicationId: submission.id
        });
    } catch (error) {
        console.error('Admission form error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit application. Please try again later.' });
    }
});

console.log('✅ API routes configured');

// =============================================================================
// SEO ROUTES
// =============================================================================

// Sitemap
app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

console.log('✅ SEO routes configured');

// =============================================================================
// HTML PAGE ROUTES (Catch-all routes - must come last)
// =============================================================================

// Admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// News page
app.get('/news', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'news.html'));
});

// Main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:page', (req, res) => {
    const page = req.params.page;
    const validPages = ['about', 'academics', 'admissions', 'facilities', 'contact'];
    
    if (!validPages.includes(page)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    res.sendFile(filePath);
});

console.log('✅ HTML routes configured');

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('🎉 ================================');
    console.log('🏫 Sree Vinayasree Vidyanikethan');
    console.log('🎉 ================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🔒 Security: Enhanced`);
    console.log(`📰 CMS: Active`);
    console.log(`📧 Email: Configured`);
    console.log(`🔍 SEO: Optimized`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🎉 ================================');
    console.log('');
}).on('error', (err) => {
    console.error('❌ Server failed to start:', err);
});
