const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const Cart     = require('../models/cart.models');
const Wishlist = require('../models/wishlist.models');

function parsePrice(priceText) {
  return Number(String(priceText).replace(/[^0-9]/g, "")) || 0;
}

function cleanText(value, max = 180) {
  return String(value || "").trim().slice(0, max);
}

function parseQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
  return quantity;
}

// POST /api/cart/add
router.post("/cart/add", authMiddleware.isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { title, price, img, desc, quantity = 1, redirect } = req.body;
        const itemTitle = cleanText(title);
        const itemPrice = parsePrice(price);
        const itemQuantity = parseQuantity(quantity);

        if (!itemTitle || price === undefined) {
            return res.status(400).json({ message: "title and price are required" });
        }
        if (itemPrice < 0 || !Number.isFinite(itemPrice)) {
            return res.status(400).json({ message: "price must be a valid non-negative number" });
        }
        if (!itemQuantity) {
            return res.status(400).json({ message: "quantity must be a whole number from 1 to 99" });
        }

        const incomingItem = {
            title:       itemTitle,
            price:       itemPrice,
            img:         cleanText(img, 2048),
            description: cleanText(desc, 800),
            quantity:    itemQuantity,
        };

        let cart = await Cart.findOne({ userId });

        if (cart) {
            const existingIndex = cart.items.findIndex(i => i.title === itemTitle);
            if (existingIndex > -1) {
                cart.items[existingIndex].quantity = Math.min(99, cart.items[existingIndex].quantity + incomingItem.quantity);
            } else {
                cart.items.push(incomingItem);
            }
        } else {
            cart = new Cart({ userId, items: [incomingItem] });
        }

        await cart.save();

        if (redirect === "true") return res.redirect("/serve/cart");
        return res.json({ message: "Cart updated successfully", cart });

    } catch (error) {
        console.error("Error updating cart:", error);
        if (req.body.redirect === "true") return res.redirect("back");
        return res.status(500).json({ message: "Internal server error" });
    }
});

// GET /api/cart
router.get("/cart", authMiddleware.isAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.userId });
        if (!cart) return res.json({ cart: { items: [] } });
        return res.json({ cart });
    } catch (error) {
        console.error("Error fetching cart:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// PATCH /api/cart/item/:itemId/quantity
router.patch("/cart/item/:itemId/quantity", authMiddleware.isAuthenticated, async (req, res) => {
    try {
        const quantity = parseQuantity(req.body.quantity);
        if (!quantity) {
            return res.status(400).json({ message: "quantity must be a whole number from 1 to 99" });
        }

        const cart = await Cart.findOne({ userId: req.session.userId });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        const item = cart.items.id(req.params.itemId);
        if (!item) return res.status(404).json({ message: "Item not found" });

        item.quantity = quantity;
        await cart.save();

        return res.json({ message: "Quantity updated", cart });
    } catch (error) {
        console.error("Error updating quantity:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// DELETE /api/cart/item/:itemId
router.delete("/cart/item/:itemId", authMiddleware.isAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.userId });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        cart.items = cart.items.filter(i => String(i._id) !== req.params.itemId);
        await cart.save();

        return res.json({ message: "Item removed", cart });
    } catch (error) {
        console.error("Error removing item:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// POST /api/cart/item/:itemId/wishlist
// Moves item from cart → wishlist, removes from cart
router.post("/cart/item/:itemId/wishlist", authMiddleware.isAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.userId });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        const item = cart.items.id(req.params.itemId);
        if (!item) return res.status(404).json({ message: "Item not found in cart" });

        // add to wishlist
        let wishlist = await Wishlist.findOne({ userId: req.session.userId });
        if (!wishlist) wishlist = new Wishlist({ userId: req.session.userId, items: [] });

        const alreadyInWishlist = wishlist.items.find(w => w.title === item.title);
        if (!alreadyInWishlist) {
            wishlist.items.push({
                title: item.title,
                price: item.price,
                img:   item.img,
                desc:  item.description,
            });
            await wishlist.save();
        }

        // remove from cart
        cart.items = cart.items.filter(i => String(i._id) !== req.params.itemId);
        await cart.save();

        return res.json({ message: "Moved to wishlist", cart });
    } catch (error) {
        console.error("Error moving to wishlist:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;
