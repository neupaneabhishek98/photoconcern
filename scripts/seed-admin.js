#!/usr/bin/env node
/**
 * Seed a user account.
 *
 * By default creates a regular customer account for the admin email.
 * Per project spec: "no difference for admin — keep it same as others", so
 * this creates a normal User document (not the separate Admin collection).
 *
 * Usage:
 *     npm run seed-admin
 *     npm run seed-admin -- --email=you@example.com --password=Secret!23 --name="Your Name"
 *
 * If --password is omitted, a strong one is generated and printed once.
 * Safe to run repeatedly — it updates the existing user's password instead
 * of creating duplicates.
 */

const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/register.models");

function parseArgs() {
    const out = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.*)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
}

function makePassword(len = 14) {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    const buf = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) s += alphabet[buf[i] % alphabet.length];
    return s + "!A1";
}

async function main() {
    const args = parseArgs();
    const email = (args.email || "neupaneabhishek98@gmail.com").toLowerCase().trim();
    const name = args.name || "Abhishek Neupane";
    const phone = args.phone || "";
    const password = args.password || makePassword();
    const generated = !args.password;

    if (!process.env.atlas_url) {
        console.error("✗ atlas_url is not set in .env. Cannot connect to MongoDB.");
        process.exit(1);
    }

    console.log("Connecting to MongoDB…");
    await mongoose.connect(process.env.atlas_url, { serverSelectionTimeoutMS: 8000 });
    console.log("Connected.");

    const hashed = await bcrypt.hash(password, 10);

    let user = await User.findOne({
        $or: [
            { email_address: email },
            { studio_email: email },
            { free_email: email },
        ],
    });

    if (user) {
        user.password = hashed;
        if (!user.full_name) user.full_name = name;
        if (!user.email_address) user.email_address = email;
        if (phone && !user.phone) user.phone = phone;
        user.authProvider = "local";
        await user.save();
        console.log(`✓ Updated existing user ${email} (_id=${user._id}).`);
    } else {
        user = await User.create({
            full_name: name,
            email_address: email,
            phone,
            password: hashed,
            role: "customer",
            authProvider: "local",
        });
        console.log(`✓ Created new user ${email} (_id=${user._id}).`);
    }

    if (generated) {
        console.log("");
        console.log("  Generated password (save this — won't be shown again):");
        console.log("    " + password);
        console.log("");
    } else {
        console.log("  Password was provided via --password.");
    }
    console.log("Sign in at: http://localhost:3000/login");

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("✗ Seed failed:", err.message);
    process.exit(1);
});
