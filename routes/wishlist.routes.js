const express  = require("express");
const router   = express.Router();
const Wishlist = require("../models/wishlist.models");
const Cart     = require("../models/cart.models");
const { isAuthenticated } = require("../middlewares/auth.middleware");

function cleanText(value, max = 180) {
    return String(value || "").trim().slice(0, max);
}

function parsePrice(value) {
    const n = Number(String(value || "").replace(/[^0-9]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : 0;
}


/* ─── GET /api/wishlist ───────────────────────────────── */
router.get("/wishlist", isAuthenticated, async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ userId: req.session.userId });
        return res.json({ items: wishlist?.items || [] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ─── POST /api/wishlist/add ─────────────────────────── */
router.post("/wishlist/add", isAuthenticated, async (req, res) => {
    try {
        const { title, price, img, desc } = req.body;
        const itemTitle = cleanText(title);
        if (!itemTitle) return res.status(400).json({ message: "title is required" });

        let wishlist = await Wishlist.findOne({ userId: req.session.userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId: req.session.userId, items: [] });
        }

        const exists = wishlist.items.find(i => i.title === itemTitle);
        if (exists) return res.status(409).json({ message: "Already in wishlist" });

        wishlist.items.push({
            title: itemTitle,
            price: parsePrice(price),
            img: cleanText(img, 2048),
            desc: cleanText(desc, 800),
        });
        await wishlist.save();

        return res.json({ message: "Added to wishlist", items: wishlist.items });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ─── DELETE /api/wishlist/remove ────────────────────── */
router.delete("/wishlist/remove", isAuthenticated, async (req, res) => {
    try {
        const { title } = req.body;
        const itemTitle = cleanText(title);
        if (!itemTitle) return res.status(400).json({ message: "title is required" });

        const wishlist = await Wishlist.findOne({ userId: req.session.userId });
        if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

        wishlist.items = wishlist.items.filter(i => i.title !== itemTitle);
        await wishlist.save();

        return res.json({ message: "Removed from wishlist", items: wishlist.items });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/* ─── POST /api/wishlist/move-to-cart ────────────────── */
// Moves item from wishlist → cart, removes from wishlist
router.post("/wishlist/move-to-cart", isAuthenticated, async (req, res) => {
    try {
        const { title } = req.body;
        const itemTitle = cleanText(title);
        if (!itemTitle) return res.status(400).json({ message: "title is required" });

        const wishlist = await Wishlist.findOne({ userId: req.session.userId });
        if (!wishlist) return res.status(404).json({ message: "Wishlist not found" });

        const item = wishlist.items.find(i => i.title === itemTitle);
        if (!item) return res.status(404).json({ message: "Item not in wishlist" });

        // add to cart
        let cart = await Cart.findOne({ userId: req.session.userId });
        if (!cart) cart = new Cart({ userId: req.session.userId, items: [] });

        const existing = cart.items.find(i => i.title === itemTitle);
        if (existing) {
            existing.quantity = Math.min(99, existing.quantity + 1);
        } else {
            cart.items.push({ title: item.title, price: item.price, img: item.img, description: item.desc, quantity: 1 });
        }
        await cart.save();

        // remove from wishlist
        wishlist.items = wishlist.items.filter(i => i.title !== itemTitle);
        await wishlist.save();

        return res.json({ message: "Moved to cart", items: wishlist.items });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
});


module.exports = router;
