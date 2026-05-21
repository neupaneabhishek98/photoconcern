/**
 * Photo tools — passport photo maker (active), MRP & retouch (placeholders).
 *
 * The passport photo route shells out to scripts/passport_photo.py which uses
 * OpenCV to detect the face, straighten, crop to 28×32 mm with proper
 * composition, and optionally replace the background with white.
 *
 * Setup on the host:
 *     pip install opencv-python numpy
 *
 * Override the Python binary with the PYTHON_BIN env var (default: "python").
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const crypto = require("crypto");

const TMP_ROOT = path.join(os.tmpdir(), "pc-passport");
try { fs.mkdirSync(TMP_ROOT, { recursive: true }); } catch (_) {}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, TMP_ROOT),
        filename: (req, file, cb) => {
            const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
            cb(null, "in-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex") + ext);
        },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
});

const SCRIPT = path.resolve(__dirname, "..", "scripts", "passport_photo.py");
// Try common Python binary names — env var wins, then python3, then python.
const PYTHON_CANDIDATES = [process.env.PYTHON_BIN, "python3", "python"].filter(Boolean);

function spawnOnce(bin, args) {
    return new Promise((resolve) => {
        const proc = spawn(bin, args, { windowsHide: true });
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (b) => (stdout += b.toString()));
        proc.stderr.on("data", (b) => (stderr += b.toString()));
        proc.on("error", (err) => resolve({ code: -1, stdout, stderr: stderr + "\n" + err.message }));
        proc.on("close", (code) => resolve({ code, stdout, stderr }));
    });
}

async function runPython(inputPath, outputPath, opts) {
    const args = [SCRIPT, inputPath, outputPath, "--bg", opts.bg, "--dpi", String(opts.dpi)];
    for (const bin of PYTHON_CANDIDATES) {
        const result = await spawnOnce(bin, args);
        if (result.code !== -1) return result;          // Python ran (success or script-level error)
    }
    return { code: -1, stdout: "", stderr: "Python executable not found (tried: " + PYTHON_CANDIDATES.join(", ") + ")" };
}

router.post("/tools/passport", upload.single("photo"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "Please choose a photo." });
    }
    const bg  = req.body.bg === "keep" ? "keep" : "white";
    const dpi = Math.min(600, Math.max(150, parseInt(req.body.dpi, 10) || 300));

    const outputPath = path.join(TMP_ROOT, "out-" + path.basename(req.file.path).replace(/^in-/, "").replace(/\.[^.]+$/, "") + ".jpg");

    const result = await runPython(req.file.path, outputPath, { bg, dpi });

    // Always clean up the input file
    fs.unlink(req.file.path, () => {});

    if (result.code === -1) {
        return res.status(500).json({
            message:
                "The passport photo engine isn't available on this server. " +
                "Python 3 with opencv-python-headless + numpy must be installed. " +
                "On Render: set Build Command to `npm install && pip install -r requirements.txt` " +
                "or rely on the postinstall hook in package.json.",
            detail: result.stderr.trim(),
        });
    }
    if (result.code === 2) {
        try { fs.unlinkSync(outputPath); } catch (_) {}
        return res.status(400).json({ message: "No face detected. Use a clear, front-facing photo." });
    }
    if (result.code !== 0) {
        try { fs.unlinkSync(outputPath); } catch (_) {}
        // Show Python's stderr to make debugging easier
        return res.status(500).json({
            message: "Processing failed.",
            detail: result.stderr.trim().split("\n").slice(-3).join("\n"),
        });
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", 'inline; filename="passport-photo.jpg"');
    res.setHeader("X-Passport-Info", result.stdout.trim());
    const stream = fs.createReadStream(outputPath);
    stream.on("close", () => { try { fs.unlinkSync(outputPath); } catch (_) {} });
    stream.pipe(res);
});

// Coming-soon stubs (so /api links don't 404 silently while UI is built out)
router.post("/tools/mrp", (req, res) => res.status(501).json({ message: "MRP photo maker coming soon." }));
router.post("/tools/retouch", (req, res) => res.status(501).json({ message: "Skin retouch coming soon." }));

module.exports = router;
