const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
    if (!transporter) {
        const port = Number(process.env.SMTP_PORT);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: port,
            secure: port === 465, // true for 465, false for other ports
            requireTLS: port !== 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            }
        });
    }
    return transporter;
};

exports.sendEmail = async({to,subject,text}) => {
    return getTransporter().sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text
    });
};

exports.verifyEmailConnection = async () => {
    return getTransporter().verify();
};
