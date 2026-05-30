const mongoose    = require("mongoose");
const express     = require("express");
const router      = express.Router();
const User        = require("../models/register.models");
const bcrypt      = require("bcrypt");
const nodemailer  = require("nodemailer");
const authMiddleware = require("../middlewares/auth.middleware");

// in-memory OTP store: { email → { otp, expiresAt, resetToken } }
// For production scale use Redis, but this works fine for a single-server setup

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email_address, password } = req.body;
    if (!email_address || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // normalize input email
    const emailInput = email_address.toLowerCase().trim();

    // Find user in any role
    const user = await User.findOne({
      $or: [
        { email_address: emailInput },
        { studio_email: emailInput },
        { free_email: emailInput }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Determine which password field to use
    let passwordToCompare = null;
    const customerEmail = user.email_address?.toLowerCase();
    const studioEmail = user.studio_email?.toLowerCase();
    const freelancerEmail = user.free_email?.toLowerCase();

    if (user.password && emailInput === customerEmail) {
      passwordToCompare = user.password;
    } else if (user.studio_password && emailInput === studioEmail) {
      passwordToCompare = user.studio_password;
    } else if (user.free_password && emailInput === freelancerEmail) {
      passwordToCompare = user.free_password;
    }

    // If no password found, fail
    if (!passwordToCompare) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare password safely
    const isMatch = await bcrypt.compare(password, passwordToCompare);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Regenerate the session on login to prevent session fixation.
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user._id;

    return res.json({
      type: "success",
      message: "Login successful! Redirecting to homepage...",
      redirect: "/",
      delay: 5000
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Destroy session on logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ message: "Error logging out" });
    }
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
});



/* ════════════════════════════════════════════════════════════
   FORGOT PASSWORD — 3-step flow
   1. POST /api/forgot-password/send-otp   → sends 6-digit OTP to email
   2. POST /api/forgot-password/verify-otp → checks OTP, returns resetToken
   3. POST /api/forgot-password/reset      → verifies token, sets new password
   ════════════════════════════════════════════════════════════ */

// in-memory OTP store: email → { otp, expiresAt, resetToken, verified }
const otpStore = new Map();

function makeTransporter() {
    return nodemailer.createTransport({
        host:   "smtp.gmail.com",
        port:   465,
        secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
}

// STEP 1 — send OTP
router.post("/forgot-password/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const emailLower = String(email).toLowerCase().trim();
    const user = await User.findOne({
        $or: [
            { email_address: emailLower },
            { studio_email:  emailLower },
            { free_email:    emailLower },
        ]
    });

    if (!user) {
        // still return 200 to prevent email enumeration on public endpoint
        return res.json({ message: "If that email exists, an OTP has been sent." });
    }

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min

    otpStore.set(emailLower, { otp, expiresAt, resetToken: null, verified: false });

    try {
        await makeTransporter().sendMail({
            from:    `"PhotoConcern" <${process.env.EMAIL_USER}>`,
            to:      emailLower,
            subject: "Your PhotoConcern Password Reset OTP",
            html: `<div style="font-family:sans-serif;max-width:420px">
                     <h2 style="color:#021024">Password Reset</h2>
                     <p>Your one-time password is:</p>
                     <div style="font-size:2rem;font-weight:800;letter-spacing:0.2em;color:#5483B3;padding:16px 0">${otp}</div>
                     <p style="color:#6b7280;font-size:0.88rem">Expires in 10 minutes. Do not share it.</p>
                   </div>`,
        });
    } catch (err) {
        console.error("[otp] email error:", err.message);
        return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    return res.json({ message: "OTP sent successfully." });
});

// STEP 2 — verify OTP
router.post("/forgot-password/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const emailLower = String(email).toLowerCase().trim();
    const record     = otpStore.get(emailLower);

    if (!record)                       return res.status(400).json({ message: "No OTP requested for this email" });
    if (Date.now() > record.expiresAt) { otpStore.delete(emailLower); return res.status(400).json({ message: "OTP expired. Request a new one." }); }
    if (record.otp !== String(otp).trim()) return res.status(400).json({ message: "Incorrect OTP" });

    const resetToken  = Math.random().toString(36).slice(2) + Date.now().toString(36);
    record.resetToken = resetToken;
    record.verified   = true;
    otpStore.set(emailLower, record);

    return res.json({ message: "OTP verified", resetToken });
});

// STEP 3 — reset password
router.post("/forgot-password/reset", async (req, res) => {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) return res.status(400).json({ message: "All fields are required" });

    const emailLower = String(email).toLowerCase().trim();
    const record     = otpStore.get(emailLower);

    if (!record || !record.verified)      return res.status(400).json({ message: "OTP not verified" });
    if (record.resetToken !== resetToken) return res.status(400).json({ message: "Invalid reset token" });
    if (Date.now() > record.expiresAt)    { otpStore.delete(emailLower); return res.status(400).json({ message: "Session expired. Please start again." }); }
    if (String(newPassword).length < 8)   return res.status(400).json({ message: "Password must be at least 8 characters" });

    const hashed = await bcrypt.hash(newPassword, 10);

    const user = await User.findOne({
        $or: [
            { email_address: emailLower },
            { studio_email:  emailLower },
            { free_email:    emailLower },
        ]
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.email_address?.toLowerCase() === emailLower)     user.password        = hashed;
    else if (user.studio_email?.toLowerCase() === emailLower) user.studio_password = hashed;
    else if (user.free_email?.toLowerCase() === emailLower)   user.free_password   = hashed;

    await user.save();
    otpStore.delete(emailLower);

    return res.json({ message: "Password reset successfully" });
});

module.exports = router;
