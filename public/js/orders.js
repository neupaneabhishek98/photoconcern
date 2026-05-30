document.addEventListener("DOMContentLoaded", async () => {

/* ============================================================
   SECTION 1 — HAMBURGER
   ============================================================ */

    window.toggleMenu = function () {
        document.querySelector(".quickies")?.classList.toggle("show");
    };

    document.addEventListener("click", (e) => {
        const menu      = document.querySelector(".quickies");
        const hamburger = document.querySelector(".hamburger");
        if (menu && hamburger && !hamburger.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove("show");
        }
    });


/* ============================================================
   SECTION 2 — AUTH-AWARE FETCH
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
   SECTION 3 — HELPERS
   ============================================================ */

    function formatDate(iso) {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("en-NP", {
            year: "numeric", month: "short", day: "numeric"
        });
    }

    function estimatedDelivery(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        d.setDate(d.getDate() + 5);
        return d.toLocaleDateString("en-NP", {
            year: "numeric", month: "short", day: "numeric"
        });
    }

    const STATUS_COLORS = {
        placed:      "#f59e0b",
        processing:  "#3b82f6",
        shipped:     "#8b5cf6",
        delivered:   "#22c55e",
        cancelled:   "#e70000",
    };

    const PAYMENT_COLORS = {
        paid:    "#22c55e",
        pending: "#f59e0b",
        failed:  "#e70000",
    };


/* ============================================================
   SECTION 4 — RENDER ORDER CARD
   ============================================================ */

    function renderOrderCard(order) {
        const addr = order.deliveryAddress || {};
        const addrStr = [addr.municipality, addr.district, addr.province]
            .filter(Boolean).join(", ") || "—";

        const itemsHTML = (order.items || []).map(item => `
            <div class="item">
                <img src="${item.img || '/resources/frame1.jpg'}" alt="${item.title}" loading="lazy">
                <div>
                    <p class="name">${item.title}</p>
                    <p class="details">Qty: ${item.quantity} × रू.${item.price?.toLocaleString()}</p>
                </div>
            </div>
        `).join("");

        const statusColor  = STATUS_COLORS[order.orderStatus]  || "#6b7280";
        const paymentColor = PAYMENT_COLORS[order.paymentStatus] || "#6b7280";

        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
            <div class="order-top">
                <span class="order-id">${order.orderId || order._id}</span>
                <span class="status" style="color:${statusColor}">
                    ${order.orderStatus?.charAt(0).toUpperCase() + order.orderStatus?.slice(1)}
                </span>
            </div>

            <div class="order-items">${itemsHTML}</div>

            <div class="order-info">
                <p><strong>Ordered:</strong> ${formatDate(order.createdAt)}</p>
                <p><strong>Est. Delivery:</strong> ${estimatedDelivery(order.createdAt)}</p>
                <p><strong>Address:</strong> ${addrStr}</p>
                ${addr.addressDetails ? `<p class="street"><strong>Details:</strong> ${addr.addressDetails}</p>` : ""}
            </div>

            <div class="order-bottom">
                <span class="payment" style="color:${paymentColor}">
                    ${order.paymentStatus?.charAt(0).toUpperCase() + order.paymentStatus?.slice(1)}
                    (${order.paymentMethod?.toUpperCase()})
                </span>
                <span class="total">रू.${order.total?.toLocaleString()}</span>
            </div>
        `;
        return card;
    }


/* ============================================================
   SECTION 5 — FETCH ORDERS FROM DB
   ============================================================ */

    const container = document.getElementById("ordersContainer");

    try {
        const res = await apiFetch("/api/orders");
        if (!res.ok) throw new Error("Failed to load orders");

        const { orders } = await res.json();

        if (!orders?.length) {
            container.innerHTML = `
                <div class="empty-orders">
                    <p>You haven't placed any orders yet.</p>
                    <a href="/" class="shop-now-btn">Shop Now</a>
                </div>
            `;
            return;
        }

        orders.forEach(order => container.appendChild(renderOrderCard(order)));

    } catch (err) {
        if (err.message !== "Unauthenticated") {
            container.innerHTML = `<div class="empty-orders"><p>Could not load orders. Please try again.</p></div>`;
        }
        console.error("[orders]", err);
    }

});
