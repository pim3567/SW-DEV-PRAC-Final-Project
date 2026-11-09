const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');

const {register, login, getMe, logout} = require('../controllers/auth');
const { forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/passwordReset');

const router = express.Router();

const {protect} = require('../middleware/auth');

const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many password reset requests. Please try again later.'
    }
});

const parseResetForm = multer({
    limits: {
        fields: 3,
        fieldSize: 320,
        files: 0
    }
}).none();

const parsePasswordResetForm = (req, res, next) => {
    parseResetForm(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid multipart form data'
            });
        }
        next();
    });
};

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', passwordResetLimiter, parsePasswordResetForm, forgotPassword);
router.post('/verify-otp', passwordResetLimiter, parsePasswordResetForm, verifyResetOtp);
router.post('/reset-password', passwordResetLimiter, parsePasswordResetForm, resetPassword);
router.get('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
