const express = require("express");
const router  = express.Router();
const User    = require("../models/register.models");
const bcrypt  = require("bcrypt");

function isValidPhone(phone) {
    const d = String(phone).replace(/\D/g, "");
    return d.length === 8 || d.length === 10;
}

function isValidPan(pan) {
    const d = String(pan).replace(/\D/g, "");
    return d.length === 9;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidPassword(password) {
    return String(password || "").length >= 8;
}

router.post("/register", async (req, res) => {
    try {
        const role = (req.body.role || "").toLowerCase();
        let finalData = { role };
        let emailToCheck;

        if (role === "customer") {
            const { full_name, email_address, phone, password } = req.body;

            if (!email_address || !password)
                return res.status(400).json({ message: "Email and password are required" });

            if (!isValidEmail(email_address))
                return res.status(400).json({ message: "Enter a valid email address" });

            if (!isValidPassword(password))
                return res.status(400).json({ message: "Password must be at least 8 characters" });

            if (phone && !isValidPhone(phone))
                return res.status(400).json({ message: "Phone number must be 8 or 10 digits" });

            emailToCheck            = email_address.toLowerCase().trim();
            finalData.full_name     = full_name;
            finalData.email_address = emailToCheck;
            finalData.phone         = String(phone || "").trim();
            finalData.password      = await bcrypt.hash(password.toString(), 10);

        } else if (role === "studio") {
            const { studio_name, studio_email, studio_phone, studio_pan, studio_location, studio_password } = req.body;

            if (!studio_email || !studio_password)
                return res.status(400).json({ message: "Studio email and password are required" });

            if (!isValidEmail(studio_email))
                return res.status(400).json({ message: "Enter a valid studio email address" });

            if (!isValidPassword(studio_password))
                return res.status(400).json({ message: "Password must be at least 8 characters" });

            if (studio_phone && !isValidPhone(studio_phone))
                return res.status(400).json({ message: "Phone number must be 8 or 10 digits" });

            if (studio_pan && !isValidPan(studio_pan))
                return res.status(400).json({ message: "PAN number must be exactly 9 digits" });

            emailToCheck              = studio_email.toLowerCase().trim();
            finalData.studio_name     = studio_name;
            finalData.studio_email    = emailToCheck;
            finalData.studio_phone    = String(studio_phone || "").trim();
            finalData.studio_pan      = studio_pan;
            finalData.studio_location = String(studio_location || "").trim();
            finalData.email_address   = emailToCheck;
            finalData.studio_password = await bcrypt.hash(studio_password, 10);

        } else if (role === "freelancer") {
            const { free_name, free_email, free_phone, free_pan, free_location, free_password } = req.body;

            if (!free_email || !free_password)
                return res.status(400).json({ message: "Email and password are required" });

            if (!isValidEmail(free_email))
                return res.status(400).json({ message: "Enter a valid email address" });

            if (!isValidPassword(free_password))
                return res.status(400).json({ message: "Password must be at least 8 characters" });

            if (free_phone && !isValidPhone(free_phone))
                return res.status(400).json({ message: "Phone number must be 8 or 10 digits" });

            if (free_pan && !isValidPan(free_pan))
                return res.status(400).json({ message: "PAN number must be exactly 9 digits" });

            emailToCheck          = free_email.toLowerCase().trim();
            finalData.free_name   = free_name;
            finalData.free_email  = emailToCheck;
            finalData.free_phone  = String(free_phone || "").trim();
            finalData.free_pan    = free_pan;
            finalData.free_location = String(free_location || "").trim();
            finalData.email_address = emailToCheck;
            finalData.free_password = await bcrypt.hash(free_password.toString(), 10);

        } else {
            return res.status(400).json({ message: "Invalid role" });
        }

        // check email across all roles
        const existingUser = await User.findOne({
            $or: [
                { email_address: emailToCheck },
                { studio_email:  emailToCheck },
                { free_email:    emailToCheck },
            ]
        });
        if (existingUser)
            return res.status(400).json({ message: "An account with this email already exists" });

        await new User(finalData).save();

        return res.json({
            type:     "success",
            message:  "Registered successfully! Redirecting to login...",
            redirect: "/login",
            delay:    5000,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
