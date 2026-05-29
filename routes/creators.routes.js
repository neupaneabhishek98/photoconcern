const express = require("express");
const multer = require("multer");
const CreatorSubmission = require("../models/creator_submission.models");

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
        const description = String(req.body.description || "").trim();
        const ownerConfirmed = req.body.ownerConfirmed === "true";

        if (!req.files?.length) {
            return res.status(400).json({ message: "Upload at least one photograph." });
        }
        if (!description) {
            return res.status(400).json({ message: "Please describe the photograph submission." });
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
