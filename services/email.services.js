const nodemailer = require("nodemailer");

function makeTransporter() {
    return nodemailer.createTransport({
        host:   "smtp.gmail.com",
        port:   465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

async function sendEmail({ to, subject, html }) {
    try {
        const transporter = makeTransporter();
        const info = await transporter.sendMail({
            from:    `"PhotoConcern" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log("[email] sent:", info.messageId);
        return info;
    } catch (err) {
        console.error("[email] error:", err.message);
        throw err;
    }
}

module.exports = { sendEmail };
