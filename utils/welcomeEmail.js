const crypto = require('crypto');
const Coupon = require('../models/Coupon');
const { sendEmail } = require('./sendEmail');

const DISCOUNT_PERCENT = 10;
const VALID_DAYS = 30;

const generateCode = () => `WELCOME-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Creates a unique coupon for the user and emails it. Never throws.
exports.sendWelcomeEmail = async (user) => {
    try {
        const expiresAt = new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000);
        let coupon;
        for (let attempt = 0; attempt < 3 && !coupon; attempt++) {
            try {
                coupon = await Coupon.create({
                    code: generateCode(),
                    user: user._id,
                    discountPercent: DISCOUNT_PERCENT,
                    expiresAt
                });
            } catch (err) {
                if (err.code !== 11000) throw err; // retry only on duplicate code
            }
        }
        if (!coupon) throw new Error('Could not generate a unique promo code');

        await sendEmail({
            to: user.email,
            subject: 'Welcome! Here is your promo code',
            text: `Hi ${user.name},\n\nThank you for registering. ` +
                `Use promo code ${coupon.code} to get ${DISCOUNT_PERCENT}% off. ` +
                `It is valid until ${expiresAt.toDateString()}.\n\nEnjoy!`
        });
        return coupon;
    } catch (err) {
        console.error('Failed to send welcome email:', err);
        return null;
    }
};
