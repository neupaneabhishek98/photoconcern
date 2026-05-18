#!/usr/bin/env node
/**
 * Setup checker for the Photo Concern Website.
 *
 *   npm run check
 *
 * Verifies that everything the server needs is in place:
 *   - node_modules installed (incl. googleapis, qrcode, google-auth-library)
 *   - .env exists and the required variables are set
 *   - config/service-account.json exists and looks valid (if STORAGE_BACKEND=drive)
 *   - Optional integrations (Twilio, Email, Fonepay live) flagged but not required
 *
 * Exit code: 0 if everything required is OK, 1 otherwise.
 */

const fs   = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Load .env without overriding existing env vars (so the script reports what
// the real running server would see).
try { require("dotenv").config({ path: path.join(ROOT, ".env") }); }
catch (_) { /* dotenv may not be installed yet — handled below */ }

const C = {
    g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", b: "\x1b[1m",
    dim: "\x1b[2m", reset: "\x1b[0m"
};

let errors = 0;
let warnings = 0;

function ok(label, detail = "")  { console.log(`${C.g}✓${C.reset} ${label}` + (detail ? `  ${C.dim}${detail}${C.reset}` : "")); }
function warn(label, detail = "") { warnings++; console.log(`${C.y}⚠${C.reset} ${label}` + (detail ? `  ${C.dim}${detail}${C.reset}` : "")); }
function bad(label, detail = "")  { errors++;   console.log(`${C.r}✗${C.reset} ${label}` + (detail ? `  ${C.dim}${detail}${C.reset}` : "")); }
function section(title) { console.log(`\n${C.b}${title}${C.reset}`); }

// ── 1. Dependencies ────────────────────────────────────────
section("Dependencies");

const required = [
    "express", "mongoose", "express-session", "cookie-parser", "bcrypt",
    "dotenv", "multer", "googleapis", "google-auth-library", "qrcode"
];
const optional = ["twilio", "nodemailer", "@aws-sdk/client-s3"];

if (!fs.existsSync(path.join(ROOT, "node_modules"))) {
    bad("node_modules/ missing", "Run: npm install");
} else {
    for (const m of required) {
        if (fs.existsSync(path.join(ROOT, "node_modules", m, "package.json"))) {
            ok(`${m} installed`);
        } else {
            bad(`${m} missing`, "Run: npm install");
        }
    }
    for (const m of optional) {
        if (!fs.existsSync(path.join(ROOT, "node_modules", m, "package.json"))) {
            warn(`${m} not installed`, "optional");
        }
    }
}

// ── 2. .env file ───────────────────────────────────────────
section("Environment file");

const envPath = path.join(ROOT, ".env");
if (!fs.existsSync(envPath)) {
    bad(".env missing", "Copy .env.example to .env and fill it in");
} else {
    ok(".env exists");
}

function envSet(key) {
    return typeof process.env[key] === "string" && process.env[key].trim() !== "";
}

// ── 3. Core required variables ─────────────────────────────
section("Core configuration");

if (!envSet("SESSION_SECRET")) {
    bad("SESSION_SECRET not set");
} else if (process.env.SESSION_SECRET.includes("change-me") || process.env.SESSION_SECRET.length < 24) {
    warn("SESSION_SECRET is short or default", "Use a 32+ char random string for production");
} else {
    ok("SESSION_SECRET set");
}

if (!envSet("atlas_url")) {
    bad("atlas_url not set", "Local Mongo or Atlas connection string");
} else {
    const url = process.env.atlas_url;
    if (url.startsWith("mongodb+srv://")) {
        ok("atlas_url set (Atlas)");
    } else if (url.startsWith("mongodb://")) {
        ok("atlas_url set (local/standard)");
    } else {
        warn("atlas_url set but does not look like a MongoDB URL");
    }
}

// ── 4. Storage backend (Drive) ─────────────────────────────
section("Photo upload storage");

const backend = (process.env.STORAGE_BACKEND || "drive").toLowerCase();
ok(`STORAGE_BACKEND = ${backend}`);

if (backend === "drive") {
    const keyPath = path.resolve(ROOT, process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE || "./config/service-account.json");
    if (!fs.existsSync(keyPath)) {
        bad("Service-account JSON missing", keyPath);
    } else {
        try {
            const j = JSON.parse(fs.readFileSync(keyPath, "utf8"));
            if (j.type !== "service_account") {
                bad("Service-account JSON has wrong type", `expected "service_account", got "${j.type}"`);
            } else if (!j.client_email || !j.private_key) {
                bad("Service-account JSON missing client_email or private_key");
            } else {
                ok("Service-account JSON valid", j.client_email);
                console.log(`    ${C.dim}↳ make sure the "${process.env.DRIVE_ROOT_FOLDER_NAME || "Online Orders"}" folder in Drive is shared with this email (Editor)${C.reset}`);
            }
        } catch (e) {
            bad("Service-account JSON is not valid JSON", e.message);
        }
    }
    if (!envSet("DRIVE_ROOT_FOLDER_NAME")) {
        warn("DRIVE_ROOT_FOLDER_NAME not set", 'default: "Online Orders"');
    } else {
        ok(`DRIVE_ROOT_FOLDER_NAME = ${process.env.DRIVE_ROOT_FOLDER_NAME}`);
    }
} else if (backend === "r2") {
    for (const k of ["ENDPOINTS_URL", "Access_Key_ID", "SECRET_ACCESS_KEY", "bucket_name", "R2_PUBLIC_URL"]) {
        if (!envSet(k)) bad(`${k} not set (required for STORAGE_BACKEND=r2)`);
        else ok(`${k} set`);
    }
} else {
    bad(`Unknown STORAGE_BACKEND "${backend}"`, 'expected "drive" or "r2"');
}

// ── 5. Google Sign-In ──────────────────────────────────────
section("Google Sign-In (customer login)");

if (!envSet("GOOGLE_CLIENT_ID")) {
    warn("GOOGLE_CLIENT_ID not set", "Google login button will show a clear error until configured");
} else if (!process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")) {
    warn("GOOGLE_CLIENT_ID does not end with .apps.googleusercontent.com", "Double-check you copied the right value");
} else {
    ok("GOOGLE_CLIENT_ID set");
}

// ── 6. Fonepay ─────────────────────────────────────────────
section("Fonepay payment");

const fpMode = (process.env.FONEPAY_MODE || "test").toLowerCase();
if (fpMode === "test") {
    ok("FONEPAY_MODE = test", "test QRs will be generated; fine for development");
} else if (fpMode === "live") {
    let missing = false;
    for (const k of ["FONEPAY_MERCHANT_CODE", "FONEPAY_USERNAME", "FONEPAY_PASSWORD", "FONEPAY_SECRET_KEY", "FONEPAY_API_BASE"]) {
        if (!envSet(k)) { bad(`${k} not set (required for FONEPAY_MODE=live)`); missing = true; }
    }
    if (!missing) ok("FONEPAY_MODE = live + all credentials set");
    warn("services/fonepay.services.js requestLiveQr() is a stub", "Fill it in per your Fonepay merchant kit");
} else {
    bad(`Unknown FONEPAY_MODE "${fpMode}"`, 'expected "test" or "live"');
}

// ── 7. Notifications (optional) ────────────────────────────
section("Notifications (optional)");

if (envSet("EMAIL_USER") && envSet("EMAIL_PASS")) ok("Email enabled", process.env.EMAIL_USER);
else warn("Email not configured", "Contact form will not send; orders unaffected");

if (envSet("TWILIO_ACCOUNT_SID") && envSet("TWILIO_AUTH_TOKEN") && envSet("ADMIN_WHATSAPP")) {
    ok("Twilio WhatsApp enabled", process.env.ADMIN_WHATSAPP);
} else {
    warn("Twilio WhatsApp not configured", "Order notifications will not be sent; orders unaffected");
}

// ── 8. Admin seed ──────────────────────────────────────────
section("Admin seed");

if (envSet("ADMIN_USERNAME") && envSet("ADMIN_PASSWORD")) {
    if (process.env.ADMIN_PASSWORD === "ChangeMe123!") {
        warn("ADMIN_PASSWORD is the default", "Change it before going live");
    } else {
        ok("ADMIN_USERNAME + ADMIN_PASSWORD set");
    }
} else {
    warn("Admin will not auto-seed on first boot", "Set ADMIN_USERNAME + ADMIN_PASSWORD to enable");
}

// ── Summary ────────────────────────────────────────────────
console.log();
if (errors === 0 && warnings === 0) {
    console.log(`${C.g}${C.b}All checks passed.${C.reset} You're ready to run ${C.b}npm start${C.reset}.`);
} else if (errors === 0) {
    console.log(`${C.y}${C.b}${warnings} warning(s).${C.reset} You can run ${C.b}npm start${C.reset} but some optional features are off.`);
} else {
    console.log(`${C.r}${C.b}${errors} blocker(s)${C.reset}, ${C.y}${warnings} warning(s)${C.reset}. Fix the blockers above before ${C.b}npm start${C.reset}.`);
}

process.exit(errors === 0 ? 0 : 1);
