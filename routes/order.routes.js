const express      = require("express");
const router       = express.Router();
const multer       = require("multer");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const r2           = require("../config/r2.config");
const Order        = require("../models/order.models");
const User         = require("../models/register.models");
const { isAuthenticated } = require("../middlewares/auth.middleware");
const { sendWhatsApp }    = require("../services/whatsapp.services");
const { uploadLimiter }   = require("../middlewares/ratelimit.middleware");

// Lazy-load Drive + Fonepay services so the server still boots even if those
// optional deps (googleapis, qrcode) aren't installed yet. They throw a clear
// error at call time instead of crashing at import time.
function lazy(modulePath) {
    let mod = null;
    return new Proxy({}, {
        get(_, prop) {
            if (!mod) mod = require(modulePath);
            return mod[prop];
        }
    });
}
const drive   = lazy("../services/drive.services");
const fonepay = lazy("../services/fonepay.services");

// Storage backend: "drive" (default) uploads to Google Drive; "r2" keeps the
// original Cloudflare R2 behaviour. Set via STORAGE_BACKEND env var.
const STORAGE_BACKEND = (process.env.STORAGE_BACKEND || "drive").toLowerCase();
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error(`Only image files are allowed. Got: ${file.mimetype}`), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP;

// ── Nepali BS orderId generator ────────────────────────────
function getNepaliYear() {
    const now    = new Date();
    const month  = now.getMonth() + 1;
    const day    = now.getDate();
    const offset = (month > 4 || (month === 4 && day >= 14)) ? 57 : 56;
    return now.getFullYear() + offset;
}

async function generateOrderId() {
    const year   = getNepaliYear();
    const prefix = `${year}-`;
    const count  = await Order.countDocuments({ orderId: { $regex: `^${prefix}` } });
    return `${prefix}${count}`;
}
// ──────────────────────────────────────────────────────────


/* ════════════════════════════════════════════════════════════
   POST /api/orders/place
   Saves order to DB, sends WhatsApp to admin, returns orderId.
   ════════════════════════════════════════════════════════════ */
router.post("/orders/place", isAuthenticated, async (req, res) => {
    try {
        const { items, deliveryAddress, subtotal, tax, total, paymentMethod } = req.body;

        if (!items?.length)   return res.status(400).json({ message: "No items in order" });
        if (!paymentMethod)   return res.status(400).json({ message: "Payment method required" });
        if (!deliveryAddress) return res.status(400).json({ message: "Delivery address required" });

        const orderId = await generateOrderId();

        const order = await Order.create({
            orderId,
            userId: req.session.userId,
            items,
            deliveryAddress,
            subtotal,
            tax,
            total,
            paymentMethod,
            orderStatus: "placed",
        });

        // ── WhatsApp: new order placed ─────────────────────
        try {
            console.log("[order/place] sending WhatsApp to:", ADMIN_WHATSAPP);
            const itemList = order.items.map(i => `  • ${i.title} x${i.quantity}`).join("\n");
            const addr     = order.deliveryAddress;
            const addrStr  = [addr.province, addr.district, addr.municipality, addr.ward, addr.addressDetails]
                              .filter(Boolean).join(", ");

            await sendWhatsApp(ADMIN_WHATSAPP,
                `📦 *New Order Placed!*\n` +
                `Order ID: *${order.orderId}*\n` +
                `Total: Rs.${total}\n` +
                `Payment: ${paymentMethod.toUpperCase()}\n` +
                `Items:\n${itemList}\n` +
                `Delivery: ${addrStr || "Not provided"}`
            );
            await Order.findByIdAndUpdate(order._id, { whatsappNotified: true });
        } catch (waErr) {
            // WhatsApp failure must not block the order
            console.error("[whatsapp/place]", waErr.message);
        }
        // ──────────────────────────────────────────────────

        return res.json({ message: "Order placed", orderId: order._id, humanOrderId: order.orderId });

    } catch (err) {
        console.error("[order/place]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ════════════════════════════════════════════════════════════
   GET /api/orders
   Returns all orders for the logged-in user.
   ════════════════════════════════════════════════════════════ */
router.get("/orders", isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 });
        return res.json({ orders });
    } catch (err) {
        console.error("[order/list]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ════════════════════════════════════════════════════════════
   GET /api/orders/:orderId
   Returns a single order by DB _id.
   ════════════════════════════════════════════════════════════ */
router.get("/orders/:orderId", isAuthenticated, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id:    req.params.orderId,
            userId: req.session.userId,
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        return res.json({ order });
    } catch (err) {
        console.error("[order/get]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ════════════════════════════════════════════════════════════
   POST /api/orders/:orderId/confirm
   Called after user completes upload page.
   Marks order as processing, sends WhatsApp confirmation.
   ════════════════════════════════════════════════════════════ */
router.post("/orders/:orderId/confirm", isAuthenticated, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id:    req.params.orderId,
            userId: req.session.userId,
        });
        if (!order) return res.status(404).json({ message: "Order not found" });

        const { note } = req.body;
        if (note) order.note = note;

        order.orderStatus = "processing";

        if (order.paymentMethod === "cod") {
            order.paymentStatus = "pending"; // paid on delivery
        }

        // ── eSewa payment verification ─────────────────────
        // TODO: After eSewa redirects back to your site with transaction data,
        // verify the payment server-side using eSewa's verification API:
        //
        // const { token, amount, product_code } = req.body;
        // const verifyRes = await fetch("https://uat.esewa.com.np/epay/transrec", {
        //   method: "POST",
        //   body: new URLSearchParams({ amt: amount, scd: product_code, rid: token, pid: orderId })
        // });
        // if (verifyRes.ok) {
        //   order.paymentStatus      = "paid";
        //   order.esewaTransactionId = token;
        // }
        // ──────────────────────────────────────────────────

        // ── Khalti payment verification ────────────────────
        // TODO: After Khalti redirects back, verify using Khalti lookup API:
        //
        // const { pidx } = req.body;
        // const verifyRes = await fetch("https://a.khalti.com/api/v2/epayment/lookup/", {
        //   method: "POST",
        //   headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, "Content-Type": "application/json" },
        //   body: JSON.stringify({ pidx })
        // });
        // const data = await verifyRes.json();
        // if (data.status === "Completed") {
        //   order.paymentStatus = "paid";
        //   order.khaltiPidx    = pidx;
        // }
        // ──────────────────────────────────────────────────

        await order.save();

        // ── WhatsApp: order confirmed ──────────────────────
        try {
            await sendWhatsApp(ADMIN_WHATSAPP,
                `✅ *Order Confirmed!*\n` +
                `Order ID: *${order.orderId}*\n` +
                `Total: Rs.${order.total}\n` +
                `Payment: ${order.paymentMethod.toUpperCase()}\n` +
                `Status: Processing`
            );
        } catch (waErr) {
            console.error("[whatsapp/confirm]", waErr.message);
        }
        // ──────────────────────────────────────────────────

        return res.json({ message: "Order confirmed", order });

    } catch (err) {
        console.error("[order/confirm]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ════════════════════════════════════════════════════════════
   POST /api/orders/:orderId/cancel
   Called when user aborts at any step after placing the order.
   Marks order as cancelled, sends WhatsApp cancellation notice.
   ════════════════════════════════════════════════════════════ */
router.post("/orders/:orderId/cancel", isAuthenticated, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id:    req.params.orderId,
            userId: req.session.userId,
        });
        if (!order) return res.status(404).json({ message: "Order not found" });

        // idempotency — already cancelled, do not send WhatsApp again
        if (order.orderStatus === "cancelled") {
            return res.json({ message: "Order already cancelled" });
        }

        const { reason } = req.body;

        order.orderStatus   = "cancelled";
        order.paymentStatus = "failed";
        order.cancelledAt   = new Date(); // triggers TTL — deleted from DB after 24h
        if (reason) order.note = `Cancelled: ${reason}`;

        await order.save();

        // ── WhatsApp: order cancelled ──────────────────────
        try {
            const itemList = order.items.map(i => `  • ${i.title} x${i.quantity}`).join("\n");
            await sendWhatsApp(ADMIN_WHATSAPP,
                `❌ *Order Cancelled*\n` +
                `Order ID: *${order.orderId}*\n` +
                `Total: Rs.${order.total}\n` +
                `Payment: ${order.paymentMethod.toUpperCase()}\n` +
                `Reason: ${reason || "User aborted process"}\n` +
                `Items:\n${itemList}`
            );
            await Order.findByIdAndUpdate(order._id, { whatsappCancelNotified: true });
        } catch (waErr) {
            console.error("[whatsapp/cancel]", waErr.message);
        }
        // ──────────────────────────────────────────────────

        return res.json({ message: "Order cancelled" });

    } catch (err) {
        console.error("[order/cancel]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ════════════════════════════════════════════════════════════
   POST /api/orders/:orderId/upload-designs
   Receives multipart/form-data field "designs" (multiple images).
   Uploads each to Cloudflare R2, saves public URLs to order.designImages[].
   ════════════════════════════════════════════════════════════ */
router.post(
    "/orders/:orderId/upload-designs",
    isAuthenticated,
    uploadLimiter,
    upload.array("designs", 20),
    async (req, res) => {
        try {
            const order = await Order.findOne({
                _id:    req.params.orderId,
                userId: req.session.userId,
            });
            if (!order) return res.status(404).json({ message: "Order not found" });

            if (!req.files?.length) {
                return res.json({ message: "No files uploaded", urls: [] });
            }

            // validate — images only
            const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];
            const invalid  = req.files.filter(f => !ALLOWED.includes(f.mimetype));
            if (invalid.length) {
                return res.status(400).json({
                    message: `Invalid file type: ${invalid.map(f => f.originalname).join(", ")}. Only images are allowed.`
                });
            }

            let uploadedUrls = [];

            if (STORAGE_BACKEND === "drive") {
                // ── Google Drive backend (photoconcern65@gmail.com) ─────
                // Folder layout: Online Orders / YYYY-MM-DD / <Customer> /
                let customerName = "Customer";
                try {
                    const user = await User.findById(req.session.userId)
                        .select("full_name studio_name free_name email_address studio_email free_email role");
                    if (user) {
                        customerName =
                            user.full_name ||
                            user.studio_name ||
                            user.free_name ||
                            user.email_address ||
                            user.studio_email ||
                            user.free_email ||
                            "Customer";
                    }
                } catch (_) { /* fall through with default */ }

                const result = await drive.uploadOrderFiles(customerName, req.files, {
                    orderId: order.orderId || String(order._id),
                });
                uploadedUrls = result.files.map(f => f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`);
                order.driveFolderId  = result.folderId;
                order.driveFolderUrl = result.folderUrl;
            } else {
                // ── Cloudflare R2 backend (legacy) ──────────────────────
                for (const file of req.files) {
                    const key = `orders/${order._id}/${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
                    await r2.send(new PutObjectCommand({
                        Bucket:      process.env.bucket_name,
                        Key:         key,
                        Body:        file.buffer,
                        ContentType: file.mimetype,
                    }));
                    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
                    uploadedUrls.push(publicUrl);
                }
            }

            // save URLs to order
            order.designImages = uploadedUrls;
            await order.save();

            return res.json({
                message: "Designs uploaded",
                backend: STORAGE_BACKEND,
                folderUrl: order.driveFolderUrl || null,
                urls: uploadedUrls,
            });

        } catch (err) {
            console.error("[order/upload-designs]", err);
            return res.status(500).json({ message: err.message || "Upload failed. Please try again." });
        }
    }
);


/* ════════════════════════════════════════════════════════════
   POST /api/orders/:orderId/pay/fonepay
   Issues a Fonepay dynamic QR for the given order.
   Body: none. Returns: { qr: { qrDataUrl, reference, amount, ... } }
   ════════════════════════════════════════════════════════════ */
router.post("/orders/:orderId/pay/fonepay", isAuthenticated, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id:    req.params.orderId,
            userId: req.session.userId,
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.paymentStatus === "paid") {
            return res.status(400).json({ message: "Order is already paid" });
        }

        const qr = await fonepay.createDynamicQr(order);
        order.fonepayReference = qr.reference;
        await order.save();
        return res.json({ qr, orderId: order._id, humanOrderId: order.orderId });
    } catch (err) {
        console.error("[order/pay/fonepay]", err);
        return res.status(500).json({ message: err.message || "Could not create QR" });
    }
});


/* ════════════════════════════════════════════════════════════
   POST /api/orders/webhook/fonepay
   Webhook endpoint Fonepay calls to notify of a successful payment.
   In test mode, also reachable by the frontend for manual confirmation.
   Body: { reference, amount, status }
   ════════════════════════════════════════════════════════════ */
router.post("/orders/webhook/fonepay", async (req, res) => {
    const v = fonepay.verifyWebhook(req.body || {});
    if (!v.ok) return res.status(400).json({ message: v.error });

    const order = await Order.findOne({ fonepayReference: v.reference });
    if (!order) return res.status(404).json({ message: "No matching order" });

    order.paymentStatus = "paid";
    order.orderStatus   = order.orderStatus === "placed" ? "processing" : order.orderStatus;
    await order.save();
    return res.json({ ok: true, orderId: order._id });
});


/* ════════════════════════════════════════════════════════════
   ADMIN ROUTES
   ════════════════════════════════════════════════════════════ */

function isAdmin(req, res, next) {
    if (req.session.adminId) return next();
    return res.status(401).json({ message: "Admin access required" });
}

// GET /api/admin/orders — all orders (history)
router.get("/admin/orders", isAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 }).populate("userId", "full_name email_address studio_name studio_email free_name free_email role");
        return res.json({ orders });
    } catch (err) {
        console.error("[admin/orders]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// GET /api/admin/orders/active — processing orders only
router.get("/admin/orders/active", isAdmin, async (req, res) => {
    try {
        const orders = await Order.find({ orderStatus: "processing" }).sort({ createdAt: -1 }).populate("userId", "full_name email_address studio_name studio_email free_name free_email role phone studio_phone free_phone");
        return res.json({ orders });
    } catch (err) {
        console.error("[admin/orders/active]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// PATCH /api/admin/orders/:orderId/deliver — mark as delivered
router.patch("/admin/orders/:orderId/deliver", isAdmin, async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.orderId,
            { $set: { orderStatus: "delivered", paymentStatus: "paid" } },
            { new: true }
        );
        if (!order) return res.status(404).json({ message: "Order not found" });
        return res.json({ message: "Marked as delivered", order });
    } catch (err) {
        console.error("[admin/deliver]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// GET /api/admin/users — all users
router.get("/admin/users", isAdmin, async (req, res) => {
    try {
        const User = require("../models/register.models");
        const users = await User.find().select("-password -studio_password -free_password").sort({ createdAt: -1 });
        return res.json({ users });
    } catch (err) {
        console.error("[admin/users]", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// GET /api/admin/proxy-image?url=... — proxies R2 images through backend to avoid CORS
router.get("/admin/proxy-image", isAdmin, async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: "url param required" });

    try {
        const response = await fetch(url);
        if (!response.ok) return res.status(response.status).json({ message: "Failed to fetch image" });

        const contentType = response.headers.get("content-type") || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");

        // pipe the stream directly to response
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error("[proxy-image]", err);
        return res.status(500).json({ message: "Proxy failed" });
    }
});



module.exports = router;
