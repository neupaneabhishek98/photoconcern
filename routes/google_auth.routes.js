/**
 * Google Sign-In for customers.
 *
 *   GET  /api/auth/google/config  → returns { clientId } for the frontend
 *   POST /api/auth/google         → body: { credential }
 *                                   verifies the Google ID token, finds or
 *                                   creates a User in MongoDB, sets the
 *                                   session, returns redirect info.
 *
 * Setup:
 *   - Create an OAuth 2.0 Client (Web application) in Google Cloud Console.
 *     Authorized JavaScript origins: http://localhost:3000 (and prod URL).
 *   - Put the client ID in .env as GOOGLE_CLIENT_ID.
 */

const express = require("express");
const router = express.Router();
const User = require("../models/register.models");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

// Lazy-load google-auth-library so the server still boots if the user hasn't
// run `npm install` after the merge.
let OAuth2Client = null;
let oauthClient = null;
function getOauthClient() {
    if (oauthClient) return oauthClient;
    if (!OAuth2Client) {
        ({ OAuth2Client } = require("google-auth-library"));
    }
    oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    return oauthClient;
}

/** GET /api/auth/google/config — frontend uses this to init the GIS button. */
router.get("/auth/google/config", (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(500).json({
            message: "GOOGLE_CLIENT_ID is not configured on the server. See SETUP.md.",
        });
    }
    return res.json({ clientId: GOOGLE_CLIENT_ID });
});

/** POST /api/auth/google — body: { credential } (the Google ID token JWT) */
router.post("/auth/google", async (req, res) => {
    try {
        const { credential } = req.body || {};
        if (!credential) {
            return res.status(400).json({ message: "Missing Google credential" });
        }
        if (!GOOGLE_CLIENT_ID) {
            return res.status(500).json({
                message: "Server is missing GOOGLE_CLIENT_ID. See SETUP.md.",
            });
        }

        // Verify the ID token with Google's published certs.
        const ticket = await getOauthClient().verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub) {
            return res.status(401).json({ message: "Invalid Google token" });
        }
        if (!payload.email_verified) {
            return res.status(401).json({ message: "Your Google email is not verified." });
        }

        const email = (payload.email || "").toLowerCase();
        const googleId = payload.sub;

        // Find by googleId first, then fall back to email (link existing account).
        let user = await User.findOne({ googleId });
        if (!user && email) {
            user = await User.findOne({
                $or: [
                    { email_address: email },
                    { studio_email: email },
                    { free_email: email },
                ],
            });
        }

        if (user) {
            // Link the Google account if this is an existing local user.
            let changed = false;
            if (!user.googleId) { user.googleId = googleId; changed = true; }
            if (!user.picture && payload.picture) { user.picture = payload.picture; changed = true; }
            if (!user.full_name && payload.name) { user.full_name = payload.name; changed = true; }
            if (!user.email_address && email) { user.email_address = email; changed = true; }
            if (user.authProvider !== "google" && !user.password) {
                user.authProvider = "google";
                changed = true;
            }
            if (changed) await user.save();
        } else {
            // New customer — create a password-less account.
            user = await User.create({
                full_name: payload.name || email.split("@")[0] || "Customer",
                email_address: email,
                googleId,
                picture: payload.picture || null,
                authProvider: "google",
                role: "customer",
            });
        }

        // Set session
        req.session.userId = user._id;

        return res.json({
            type: "success",
            message: `Welcome${user.full_name ? ", " + user.full_name.split(" ")[0] : ""}!`,
            redirect: "/",
            delay: 1500,
            user: {
                id: user._id,
                email: user.email_address,
                name: user.full_name,
                picture: user.picture,
            },
        });
    } catch (err) {
        console.error("[auth/google]", err);
        if (err.message && err.message.includes("Wrong recipient")) {
            return res.status(401).json({
                message: "Google client ID mismatch. The frontend and backend GOOGLE_CLIENT_ID must match.",
            });
        }
        return res.status(500).json({ message: "Google sign-in failed. Please try again." });
    }
});

module.exports = router;
