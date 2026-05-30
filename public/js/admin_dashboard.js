/* ============================================================
   admin_dashboard.js
   Three tabs: Active Orders, Order History, Users
   All data fetched from DB via admin API routes.
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

/* ── auth check ── */
    async function apiFetch(url, options = {}) {
        const res = await fetch(url, { credentials: "include", ...options });
        if (res.status === 401) { window.location.href = "/login/admin"; throw new Error("Unauth"); }
        return res;
    }

/* ── tab switching (sidebar + mobile nav) ── */
    const navItems     = document.querySelectorAll(".nav-item, .mobile-nav-btn");
    const tabPanels    = document.querySelectorAll(".tab-panel");

    function switchTab(tabName) {
        document.querySelectorAll(".nav-item, .mobile-nav-btn").forEach(b => b.classList.remove("active"));
        tabPanels.forEach(p => p.classList.remove("active"));
        document.querySelectorAll(`[data-tab="${tabName}"]`).forEach(b => b.classList.add("active"));
        document.getElementById(`tab-${tabName}`)?.classList.add("active");
    }

    navItems.forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

/* ── logout ── */
    document.getElementById("adminLogoutBtn")?.addEventListener("click", async () => {
        try {
            await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
        } catch (e) { /* ignore network errors */ }
        window.location.href = "/login/admin";
    });

/* ── helpers ── */
    function formatDate(iso) {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("en-NP", { year: "numeric", month: "short", day: "numeric" });
    }

    function escapeHTML(value) {
        return String(value ?? "—").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
        }[char]));
    }

    function safeText(value, fallback = "—") {
        const text = String(value ?? "").trim();
        return escapeHTML(text || fallback);
    }

    function safeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number.toLocaleString() : "0";
    }

    function safeImageUrl(value, fallback = "/resources/frame1.png") {
        const raw = String(value || "").trim();
        if (raw.startsWith("/")) return escapeHTML(raw);
        try {
            const url = new URL(raw);
            if (url.protocol === "http:" || url.protocol === "https:") return escapeHTML(url.href);
        } catch (_) {}
        return fallback;
    }

    function statusChip(status) {
        const cleanStatus = String(status || "unknown").toLowerCase().replace(/[^a-z-]/g, "");
        return `<span class="chip chip-${cleanStatus || "unknown"}">${safeText(status || "unknown")}</span>`;
    }

    function customerName(user) {
        if (!user) return "—";
        if (user.role === "studio") return safeText(user.studio_name || user.studio_email);
        if (user.role === "freelancer") return safeText(user.free_name || user.free_email);
        return safeText(user.full_name || user.email_address);
    }

    function itemsSummary(items) {
        if (!items?.length) return "—";
        return items.map(i => `${safeText(i.title)} x${safeText(i.quantity)}`).join(", ");
    }

    function getItemCategory(items) {
        // returns first item's category by matching title to products.json
        return items?.[0]?.category || "";
    }

/* ── products.json for category filter ── */
    let productsData = [];
    try {
        const r = await fetch("/api/products");
        productsData = await r.json();
    } catch (e) { /* ignore */ }

    function getCategoryForOrder(order) {
        if (!order.items?.length) return "";
        const title   = order.items[0].title;
        const product = productsData.find(p => p.title === title);
        return product?.category || "";
    }

/* ════════════════════════════════════════════════════════════
   ACTIVE ORDERS
   ════════════════════════════════════════════════════════════ */
    let activeOrders = [];

    async function loadActiveOrders() {
        const tbody = document.getElementById("activeOrdersBody");
        try {
            const res  = await apiFetch("/api/admin/orders/active");
            const data = await res.json();
            activeOrders = data.orders || [];

            document.getElementById("activeCount").textContent = activeOrders.length;

            if (!activeOrders.length) {
                tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No active orders</td></tr>`;
                return;
            }

            tbody.innerHTML = activeOrders.map(o => `
                <tr class="clickable" data-id="${safeText(o._id)}">
                    <td><strong>${safeText(o.orderId || o._id)}</strong></td>
                    <td>${customerName(o.userId)}</td>
                    <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemsSummary(o.items)}</td>
                    <td>Rs.${safeNumber(o.total)}</td>
                    <td>${safeText(o.paymentMethod?.toUpperCase())}</td>
                    <td>${formatDate(o.createdAt)}</td>
                    <td>
                        <button class="deliver-btn" data-id="${safeText(o._id)}">Mark Delivered</button>
                    </td>
                </tr>
            `).join("");

            // click row → popup
            tbody.querySelectorAll("tr.clickable").forEach(row => {
                row.addEventListener("click", (e) => {
                    if (e.target.closest(".deliver-btn")) return;
                    const order = activeOrders.find(o => o._id === row.dataset.id);
                    if (order) showOrderPopup(order);
                });
            });

            // deliver buttons
            tbody.querySelectorAll(".deliver-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    btn.disabled    = true;
                    btn.textContent = "Updating…";
                    try {
                        await apiFetch(`/api/admin/orders/${btn.dataset.id}/deliver`, { method: "PATCH" });
                        await loadActiveOrders();
                        await loadHistoryOrders();
                    } catch (err) {
                        btn.disabled    = false;
                        btn.textContent = "Mark Delivered";
                    }
                });
            });

        } catch (err) {
            if (err.message !== "Unauth") {
                tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Failed to load</td></tr>`;
            }
        }
    }

/* ════════════════════════════════════════════════════════════
   ORDER HISTORY
   ════════════════════════════════════════════════════════════ */
    let allOrders = [];

    async function loadHistoryOrders() {
        const tbody = document.getElementById("historyOrdersBody");
        try {
            const res  = await apiFetch("/api/admin/orders");
            const data = await res.json();
            allOrders  = data.orders || [];
            renderHistory();
        } catch (err) {
            if (err.message !== "Unauth") {
                tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Failed to load</td></tr>`;
            }
        }
    }

    function renderHistory() {
        const tbody      = document.getElementById("historyOrdersBody");
        const catFilter  = document.getElementById("categoryFilter").value;
        const statFilter = document.getElementById("statusFilter").value;

        let filtered = allOrders;

        if (catFilter) {
            filtered = filtered.filter(o => getCategoryForOrder(o) === catFilter);
        }
        if (statFilter) {
            filtered = filtered.filter(o => o.orderStatus === statFilter);
        }

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="loading-row">No orders found</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(o => `
            <tr>
                <td><strong>${safeText(o.orderId || o._id)}</strong></td>
                <td>${customerName(o.userId)}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemsSummary(o.items)}</td>
                <td>Rs.${safeNumber(o.total)}</td>
                <td>${safeText(o.paymentMethod?.toUpperCase())}</td>
                <td>${statusChip(o.orderStatus)}</td>
                <td>${formatDate(o.createdAt)}</td>
            </tr>
        `).join("");
    }

    document.getElementById("categoryFilter").addEventListener("change", renderHistory);
    document.getElementById("statusFilter").addEventListener("change", renderHistory);

/* ════════════════════════════════════════════════════════════
   USERS
   ════════════════════════════════════════════════════════════ */
    async function loadUsers() {
        const tbody = document.getElementById("usersBody");
        try {
            const res  = await apiFetch("/api/admin/users");
            const data = await res.json();
            const users = data.users || [];

            document.getElementById("usersCount").textContent = users.length;

            if (!users.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No users found</td></tr>`;
                return;
            }

            tbody.innerHTML = users.map(u => {
                const name  = u.full_name  || u.studio_name  || u.free_name  || "—";
                const email = u.email_address || u.studio_email || u.free_email || "—";
                const phone = u.phone || u.studio_phone || u.free_phone || "—";
                return `
                    <tr>
                        <td>${safeText(name)}</td>
                        <td>${safeText(email)}</td>
                        <td>${statusChip(u.role)}</td>
                        <td>${safeText(phone)}</td>
                        <td>${formatDate(u.createdAt)}</td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            if (err.message !== "Unauth") {
                tbody.innerHTML = `<tr><td colspan="5" class="loading-row">Failed to load</td></tr>`;
            }
        }
    }

/* ════════════════════════════════════════════════════════════
   CONTACTS
   ════════════════════════════════════════════════════════════ */
    async function loadContacts() {
        const tbody = document.getElementById("contactsBody");
        if (!tbody) return;
        try {
            const res  = await apiFetch("/api/admin/contacts");
            const data = await res.json();
            const contacts = data.contacts || [];

            const countEl = document.getElementById("contactsCount");
            if (countEl) countEl.textContent = contacts.length;

            if (!contacts.length) {
                tbody.innerHTML = `<tr><td colspan="5" class="loading-row">No messages yet</td></tr>`;
                return;
            }

            tbody.innerHTML = contacts.map(c => `
                <tr>
                    <td>${safeText(c.name)}</td>
                    <td>${safeText(c.email)}</td>
                    <td>${safeText(c.subject)}</td>
                    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeText(c.message)}</td>
                    <td>${formatDate(c.createdAt)}</td>
                </tr>
            `).join("");

        } catch (err) {
            if (err.message !== "Unauth" && tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="loading-row">Failed to load</td></tr>`;
            }
        }
    }

/* ════════════════════════════════════════════════════════════
   ORDER DETAIL POPUP
   ════════════════════════════════════════════════════════════ */
    function showOrderPopup(order) {
        const popup = document.getElementById("orderPopup");
        const body  = document.getElementById("popupBody");

        document.getElementById("popupOrderId").textContent = `Order ${order.orderId || order._id}`;

        const addr = order.deliveryAddress || {};
        const addrStr = [addr.province, addr.district, addr.municipality, addr.ward, addr.addressDetails]
            .filter(Boolean).join(", ") || "—";

        const itemsHTML = (order.items || []).map(i => `
            <div class="popup-item">
                <img src="${safeImageUrl(i.img)}" alt="${safeText(i.title)}">
                <div class="popup-item-info">
                    <div class="popup-item-title">${safeText(i.title)}</div>
                    <div class="popup-item-qty">Qty: ${safeText(i.quantity)}</div>
                </div>
                <div class="popup-item-price">Rs.${safeNumber(Number(i.price) * Number(i.quantity))}</div>
            </div>
        `).join("");

        const designHTML = order.designImages?.length
            ? `<div class="popup-section">
                <div class="popup-section-title">
                    Design Photos
                    <button class="download-all-btn" id="downloadAllBtn">
                        ↓ Download All
                    </button>
                </div>
                <div class="popup-images">
                    ${order.designImages.map(url => `<img src="${safeImageUrl(url)}" alt="design">`).join("")}
                </div>
               </div>`
            : "";

        body.innerHTML = `
            <div class="popup-section">
                <div class="popup-section-title">Order Info</div>
                <div class="popup-row"><span>Order ID</span><span>${safeText(order.orderId || order._id)}</span></div>
                <div class="popup-row"><span>Status</span><span>${statusChip(order.orderStatus)}</span></div>
                <div class="popup-row"><span>Payment</span><span>${safeText(order.paymentMethod?.toUpperCase())} — ${safeText(order.paymentStatus)}</span></div>
                <div class="popup-row"><span>Total</span><span>Rs.${safeNumber(order.total)}</span></div>
                <div class="popup-row"><span>Date</span><span>${formatDate(order.createdAt)}</span></div>
            </div>
            <div class="popup-section">
                <div class="popup-section-title">Customer</div>
                <div class="popup-row"><span>Name</span><span>${customerName(order.userId)}</span></div>
                <div class="popup-row"><span>Delivery</span><span>${safeText(addrStr)}</span></div>
                ${order.note ? `<div class="popup-row"><span>Note</span><span>${safeText(order.note)}</span></div>` : ""}
            </div>
            <div class="popup-section">
                <div class="popup-section-title">Items</div>
                <div class="popup-items">${itemsHTML}</div>
            </div>
            ${designHTML}
        `;

        popup.hidden = false;

        // wire download button after DOM is updated
        if (order.designImages?.length) {
            document.getElementById("downloadAllBtn")?.addEventListener("click", () => {
                downloadDesignImages(order.designImages, order.orderId || order._id);
            });
        }
    }

    document.getElementById("popupClose").addEventListener("click", () => {
        document.getElementById("orderPopup").hidden = true;
    });

    document.getElementById("orderPopup").addEventListener("click", (e) => {
        if (e.target === document.getElementById("orderPopup")) {
            document.getElementById("orderPopup").hidden = true;
        }
    });

/* ════════════════════════════════════════════════════════════
   DOWNLOAD ALL DESIGN IMAGES AS ZIP
   ════════════════════════════════════════════════════════════ */
    async function downloadDesignImages(urls, orderId) {
        const btn = document.getElementById("downloadAllBtn");
        if (btn) { btn.disabled = true; btn.textContent = "Zipping…"; }

        try {
            const zip    = new JSZip();
            const folder = zip.folder(`order-${orderId}-designs`);

            await Promise.all(urls.map(async (url, idx) => {
                // proxy through backend to avoid CORS issues
                const proxyUrl = `/api/admin/proxy-image?url=${encodeURIComponent(url)}`;
                const res      = await fetch(proxyUrl, { credentials: "include" });
                if (!res.ok) throw new Error(`Failed to fetch image ${idx + 1}: ${res.status}`);
                const blob = await res.blob();
                const ext  = blob.type.split("/")[1]?.split("+")[0] || "jpg";
                folder.file(`design-${idx + 1}.${ext}`, blob);
            }));

            const content = await zip.generateAsync({ type: "blob" });
            const link    = document.createElement("a");
            link.href     = URL.createObjectURL(content);
            link.download = `order-${orderId}-designs.zip`;
            link.click();
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error("[download]", err);
            alert(`Download failed: ${err.message}`);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "↓ Download All"; }
        }
    }

/* ── init ── */
    await Promise.all([loadActiveOrders(), loadHistoryOrders(), loadUsers(), loadContacts()]);

});
