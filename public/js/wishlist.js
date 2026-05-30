document.addEventListener("DOMContentLoaded", async () => {


/* ============================================================
   SECTION 1 — AUTH-AWARE FETCH
   All API calls go through apiFetch.
   401 → redirect to /login immediately.
   ============================================================ */

    async function apiFetch(url, options = {}) {
        const res = await fetch(url, { credentials: "include", ...options });
        if (res.status === 401) {
            window.location.href = "/login";
            throw new Error("Unauthenticated");
        }
        return res;
    }


/* ============================================================
   SECTION 2 — THEME TOGGLE
   Handled by /js/theme.js
   ============================================================ */


/* ============================================================
   SECTION 3 — HAMBURGER MENU
   Toggles .show on .quickies, closes on outside click.
   ============================================================ */

    window.toggleMenu = function () {
        document.querySelector(".quickies")?.classList.toggle("show");
    };

    const hamburger = document.querySelector(".hamburger");
    const navMenu   = document.querySelector(".quickies");

    document.addEventListener("click", (e) => {
        if (navMenu && hamburger && !hamburger.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove("show");
        }
    });


/* ============================================================
   SECTION 4 — TOAST NOTIFICATION
   Small non-blocking feedback message at top-right.
   ============================================================ */

    function showToast(msg, isError = false) {
        let toast = document.getElementById("_wishlistToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id        = "_wishlistToast";
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        toast.textContent        = msg;
        toast.style.background   = isError ? "#e70000" : "#021024";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
    }


/* ============================================================
   SECTION 5 — WISHLIST DATA FETCH
   GET /api/wishlist → array of items from DB.
   401 → redirect to /login.
   ============================================================ */

    let wishlistItems = [];

    async function fetchWishlist() {
        const res  = await apiFetch("/api/wishlist");
        const data = await res.json();
        return data.items || [];
    }

    try {
        wishlistItems = await fetchWishlist();
    } catch (err) {
        console.error("[wishlist] fetch failed:", err);
        return;
    }


/* ============================================================
   SECTION 6 — RENDER WISHLIST CARDS
   Builds card HTML for each item.
   Empty state shown when no items.
   ============================================================ */

    const root = document.getElementById("wishlistProducts");

    function renderWishlist() {
        if (!root) return;
        root.innerHTML = "";

        if (!wishlistItems.length) {
            root.innerHTML = `<div class="empty-state">Your wishlist is empty. Add products from the home or category pages.</div>`;
            return;
        }

        wishlistItems.forEach(item => {
            const card = document.createElement("div");
            card.className     = "product-card";
            card.dataset.title = item.title;
            card.innerHTML = `
                <div class="product-card-thumb">
                    <img class="products_images" src="${item.img || ''}" alt="${item.title}" loading="lazy">
                </div>
                <div class="product-inform">
                    <h3>${item.title}</h3>
                    <p class="desc-product">${item.desc || "Saved item from your product list."}</p>
                    <p class="price-product">Rs.${(item.price || 0).toLocaleString()}</p>
                </div>
                <div class="card-actions">
                    <button type="button" class="add-to-cart-btn move-cart-btn" data-title="${item.title}">Add to Cart</button>
                    <button type="button" class="buy-now-btn remove-btn"        data-title="${item.title}">Remove</button>
                </div>
            `;
            root.appendChild(card);
        });
    }

    renderWishlist();


/* ============================================================
   SECTION 7 — ADD TO CART (move from wishlist)
   POST /api/wishlist/move-to-cart
   Removes item from wishlist after adding to cart.
   ============================================================ */

    root?.addEventListener("click", async (e) => {
        const cartBtn   = e.target.closest(".move-cart-btn");
        const removeBtn = e.target.closest(".remove-btn");

        if (cartBtn) {
            const title = cartBtn.dataset.title;
            cartBtn.disabled    = true;
            cartBtn.textContent = "Adding…";

            try {
                const res = await apiFetch("/api/wishlist/move-to-cart", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ title })
                });

                if (!res.ok) {
                    const err = await res.json();
                    showToast(err.message || "Failed to add to cart", true);
                    cartBtn.disabled    = false;
                    cartBtn.textContent = "Add to Cart";
                    return;
                }

                const data    = await res.json();
                wishlistItems = data.items;
                showToast(`${title} added to cart`);
                renderWishlist();

            } catch (err) {
                console.error("[move-to-cart] error:", err);
                cartBtn.disabled    = false;
                cartBtn.textContent = "Add to Cart";
            }
        }


/* ============================================================
   SECTION 8 — REMOVE FROM WISHLIST
   DELETE /api/wishlist/remove
   Re-renders the list after removal.
   ============================================================ */

        if (removeBtn) {
            const title = removeBtn.dataset.title;
            removeBtn.disabled    = true;
            removeBtn.textContent = "Removing…";

            try {
                const res = await apiFetch("/api/wishlist/remove", {
                    method:  "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ title })
                });

                if (!res.ok) {
                    const err = await res.json();
                    showToast(err.message || "Failed to remove", true);
                    removeBtn.disabled    = false;
                    removeBtn.textContent = "Remove";
                    return;
                }

                const data    = await res.json();
                wishlistItems = data.items;
                showToast(`${title} removed`);
                renderWishlist();

            } catch (err) {
                console.error("[remove] error:", err);
                removeBtn.disabled    = false;
                removeBtn.textContent = "Remove";
            }
        }
    });


});
