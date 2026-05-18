const mongoose = require("mongoose");

// ── Nepali BS year counter for orderId ─────────────────────
// Converts current AD date to approximate BS year (BS = AD + 56 or 57)
function getNepaliYear() {
    const now    = new Date();
    const month  = now.getMonth() + 1; // 1-12
    const day    = now.getDate();
    // BS new year is around April 13-14; before that still previous BS year
    const offset = (month > 4 || (month === 4 && day >= 14)) ? 57 : 56;
    return now.getFullYear() + offset;
}

async function generateOrderId() {
    const year   = getNepaliYear();
    const prefix = `${year}-`;
    // count existing orders for this BS year
    const count  = await mongoose.model("Order").countDocuments({
        orderId: { $regex: `^${prefix}` }
    });
    return `${prefix}${count}`;
}

const orderSchema = new mongoose.Schema({

    orderId: {
        type:   String,
        unique: true,
        // generated in order.routes.js before create()
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    items: [
        {
            title:       { type: String, required: true },
            price:       { type: Number, required: true },
            img:         { type: String },
            description: { type: String },
            quantity:    { type: Number, default: 1 },
        }
    ],

    deliveryAddress: {
        province:       String,
        district:       String,
        municipality:   String,
        ward:           String,
        addressDetails: String,
    },

    subtotal:  { type: Number, required: true },
    tax:       { type: Number, required: true },
    total:     { type: Number, required: true },

    paymentMethod: {
        type: String,
        enum: ["esewa", "khalti", "ime", "connectips", "cod", "fonepay"],
        required: true,
    },

    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending",
    },

    orderStatus: {
        type: String,
        enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
        default: "placed",
    },

    note: { type: String },

    // design photos uploaded by user (Drive webViewLink URLs)
    designImages: [{ type: String }],

    // Google Drive folder (per-order) containing the uploaded design photos
    driveFolderId:  { type: String },
    driveFolderUrl: { type: String },

    // ── Fonepay Dynamic QR ─────────────────────────────────
    fonepayReference: { type: String },

    // ── eSewa integration ──────────────────────────────────
    // TODO: store eSewa transaction UUID and ref ID here after payment callback
    esewaTransactionId: { type: String },
    esewaRefId:         { type: String },

    // ── Khalti integration ─────────────────────────────────
    // TODO: store Khalti pidx and token here after payment callback
    khaltiPidx:  { type: String },
    khaltiToken: { type: String },

    // ── WhatsApp notification ──────────────────────────────
    // TODO: set to true after WhatsApp notification is sent via Twilio/WATI/etc.
    whatsappNotified:        { type: Boolean, default: false },
    whatsappCancelNotified:  { type: Boolean, default: false },

    // ── Auto-delete cancelled orders after 24 hours ────────
    // MongoDB TTL index watches this field.
    // Set to a date when order is cancelled; MongoDB deletes the doc 24h later.
    // For non-cancelled orders this stays null and TTL never fires.
    cancelledAt: { type: Date, default: null },

}, { timestamps: true });

// TTL index — deletes document 360000 seconds (100h) after cancelledAt is set
orderSchema.index({ cancelledAt: 1 }, { expireAfterSeconds: 360000, partialFilterExpression: { cancelledAt: { $type: "date" } } });

module.exports = mongoose.model("Order", orderSchema);
