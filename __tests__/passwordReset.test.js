jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
}));
jest.mock('../utils/sendEmail', () => ({ sendEmail: jest.fn() }));

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendEmail } = require('../utils/sendEmail');
const { forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/passwordReset');

const response = {
    success: true,
    message: 'If this email is registered, a reset code will be sent.'
};
const user = { _id: 'test-user', email: 'test@example.com' };
let originalSecret;

beforeEach(() => {
    originalSecret = process.env.OTP_SECRET;
    process.env.OTP_SECRET = 'test-only-otp-secret';
    jest.resetAllMocks();
    User.findOne.mockResolvedValue(user);
    User.findOneAndUpdate.mockResolvedValue(user);
    sendEmail.mockResolvedValue({ messageId: 'test-message' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    if (originalSecret === undefined) delete process.env.OTP_SECRET;
    else process.env.OTP_SECRET = originalSecret;
    jest.restoreAllMocks();
});

async function requestOtp(body = { email: user.email }) {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
    await forgotPassword({ body }, res);
    return res;
}

test('sends an OTP and completes the request with the generic response', async () => {
    const res = await requestOtp();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(response);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe(user.email);
});

test('stores an OTP hash with the same expiry advertised by the email', async () => {
    await requestOtp();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    const otp = email.text.match(/code is: (\d{6})/)[1];
    const update = User.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.resetOtpHash).toBe(crypto.createHmac('sha256', process.env.OTP_SECRET)
        .update(otp).digest('hex'));
    expect(update.$set.resetOtpHash).not.toBe(otp);
    const expiryMinutes = Number(email.text.match(/expires in (\d+) minutes/)[1]);
    expect(expiryMinutes).toBeGreaterThan(0);
    expect(update.$set.resetOtpExpire - update.$set.resetOtpSentAt).toBe(expiryMinutes * 60 * 1000);
    expect(update.$set.resetOtpAttempts).toBe(0);
    expect(update.$unset).toEqual({ resetPasswordToken: '', resetPasswordExpire: '' });
});

test.each(['unknown', 'cooldown'])('returns the same response for %s without sending email', async state => {
    if (state === 'unknown') User.findOne.mockResolvedValue(null);
    else User.findOneAndUpdate.mockResolvedValue(null);
    const res = await requestOtp();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(response);
    expect(sendEmail).not.toHaveBeenCalled();
});

test('rejects missing email before accessing the database', async () => {
    const res = await requestOtp({});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findOne).not.toHaveBeenCalled();
});

test('handles email delivery failure without hanging or revealing account existence', async () => {
    sendEmail.mockRejectedValue(Object.assign(new Error('SMTP failure'), { code: 'EAUTH' }));
    const res = await requestOtp();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(response);
    expect(console.error).toHaveBeenCalledWith('Reset OTP email delivery failed:', 'EAUTH');
});

describe('Verify reset OTP', () => {
    let account;
    const otp = '123456';

    beforeEach(() => {
        account = {
            ...user,
            resetOtpHash: crypto.createHmac('sha256', process.env.OTP_SECRET).update(otp).digest('hex'),
            resetOtpExpire: new Date(Date.now() + 5 * 60 * 1000),
            resetOtpAttempts: 0
        };
        User.findOneAndUpdate.mockImplementation(async (filter, update) => {
            if (!account || account.email !== filter.email) return null;
            if (!account.resetOtpHash) return null;
            if (typeof filter.resetOtpHash === 'string' && account.resetOtpHash !== filter.resetOtpHash) return null;
            if (filter.resetOtpHash?.$ne === account.resetOtpHash) return null;
            if (!(account.resetOtpExpire > filter.resetOtpExpire.$gt)) return null;
            if (!(account.resetOtpAttempts < filter.resetOtpAttempts.$lt)) return null;
            Object.assign(account, update.$set);
            for (const key of Object.keys(update.$unset || {})) delete account[key];
            for (const [key, value] of Object.entries(update.$inc || {})) account[key] += value;
            return { ...account };
        });
    });

    async function verify(body = { email: user.email, otp }) {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        await verifyResetOtp({ body }, res);
        return res;
    }

    test('exchanges a correct OTP for an expiring token stored only as a hash', async () => {
        const res = await verify();
        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.resetToken).toMatch(/^[a-f0-9]{64}$/);
        expect(account.resetPasswordToken).toBe(crypto.createHash('sha256').update(body.resetToken).digest('hex'));
        expect(account.resetPasswordToken).not.toBe(body.resetToken);
        expect(account.resetPasswordExpire.getTime()).toBeGreaterThan(Date.now());
        expect(account.resetPasswordExpire.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
        expect(account.resetOtpHash).toBeUndefined();
        expect(sendEmail).not.toHaveBeenCalled();
    });

    test('rejects reuse of the OTP', async () => {
        await verify();
        const tokenHash = account.resetPasswordToken;
        const again = await verify();
        expect(again.status).toHaveBeenCalledWith(400);
        expect(account.resetPasswordToken).toBe(tokenHash);
    });

    test('only one concurrent verification can consume the same OTP', async () => {
        const results = await Promise.all([verify(), verify()]);
        expect(results.filter(res => res.status.mock.calls[0][0] === 200)).toHaveLength(1);
        expect(results.filter(res => res.status.mock.calls[0][0] === 400)).toHaveLength(1);
    });

    test.each(['expired', 'unknown', 'exhausted'])('rejects %s OTP requests', async state => {
        if (state === 'expired') account.resetOtpExpire = new Date(Date.now() - 1000);
        if (state === 'unknown') account = null;
        if (state === 'exhausted') account.resetOtpAttempts = 5;
        const res = await verify();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].resetToken).toBeUndefined();
    });

    test('five incorrect guesses prevent a later correct OTP from succeeding', async () => {
        for (let i = 0; i < 5; i++) {
            expect((await verify({ email: user.email, otp: '999999' })).status).toHaveBeenCalledWith(400);
        }
        expect(account.resetOtpAttempts).toBe(5);
        expect((await verify()).status).toHaveBeenCalledWith(400);
        expect(account.resetPasswordToken).toBeUndefined();
    });

    test.each([{}, { email: user.email, otp: 'abc' }, { email: user.email, otp: 123456 }])(
        'rejects malformed input %p before accessing the database', async body => {
            User.findOneAndUpdate.mockClear();
            const res = await verify(body);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(User.findOneAndUpdate).not.toHaveBeenCalled();
        }
    );
});

describe('Reset password', () => {
    const resetToken = 'a'.repeat(64);
    const newPassword = 'NewPassword123!';
    let account;

    beforeEach(() => {
        account = {
            ...user,
            password: 'old-password-hash',
            tokenVersion: 0,
            resetPasswordToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
            resetPasswordExpire: new Date(Date.now() + 5 * 60 * 1000),
            resetOtpHash: 'old-otp-hash'
        };
        User.findOneAndUpdate.mockImplementation(async (filter, update) => {
            if (!account || filter.resetPasswordToken !== account.resetPasswordToken ||
                !(account.resetPasswordExpire > filter.resetPasswordExpire.$gt)) return null;
            Object.assign(account, update.$set);
            for (const key of Object.keys(update.$unset || {})) delete account[key];
            for (const [key, value] of Object.entries(update.$inc || {})) account[key] += value;
            return { ...account };
        });
    });

    async function reset(overrides = {}) {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        await resetPassword({ body: {
            resetToken, password: newPassword, confirmPassword: newPassword, ...overrides
        } }, res);
        return res;
    }

    test('hashes the new password, consumes the reset token, and revokes previous logins', async () => {
        const res = await reset();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(await bcrypt.compare(newPassword, account.password)).toBe(true);
        expect(account.password).not.toBe(newPassword);
        expect(account.resetPasswordToken).toBeUndefined();
        expect(account.resetPasswordExpire).toBeUndefined();
        expect(account.resetOtpHash).toBeUndefined();
        expect(account.tokenVersion).toBe(1);
        expect(res.json.mock.calls[0][0].password).toBeUndefined();
        expect(res.json.mock.calls[0][0].token).toBeUndefined();
    });

    test('rejects reset-token reuse', async () => {
        await reset();
        expect((await reset()).status).toHaveBeenCalledWith(400);
        expect(account.tokenVersion).toBe(1);
    });

    test('only one concurrent request can reset the password with the same token', async () => {
        const results = await Promise.all([reset(), reset()]);
        expect(results.filter(res => res.status.mock.calls[0][0] === 200)).toHaveLength(1);
        expect(results.filter(res => res.status.mock.calls[0][0] === 400)).toHaveLength(1);
    });

    test.each(['expired', 'unknown'])('rejects an %s token without changing the password', async state => {
        if (state === 'expired') account.resetPasswordExpire = new Date(Date.now() - 1000);
        else account = null;
        expect((await reset()).status).toHaveBeenCalledWith(400);
        if (account) expect(account.password).toBe('old-password-hash');
    });

    test.each([
        { confirmPassword: 'different' },
        { password: 'short', confirmPassword: 'short' },
        { password: 'x'.repeat(73), confirmPassword: 'x'.repeat(73) },
        { resetToken: 'invalid' },
        { resetToken: null },
        { password: null },
        { confirmPassword: null }
    ])('rejects invalid input %p before accessing the database', async overrides => {
        const res = await reset(overrides);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(User.findOneAndUpdate).not.toHaveBeenCalled();
        expect(account.password).toBe('old-password-hash');
    });
});
