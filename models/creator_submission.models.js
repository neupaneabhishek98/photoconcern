const mongoose = require("mongoose");

const creatorSubmissionSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    ownerConfirmed: {
        type: Boolean,
        required: true,
        default: false,
    },
    photoUrls: [{ type: String }],
    driveFolderId: { type: String },
    driveFolderUrl: { type: String },
    fileCount: {
        type: Number,
        default: 0,
    },
    submitterIp: { type: String },
    userAgent: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("CreatorSubmission", creatorSubmissionSchema);
