document.addEventListener("DOMContentLoaded", async () => {
    window.toggleMenu = function () {
        document.querySelector(".quickies")?.classList.toggle("show");
    };

    document.addEventListener("click", (e) => {
        const menu = document.querySelector(".quickies");
        const hamburger = document.querySelector(".hamburger");
        if (menu && hamburger && !hamburger.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove("show");
        }
    });

    async function apiFetch(url, options = {}) {
        const res = await fetch(url, { credentials: "include", ...options });
        if (res.status === 401) {
            window.location.href = "/login";
            throw new Error("Unauthenticated");
        }
        return res;
    }

    function formatDate(iso) {
        if (!iso) return "-";
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-NP", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function estimatedDelivery(iso) {
        if (!iso) return "-";
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return "-";
        date.setDate(date.getDate() + 5);
        return date.toLocaleDateString("en-NP", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        }[char]));
    }

    function safeText(value, fallback = "-") {
        const text = String(value ?? "").trim();
        return escapeHTML(text || fallback);
    }

    function safeImageUrl(value) {
        const url = String(value || "/resources/frame1.jpg").trim();
        if (!url || /^(javascript|data):/i.test(url)) return "/resources/frame1.jpg";
        return escapeHTML(url);
    }

    function titleCase(value) {
        const text = String(value || "").trim();
        if (!text) return "-";
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function money(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toLocaleString() : "0";
    }

    const STATUS_COLORS = {
        placed: "#f59e0b",
        processing: "#3b82f6",
        shipped: "#8b5cf6",
        delivered: "#22c55e",
        cancelled: "#e70000",
    };

    const PAYMENT_COLORS = {
        paid: "#22c55e",
        pending: "#f59e0b",
        failed: "#e70000",
    };

    function renderOrderCard(order) {
        const addr = order.deliveryAddress || {};
        const addrStr = [addr.municipality, addr.district, addr.province]
            .filter(Boolean)
            .join(", ") || "-";

        const itemsHTML = (order.items || []).map((item) => `
            <div class="item">
                <img src="${safeImageUrl(item.img)}" alt="${safeText(item.title, "Order item")}" loading="lazy">
                <div>
                    <p class="name">${safeText(item.title, "Order item")}</p>
                    <p class="details">Qty: ${money(item.quantity)} x Rs.${money(item.price)}</p>
                </div>
            </div>
        `).join("");

        const statusColor = STATUS_COLORS[order.orderStatus] || "#6b7280";
        const paymentColor = PAYMENT_COLORS[order.paymentStatus] || "#6b7280";
        const paymentMethod = String(order.paymentMethod || "").toUpperCase();

        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
            <div class="order-top">
                <span class="order-id">${safeText(order.orderId || order._id)}</span>
                <span class="status" style="color:${statusColor}">
                    ${safeText(titleCase(order.orderStatus))}
                </span>
            </div>

            <div class="order-items">${itemsHTML}</div>

            <div class="order-info">
                <p><strong>Ordered:</strong> ${formatDate(order.createdAt)}</p>
                <p><strong>Est. Delivery:</strong> ${estimatedDelivery(order.createdAt)}</p>
                <p><strong>Address:</strong> ${safeText(addrStr)}</p>
                ${addr.addressDetails ? `<p class="street"><strong>Details:</strong> ${safeText(addr.addressDetails)}</p>` : ""}
            </div>

            <div class="order-bottom">
                <span class="payment" style="color:${paymentColor}">
                    ${safeText(titleCase(order.paymentStatus))}
                    (${safeText(paymentMethod)})
                </span>
                <span class="total">Rs.${money(order.total)}</span>
            </div>
        `;
        return card;
    }

    const container = document.getElementById("ordersContainer");
    if (!container) return;

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

        orders.forEach((order) => container.appendChild(renderOrderCard(order)));
    } catch (err) {
        if (err.message !== "Unauthenticated") {
            container.innerHTML = `<div class="empty-orders"><p>Could not load orders. Please try again.</p></div>`;
        }
        console.error("[orders]", err);
    }
});
