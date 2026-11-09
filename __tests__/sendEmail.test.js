jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const envKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'];
let originalEnv;
let nodemailer;
let transport;

beforeEach(() => {
    originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    Object.assign(process.env, {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'sender@example.com',
        SMTP_PASSWORD: 'test-password',
        EMAIL_FROM: 'sender@example.com'
    });
    jest.resetModules();
    nodemailer = require('nodemailer');
    transport = {
        verify: jest.fn().mockResolvedValue(true),
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message' })
    };
    nodemailer.createTransport.mockReturnValue(transport);
});

afterEach(() => {
    for (const key of envKeys) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
    }
});

test('exports a connection verifier callable without arguments', async () => {
    const { verifyEmailConnection } = require('../utils/sendEmail');
    await expect(verifyEmailConnection()).resolves.toBe(true);
    expect(transport.verify).toHaveBeenCalledTimes(1);
    expect(transport.sendMail).not.toHaveBeenCalled();
});

test('reads SMTP_PORT and configures STARTTLS for port 587', async () => {
    const { sendEmail } = require('../utils/sendEmail');
    await sendEmail({ to: 'recipient@example.com', subject: 'Test', text: 'Hello' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
        host: 'smtp.example.com', port: 587, secure: false, requireTLS: true
    }));
    expect(transport.sendMail).toHaveBeenCalledWith({
        from: 'sender@example.com', to: 'recipient@example.com', subject: 'Test', text: 'Hello'
    });
});

test('uses immediate TLS for port 465', async () => {
    process.env.SMTP_PORT = '465';
    const { verifyEmailConnection } = require('../utils/sendEmail');
    await verifyEmailConnection();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
        port: 465, secure: true
    }));
});
