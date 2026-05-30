const express = require("express");
const multer = require("multer");
const CreatorSubmission = require("../models/creator_submission.models");
const { sendEmail } = require("../services/email.services");

function lazy(modulePath) {
    let mod = null;
    return new Proxy({}, {
        get(_, prop) {
            if (!mod) mod = require(modulePath);
            return mod[prop];
        }
    });
}

const drive = lazy("../services/drive.services");
const router = express.Router();
const CREATORS_NOTIFY_EMAIL = "neupaneabhishek98@gmail.com";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 30,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
});

function handleCreatorUpload(req, res, next) {
    upload.array("photos", 30)(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: err.message || "Could not read the uploaded photographs." });
    });
}

router.post("/creators", handleCreatorUpload, async (req, res) => {
    try {
        const description = String(req.body.description || "").trim() || `PhotoConcern Creators submission with ${req.files?.length || 0} photograph(s).`;
        const ownerConfirmed = req.body.ownerConfirmed === "true";

        if (!req.files?.length) {
            return res.status(400).json({ message: "Upload at least one photograph." });
        }
        if (!ownerConfirmed) {
            return res.status(400).json({ message: "Please confirm that you own the submitted photograph(s)." });
        }

        const label = `PhotoConcern Creators ${new Date().toISOString().slice(0, 10)}`;
        const result = await drive.uploadOrderFiles(label, req.files, {
            orderId: `CREATORS-${Date.now()}`,
        });
        const photoUrls = result.files.map((file) => file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`);

        const submission = await CreatorSubmission.create({
            description,
            ownerConfirmed,
            photoUrls,
            driveFolderId: result.folderId,
            driveFolderUrl: result.folderUrl,
            fileCount: req.files.length,
            submitterIp: req.ip,
            userAgent: req.get("user-agent") || "",
        });

        try {
            const fileList = req.files.map((file) => `<li>${escapeHtml(file.originalname)}</li>`).join("");
            const folderUrl = escapeHtml(submission.driveFolderUrl || "");
            await sendEmail({
                to: CREATORS_NOTIFY_EMAIL,
                subject: "New PhotoConcern Creators submission",
                html: `<h2>New PhotoConcern Creators submission</h2>
                       <p><b>Photos:</b> ${req.files.length}</p>
                       <p><b>Description:</b> ${escapeHtml(description)}</p>
                       <p><b>Drive folder:</b> <a href="${folderUrl}">${folderUrl}</a></p>
                       <p><b>Files:</b></p>
                       <ul>${fileList}</ul>`,
            });
        } catch (emailErr) {
            console.error("[creators/email]", emailErr.message);
        }

        return res.status(201).json({
            message: "Your PhotoConcern Creators submission was sent.",
            submissionId: submission._id,
            folderUrl: submission.driveFolderUrl,
        });
    } catch (err) {
        console.error("[creators/submit]", err);
        return res.status(500).json({ message: err.message || "Could not send your submission." });
    }
});

module.exports = router;
