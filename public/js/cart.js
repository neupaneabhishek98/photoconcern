// ============================================================
//Image URL Helper
const BASE_URL = window.location.origin;

function getImageUrl(img) {
  const image = String(img || "").trim();
  if (!image || /^(javascript|data):/i.test(image)) return `${BASE_URL}/resources/frame1.jpg`;
  if (/^https?:\/\//i.test(image)) return image;
  return `${BASE_URL}/resources/${encodeURIComponent(image)}`;
}



// ============================================================
// UTILITIES
// ============================================================

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  const icon =
    type === "success"
      ? `<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>`;

  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2">${icon}</svg>
    </div>
    <span>${safeText(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

function showPopup(message, type = "info") {
  const popup = document.getElementById("popup");
  const msg = document.getElementById("popup-message");
  if (!popup || !msg) return;

  msg.textContent = message;
  popup.classList.remove("success", "error", "info");
  popup.classList.add("show", type);

  if (type === "success") {
    setTimeout(() => popup.classList.remove("show"), 1500);
  }
}

function closePopup() {
  document.getElementById("popup")?.classList.remove("show");
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

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return escapeHTML(text || fallback);
}

function safeImageUrl(value, fallback = "/resources/frame1.jpg") {
  const url = String(value || fallback).trim();
  if (!url || /^(javascript|data):/i.test(url)) return fallback;
  return escapeHTML(url);
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString() : "0";
}

// ============================================================
// NAV
// ============================================================

window.toggleMenu = function () {
  const menu = document.querySelector(".quickies");
  if (menu) menu.classList.toggle("show");
};

function setupMenuClose() {
  document.addEventListener("click", (e) => {
    const menu = document.querySelector(".quickies");
    const hamburger = document.querySelector(".hamburger");
    if (!menu || !hamburger) return;
    if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("show");
    }
  });
}

// ============================================================
// THEME — handled by /js/theme.js
// ============================================================

// ============================================================
// API LAYER — DB-READY
// ============================================================

const API = {
  /**
   * GET /api/cart
   * Returns the full cart for the logged-in user.
   */
  async getCart() {
    const res = await fetch("/api/cart");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) handleUnauthorized(err);
      throw new Error(err.message || "Failed to fetch cart");
    }
    return res.json(); // { cart: { items: [...] } }
  },

  /**
   * PATCH /api/cart/item/:itemId/quantity
   * Body: { quantity }
   */
  async updateQuantity(itemId, quantity) {
    const res = await fetch(`/api/cart/item/${itemId}/quantity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) handleUnauthorized(err);
      throw new Error(err.message || "Failed to update quantity");
    }
    return res.json();
  },

  /**
   * POST /api/cart/item/:itemId/wishlist
   * Moves item from cart to wishlist, removes from cart.
   */
  async moveToWishlist(itemId) {
    const res = await fetch(`/api/cart/item/${itemId}/wishlist`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) handleUnauthorized(err);
      throw new Error(err.message || "Failed to move to wishlist");
    }
    return res.json();
  },

  /**
   * DELETE /api/cart/item/:itemId
   */
  async removeItem(itemId) {
    const res = await fetch(`/api/cart/item/${itemId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) handleUnauthorized(err);
      throw new Error(err.message || "Failed to remove item");
    }
    return res.json();
  },
};

// ============================================================
// 401 HANDLER
// ============================================================

function handleUnauthorized(data) {
  if (!data?.redirectUrl) return;
  showToast(data.message || "Please log in to continue.", "error");
  setTimeout(() => {
    window.location.href = data.redirectUrl;
  }, data.redirectIn ?? 5000);
}

// ============================================================
// STATE
// ============================================================

let cartItems = [];         // fetched from DB — array of item objects
let selectedIds = new Set(); // Set of item._id strings

// ============================================================
// SUMMARY RENDERER
// ============================================================

function renderSummary() {
  const itemsContainer = document.querySelector(".checkout-items");
  if (!itemsContainer) return;

  itemsContainer.innerHTML = "";
  let subtotal = 0;

  selectedIds.forEach((id) => {
    const item = cartItems.find((i) => String(i._id) === id);
    if (!item) return;

    const total = item.price * item.quantity;
    subtotal += total;

    itemsContainer.insertAdjacentHTML("beforeend", `
      <div class="checkout-item">
        <img src="${safeImageUrl(item.img)}" alt="${safeText(item.title, "Cart item")}">
        <h4>${safeText(item.title, "Cart item")}</h4>
        <p class="checkout-line-price">Rs.${money(total)}</p>
      </div>
    `);
  });

  const total = subtotal;

  const subEl   = document.getElementById("subtotal");
  const taxEl   = document.getElementById("tax");
  const totalEl = document.getElementById("total");

  if (subEl)   subEl.textContent   = `Rs.${subtotal.toLocaleString()}`;
  if (taxEl)   taxEl.style.display = "none";
  const taxRow = taxEl?.closest(".summary-line");
  if (taxRow)  taxRow.style.display = "none";
  if (totalEl) totalEl.textContent = `Rs.${total.toLocaleString()}`;
}

// ============================================================
// CART RENDERER
// ============================================================

function renderCart() {
  const container = document.querySelector(".cart-products");
  if (!container) return;

  // Clean up selectedIds — remove any that no longer exist in cart
  const validIds = new Set(cartItems.map((i) => String(i._id)));
  selectedIds.forEach((id) => {
    if (!validIds.has(id)) selectedIds.delete(id);
  });

  container.innerHTML = "";

  if (!cartItems.length) {
    container.innerHTML = `<div class="cart-empty">Your cart is empty.</div>`;
    renderSummary();
    updateCheckoutButton();
    return;
  }

  cartItems.forEach((item) => {
    const id         = String(item._id);
    const isSelected = selectedIds.has(id);
    const card       = document.createElement("div");

    card.className    = `cart-product ${isSelected ? "selected" : ""}`;
    card.dataset.id   = id;

    card.innerHTML = 
    `<div class="cart-product-top">
<div class="wish-del">
<button type="button" class="cart-wishlist-btn">
<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
</button>
<button type="button" class="delete-product">
<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
</button>
</div>
<div class="details-product">
<label class="item-check">
<input type="checkbox" class="item-checkbox" ${isSelected ? "checked" : ""}>
</label>
<div class="img-product"><img src="${safeImageUrl(item.img)}" alt="${safeText(item.title, "Cart item")}"></div>
<div class="details">
<h3>${safeText(item.title, "Cart item")}</h3>
<div class="details-price-row">
<p class="cart-price-each">Rs.${money(item.price)} /piece</p>
<div class="details-row-actions">
<div class="quantity">
<button type="button" class="decrease">-</button>
<span class="quantity-value">${item.quantity}</span>
<button type="button" class="increase">+</button>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="cart-item-side">
<h3 class="cart-line-total">
  ${money(item.quantity)} x Rs.${money(item.price)} = Rs.${money(item.price * item.quantity)}
</h3></div>
</div>
    `;

    container.appendChild(card);
  });

  updateCheckoutButton();
  bindCartEvents();
  renderSummary();
}

function updateCheckoutButton() {
  const checkoutBtn = document.getElementById("proceed-checkout");
  if (!checkoutBtn) return;
  const empty = cartItems.length === 0;
  checkoutBtn.disabled      = empty;
  checkoutBtn.style.opacity = empty ? "0.5" : "1";
  checkoutBtn.style.cursor  = empty ? "not-allowed" : "pointer";
}

// ============================================================
// CART EVENT BINDINGS
// ============================================================

function bindCartEvents() {
  document.querySelectorAll(".cart-product").forEach((card) => {
    const id = card.dataset.id;

    // ── Checkbox ──
    card.querySelector(".item-checkbox")?.addEventListener("change", (e) => {
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      card.classList.toggle("selected", e.target.checked);
      renderSummary();
    });

    // ── Card click (select toggle) ──
    card.addEventListener("click", (e) => {
      if (
        e.target.closest("button") ||
        e.target.closest(".item-check") ||
        e.target.closest(".cart-item-side")
      ) return;

      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const cb = card.querySelector(".item-checkbox");

      if (isDesktop && cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event("change"));
        return;
      }

      if (!isDesktop) {
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
          card.classList.remove("selected");
        } else {
          selectedIds.add(id);
          card.classList.add("selected");
        }
        if (cb) cb.checked = selectedIds.has(id);
        renderSummary();
      }
    });

    // ── Increase quantity ──
    card.querySelector(".increase")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = cartItems.find((i) => String(i._id) === id);
      if (!item) return;

      try {
        const data = await API.updateQuantity(id, item.quantity + 1);
        cartItems = data.cart.items;
        renderCart();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // ── Decrease quantity ──
    card.querySelector(".decrease")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = cartItems.find((i) => String(i._id) === id);
      if (!item || item.quantity <= 1) return;

      try {
        const data = await API.updateQuantity(id, item.quantity - 1);
        cartItems = data.cart.items;
        renderCart();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // ── Wishlist button ──
    card.querySelector(".cart-wishlist-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = cartItems.find((i) => String(i._id) === id);
      if (!item) return;

      const btn = card.querySelector(".cart-wishlist-btn");
      btn.disabled = true;

      try {
        const data = await API.moveToWishlist(id);
        cartItems = data.cart.items;
        selectedIds.delete(id);
        renderCart();
        showToast(`${item.title} moved to wishlist`);
      } catch (err) {
        showToast(err.message, "error");
        btn.disabled = false;
      }
    });

    // ── Delete item ──
    card.querySelector(".delete-product")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = cartItems.find((i) => String(i._id) === id);
      if (!item) return;

      try {
        const data = await API.removeItem(id);
        cartItems = data.cart.items;
        selectedIds.delete(id);
        renderCart();
        showToast(`${item.title} removed from cart`);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

// ============================================================
// CHECKOUT POPUP
// ============================================================

const PAYMENT_METHODS = [
  { id: "esewa",   label: "eSewa",            logo: "🟢" },
  { id: "khalti",  label: "Khalti",           logo: "🟣" },
  { id: "ime",     label: "IME Pay",          logo: "🔵" },
  { id: "connectips", label: "ConnectIPS",   logo: "🏦" },
  { id: "cod",     label: "Cash on Delivery", logo: "💵" },
];

let selectedPayment = null;

function buildCheckoutPopup() {
  const existing = document.getElementById("_checkoutPopup");
  if (existing) existing.remove();

  // build order rows from selected items
  const selectedItems = cartItems.filter(i => selectedIds.has(String(i._id)));
  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = Math.round(subtotal * 0.13);
  const total    = subtotal + tax;

  const orderRowsHTML = selectedItems.map(i => `
    <div class="co-item">
      <img src="${safeImageUrl(i.img, "")}" alt="${safeText(i.title, "Cart item")}">
      <div class="co-item-info">
        <span class="co-item-title">${safeText(i.title, "Cart item")}</span>
        <span class="co-item-qty">x ${money(i.quantity)}</span>
      </div>
      <span class="co-item-price">Rs.${money(i.price * i.quantity)}</span>
    </div>
  `).join("");

  const paymentHTML = PAYMENT_METHODS.map(m => `
    <button class="co-pay-btn" data-method="${m.id}" type="button">
      <span class="co-pay-logo">${m.logo}</span>
      <span class="co-pay-label">${m.label}</span>
    </button>
  `).join("");

  const overlay = document.createElement("div");
  overlay.id        = "_checkoutPopup";
  overlay.className = "co-overlay";
  overlay.innerHTML = `
    <div class="co-modal" role="dialog" aria-modal="true" aria-label="Checkout">

      <div class="co-header">
        <h2 class="co-title">Checkout</h2>
        <button class="co-close" id="_coClose" aria-label="Close">✕</button>
      </div>

      <div class="co-body">

        <!-- ORDER SUMMARY -->
        <section class="co-section">
          <h3 class="co-section-title">Order Summary</h3>
          <div class="co-items">${orderRowsHTML}</div>
          <div class="co-totals">
            <div class="co-total-row"><span>Subtotal</span><span>Rs.${money(subtotal)}</span></div>
            <div class="co-total-row"><span>Tax (13%)</span><span>Rs.${money(tax)}</span></div>
            <div class="co-total-row co-total-final"><span>Total</span><span>Rs.${money(total)}</span></div>
          </div>
        </section>

        <!-- DELIVERY ADDRESS -->
        <section class="co-section">
          <h3 class="co-section-title">Delivery Address <span class="co-edit-hint">— click any field to edit</span></h3>
          <div class="co-address-grid" id="_coAddressGrid">
            <div class="co-addr-loading">Loading address…</div>
          </div>
        </section>

        <!-- PAYMENT METHOD -->
        <section class="co-section">
          <h3 class="co-section-title">Payment Method</h3>
          <div class="co-pay-grid">${paymentHTML}</div>
        </section>

      </div>

      <div class="co-footer">
        <button class="co-btn-cancel" id="_coCancel">Cancel</button>
        <button class="co-btn-continue" id="_coContinue" disabled>Continue</button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // close handlers
  document.getElementById("_coClose").addEventListener("click",  () => overlay.remove());
  document.getElementById("_coCancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  // payment selection
  overlay.querySelectorAll(".co-pay-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      overlay.querySelectorAll(".co-pay-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedPayment = btn.dataset.method;
      document.getElementById("_coContinue").disabled = false;
    });
  });

  // continue button — save order to DB then redirect
  document.getElementById("_coContinue").addEventListener("click", async () => {
    if (!selectedPayment) return;

    const continueBtn = document.getElementById("_coContinue");

    // collect address — selects for province/district/municipality, contenteditable for rest
    const deliveryAddress = {};
    const grid = document.getElementById("_coAddressGrid");
    if (grid) {
      grid.querySelectorAll(".co-addr-select[data-key]").forEach(el => {
        deliveryAddress[el.dataset.key] = el.value;
      });
      grid.querySelectorAll(".co-addr-field[data-key]").forEach(el => {
        deliveryAddress[el.dataset.key] = el.textContent.trim();
      });
    }

    continueBtn.disabled    = true;
    continueBtn.textContent = "Placing order…";

    try {
      // save order to DB
      const res = await fetch("/api/orders/place", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map(i => ({
            title:       i.title,
            price:       i.price,
            img:         i.img,
            description: i.description,
            quantity:    i.quantity,
          })),
          deliveryAddress,
          subtotal,
          tax,
          total,
          paymentMethod: selectedPayment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.message || "Failed to place order", "error");
        continueBtn.disabled    = false;
        continueBtn.textContent = "Continue";
        return;
      }

      const { orderId } = await res.json();
      overlay.remove();

      // all methods → go to upload page for custom design files
      // upload page handles COD → /success and online → payment gateway
      window.location.href = `/serve/checkout/upload?orderId=${orderId}&method=${selectedPayment}&total=${total}`;

    } catch (err) {
      console.error("[checkout] error:", err);
      showToast("Something went wrong. Please try again.", "error");
      continueBtn.disabled    = false;
      continueBtn.textContent = "Continue";
    }
  });

  // load delivery address
  loadCheckoutAddress(overlay);
}

async function loadCheckoutAddress(overlay) {
  const grid = document.getElementById("_coAddressGrid");
  if (!grid) return;

  // load saved address
  let addr = {};
  try {
    const res  = await fetch("/api/address/fetch", { credentials: "include" });
    const data = await res.json();
    addr = data.deliveryAddress || {};
  } catch (e) { /* use empty addr */ }

  // load nepal geo data
  let addressData = [];
  try {
    const res  = await fetch("/api/nepal-data");
    const data = await res.json();
    addressData = data.provinceList || [];
  } catch (e) { /* ignore */ }

  // build province options
  const provinceOptions = addressData.map(p =>
    `<option value="${safeText(p.name)}" ${addr.province === p.name ? "selected" : ""}>${safeText(p.name)}</option>`
  ).join("");

  // build district options for saved province
  const savedProvince = addressData.find(p => p.name === addr.province);
  const districtOptions = savedProvince
    ? savedProvince.districtList.map(d =>
        `<option value="${safeText(d.name)}" ${addr.district === d.name ? "selected" : ""}>${safeText(d.name)}</option>`
      ).join("")
    : "";

  // build municipality options for saved district
  const savedDistrict = savedProvince?.districtList.find(d => d.name === addr.district);
  const municipalityOptions = savedDistrict
    ? savedDistrict.municipalityList.map(m =>
        `<option value="${safeText(m.name)}" ${addr.municipality === m.name ? "selected" : ""}>${safeText(m.name)}</option>`
      ).join("")
    : "";

  grid.innerHTML = `
    <div class="co-addr-row">
      <span class="co-addr-label">Province</span>
      <select class="co-addr-select" id="_coProvince" data-key="province">
        <option value="">Select Province</option>
        ${provinceOptions}
      </select>
    </div>
    <div class="co-addr-row">
      <span class="co-addr-label">District</span>
      <select class="co-addr-select" id="_coDistrict" data-key="district">
        <option value="">Select District</option>
        ${districtOptions}
      </select>
    </div>
    <div class="co-addr-row">
      <span class="co-addr-label">Municipality</span>
      <select class="co-addr-select" id="_coMunicipality" data-key="municipality">
        <option value="">Select Municipality</option>
        ${municipalityOptions}
      </select>
    </div>
    <div class="co-addr-row">
      <span class="co-addr-label">Ward No.</span>
      <div class="co-addr-field" data-key="ward" contenteditable="true" spellcheck="false">${safeText(addr.ward)}</div>
    </div>
    <div class="co-addr-row">
      <span class="co-addr-label">Address Details</span>
      <div class="co-addr-field" data-key="addressDetails" contenteditable="true" spellcheck="false">${safeText(addr.addressDetails)}</div>
    </div>
  `;

  const provinceEl     = grid.querySelector("#_coProvince");
  const districtEl     = grid.querySelector("#_coDistrict");
  const municipalityEl = grid.querySelector("#_coMunicipality");

  // cascade: province → district
  provinceEl.addEventListener("change", () => {
    const province = addressData.find(p => p.name === provinceEl.value);
    districtEl.innerHTML     = `<option value="">Select District</option>`;
    municipalityEl.innerHTML = `<option value="">Select Municipality</option>`;
    province?.districtList.forEach(d => {
      districtEl.innerHTML += `<option value="${safeText(d.name)}">${safeText(d.name)}</option>`;
    });
  });

  // cascade: district → municipality
  districtEl.addEventListener("change", () => {
    const province = addressData.find(p => p.name === provinceEl.value);
    const district = province?.districtList.find(d => d.name === districtEl.value);
    municipalityEl.innerHTML = `<option value="">Select Municipality</option>`;
    district?.municipalityList.forEach(m => {
      municipalityEl.innerHTML += `<option value="${safeText(m.name)}">${safeText(m.name)}</option>`;
    });
  });
}

function setupCheckout() {
  const checkoutBtn = document.getElementById("proceed-checkout");
  if (!checkoutBtn) return;

  checkoutBtn.addEventListener("click", () => {
    if (cartItems.length === 0) {
      showPopup("Your cart is empty!");
      return;
    }
    if (selectedIds.size === 0) {
      showPopup("Please select at least one product!");
      return;
    }
    selectedPayment = null;
    buildCheckoutPopup();
  });
}

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupMenuClose();
  setupCheckout();

  try {
    const data = await API.getCart();
    cartItems = data.cart?.items || [];
  } catch (err) {
    cartItems = [];
  }

  // auto-select item if redirected from Buy Now
  const selectId = new URLSearchParams(window.location.search).get("select");
  if (selectId) {
    selectedIds.add(selectId);
    // clean URL
    history.replaceState(null, "", "/serve/cart");
  }

  renderCart();
});
