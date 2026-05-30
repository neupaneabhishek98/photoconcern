// ============================================================
// UTILITIES
// ============================================================

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

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

function parsePrice(priceText) {
  return Number(String(priceText).replace(/[^0-9]/g, "")) || 0;
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

function setupQuickUpload() {
  const dropzone = document.getElementById("quickUploadDropzone");
  const input = document.getElementById("quickUploadInput");
  const browseBtn = document.getElementById("quickUploadBrowse");
  const continueBtn = document.getElementById("quickUploadContinue");
  const preview = document.getElementById("quickUploadPreview");
  const meta = document.getElementById("quickUploadMeta");
  if (!dropzone || !input || !browseBtn || !continueBtn || !preview || !meta) return;

  let files = [];
  let objectUrls = [];
  const MIN_PHOTOS = 120;
  const MAX_PHOTOS = 150;
  let isStartingOrder = false;

  function openPicker() {
    input.click();
  }

  function pulseText(el) {
    if (!el) return;
    el.classList.remove("pc-text-attention");
    void el.offsetWidth;
    el.classList.add("pc-text-attention");
    window.clearTimeout(el._pcAttentionTimer);
    el._pcAttentionTimer = window.setTimeout(() => {
      el.classList.remove("pc-text-attention");
    }, 1200);
  }

  function clearObjectUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function renderPreview() {
    clearObjectUrls();
    preview.innerHTML = "";

    if (!files.length) {
      meta.textContent = `Upload at least ${MIN_PHOTOS} photos. Maximum ${MAX_PHOTOS}.`;
      updateContinueButton();
      return;
    }

    const remaining = Math.max(MIN_PHOTOS - files.length, 0);
    meta.textContent = remaining
      ? `${files.length}/${MIN_PHOTOS} photos selected. Add ${remaining} more to continue.`
      : `${files.length} photos ready. You can continue.`;

    files.slice(0, 6).forEach((file, index) => {
      const tile = document.createElement("div");
      tile.className = "quick-upload-thumb";

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        const img = document.createElement("img");
        img.src = url;
        img.alt = file.name;
        tile.appendChild(img);
      }

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "quick-upload-remove";
      removeBtn.textContent = "x";
      removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        files.splice(index, 1);
        renderPreview();
      });

      tile.appendChild(removeBtn);
      preview.appendChild(tile);
    });

    updateContinueButton();
  }

  function updateContinueButton(isStarting = false) {
    isStartingOrder = isStarting;
    const ready = files.length >= MIN_PHOTOS;
    continueBtn.disabled = isStarting;
    continueBtn.setAttribute("aria-disabled", String(!ready || isStarting));
    continueBtn.classList.toggle("is-ready", ready && !isStarting);
    continueBtn.innerHTML = isStarting
      ? "Starting..."
      : ready
        ? `Continue order <span class="quick-upload-arrow" aria-hidden="true">→</span>`
        : "Continue order";
  }

  function addFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter((file) =>
      file.type.startsWith("image/")
    );
    files = [...files, ...nextFiles].slice(0, MAX_PHOTOS);
    renderPreview();
  }

  browseBtn.addEventListener("click", openPicker);
  dropzone.addEventListener("click", openPicker);
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });

  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });

  continueBtn.addEventListener("mouseenter", () => {
    if (!isStartingOrder && files.length < MIN_PHOTOS) pulseText(meta);
  });

  continueBtn.addEventListener("click", async () => {
    if (files.length < MIN_PHOTOS) {
      pulseText(meta);
      return;
    }
    updateContinueButton(true);

    try {
      await API.addToCart({
        title: "Karizma Album Order",
        price: "0",
        img: "/resources/karizma-album.png",
        desc: files.length
          ? `${files.length} selected photos for a Karizma Album order.`
          : "Karizma Album order.",
      });
      window.location.href = "/serve/cart";
    } catch (err) {
      showToast(err.message, "error");
      updateContinueButton();
    }
  });

  updateContinueButton();
}

function setupKarizmaOrderToggle() {
  const trigger = document.getElementById("karizmaOrderToggle");
  const card = document.getElementById("karizmaOrderCard");
  if (!trigger || !card) return;

  trigger.addEventListener("click", () => {
    card.classList.remove("is-collapsed");
  });
}

function setupCreatorsForm() {
  const form = document.getElementById("creatorsForm");
  const dropzone = document.getElementById("creatorsDropzone");
  const input = document.getElementById("creatorsInput");
  const preview = document.getElementById("creatorsPreview");
  const count = document.getElementById("creatorsCount");
  const uploadTitle = document.getElementById("creatorsUploadTitle");
  const owner = document.getElementById("creatorsOwner");
  const ownerLabel = document.getElementById("creatorsOwnerLabel");
  const ownerText = document.getElementById("creatorsOwnerText");
  const send = document.getElementById("creatorsSend");
  if (!form || !dropzone || !input || !preview || !count || !owner || !send) return;

  let files = [];
  let objectUrls = [];
  let isSending = false;
  const MAX_FILES = 30;

  function clearObjectUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function pulseText(el) {
    if (!el) return;
    el.classList.remove("pc-text-attention");
    void el.offsetWidth;
    el.classList.add("pc-text-attention");
    window.clearTimeout(el._pcAttentionTimer);
    el._pcAttentionTimer = window.setTimeout(() => {
      el.classList.remove("pc-text-attention");
    }, 1200);
  }

  function showCreatorRequirements() {
    const hasPhotos = files.length > 0;
    if (!hasPhotos) {
      pulseText(uploadTitle);
      pulseText(count);
      pulseText(ownerText);
      return;
    }
    if (!owner.checked) pulseText(ownerText);
  }

  function updateState() {
    const hasPhotos = files.length > 0;
    owner.disabled = !hasPhotos;
    ownerLabel?.classList.toggle("is-enabled", hasPhotos);
    if (!hasPhotos) owner.checked = false;
    const ready = hasPhotos && owner.checked;
    send.disabled = isSending;
    send.setAttribute("aria-disabled", String(!ready || isSending));
    send.classList.toggle("is-ready", ready && !isSending);
    if (hasPhotos) {
      count.textContent = `${files.length} photograph${files.length === 1 ? "" : "s"} ready`;
    } else {
      count.innerHTML = 'Drag and drop your Photograph(s) here, or <button type="button" class="creators-browse">Browse</button> files in your computer.';
    }
  }

  function renderPreview() {
    clearObjectUrls();
    preview.innerHTML = "";
    files.slice(0, 8).forEach((file, index) => {
      const tile = document.createElement("div");
      tile.className = "creators-thumb creators-thumb--file";

      const name = document.createElement("span");
      name.className = "creators-file-name";
      name.textContent = file.name;
      tile.appendChild(name);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "creators-remove";
      remove.textContent = "x";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        files.splice(index, 1);
        renderPreview();
      });

      tile.appendChild(remove);
      preview.appendChild(tile);
    });
    updateState();
  }

  function addFiles(fileList) {
    const next = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    files = [...files, ...next].slice(0, MAX_FILES);
    renderPreview();
  }

  function openPicker() {
    input.click();
  }

  dropzone.addEventListener("click", openPicker);
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });
  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = "";
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });
  dropzone.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer.files);
  });
  owner.addEventListener("change", updateState);
  send.addEventListener("mouseenter", () => {
    if (!send.classList.contains("is-ready")) showCreatorRequirements();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ready = files.length > 0 && owner.checked;
    if (!ready || isSending) {
      showCreatorRequirements();
      return;
    }

    isSending = true;
    send.disabled = true;
    send.classList.remove("is-ready");
    send.setAttribute("aria-disabled", "true");
    send.querySelector("span").textContent = "Sending...";

    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));
    formData.append("description", `PhotoConcern Creators submission with ${files.length} photograph${files.length === 1 ? "" : "s"}.`);
    formData.append("ownerConfirmed", owner.checked ? "true" : "false");

    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not send your submission.");

      showToast(body.message || "Submission sent.", "success");
      files = [];
      owner.checked = false;
      renderPreview();
    } catch (err) {
      showToast(err.message || "Could not send your submission.", "error");
      updateState();
    } finally {
      isSending = false;
      updateState();
      send.querySelector("span").textContent = "Send submission";
    }
  });

  updateState();
}

// ============================================================
// PRODUCTS DATA — loaded from /api/products (products.json)
// ============================================================

let PRODUCTS = [];

async function loadProducts() {
  try {
    const res  = await fetch("/api/products");
    PRODUCTS   = await res.json();
  } catch (e) {
    console.error("Failed to load products:", e);
  }
}

// ============================================================
// API LAYER — DB-READY ENDPOINTS
// ============================================================

const API = {
  /**
   * Add a product to the user's cart in the DB.
   * POST /api/cart/add
   */
  async addToCart(product) {
    const res = await fetch("/api/cart/add", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: product.title,
        price: product.price,
        img: product.img,
        desc: product.desc,
        quantity: 1,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to add to cart");
    }

    return res.json();
  },

  /**
   * Save the user's theme preference in the DB.
   * PATCH /api/user/preferences
   */
  async saveTheme(theme) {
    const res = await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to save theme");
    }

    return res.json();
  },

  /**
   * Fetch the user's saved preferences (theme, etc.) from the DB.
   * GET /api/user/preferences
   */
  async getPreferences() {
    const res = await fetch("/api/user/preferences");
    if (!res.ok) throw new Error("Failed to fetch preferences");
    return res.json();
  },
};

// ============================================================
// PRODUCT CARD RENDERER
// ============================================================

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  const title = safeText(product.title, "PhotoConcern product");
  const desc = safeText(product.desc);
  const price = safeText(product.price);
  const img = safeImageUrl(product.img);

  card.innerHTML = `
  <div class="product-card-thumb">
    <img src="${img}" alt="${title}" loading="lazy">
  </div>
  <div class="product-inform">
    <h3>${title}</h3>
    <p class="desc-product">${desc}</p>
    <p class="price-product">${price}</p>
  </div>
  <div class="card-actions">
    <button type="button" class="add-to-cart-btn"
      data-title="${title}"
      data-price="${price}"
      data-img="${img}"
      data-desc="${desc}">Buy Now</button>
    <button type="button" class="hot-learn-btn"
      data-title="${title}">Learn More</button>
  </div>
`;

  return card;
}

function createFeaturedBanner(product, index) {
  const wrap = document.createElement("div");
  wrap.className = "hot-section";  // same class as Karizma Album — identical layout
  const title = safeText(product.title, "PhotoConcern product");
  const desc = safeText(product.desc);
  const price = safeText(product.price);
  const img = safeImageUrl(product.img);
  wrap.innerHTML = `
    <div class="hot-img-wrap">
      <img src="${img}" alt="${title}" class="hot-img">
      <div class="hot-overlay">
        <div class="hot-top">
          <div class="hot-badge">#${index + 1} Top Selling</div>
        </div>
        <div class="hot-content">
          <h2 class="hot-title">${title}</h2>
          <p class="hot-desc">${desc}</p>
          <p class="hot-price">${price}</p>
          <div class="hot-actions">
            <button type="button" class="add-to-cart-btn hot-cart-btn"
              data-title="${title}"
              data-price="${safeText(product.priceNum || product.price)}"
              data-img="${img}"
              data-desc="${desc}">Buy Now</button>
            <button type="button" class="hot-learn-btn"
              data-title="${title}">Learn More</button>
          </div>
        </div>
      </div>
    </div>
  `;
  return wrap;
}

function renderProducts() {
  const featured    = PRODUCTS.filter(p => p.featured);
  const nonFeatured = PRODUCTS.filter(p => !p.featured);

  const topContainer     = document.querySelector(".products");
  const exploreContainer = document.querySelector(".products2");

  if (topContainer) {
    topContainer.innerHTML = "";
    // render featured products twice (duplicated)
    [...featured, ...featured].forEach((product) => {
      topContainer.appendChild(createProductCard(product));
    });
  }

  if (exploreContainer) {
    exploreContainer.innerHTML = "";
    nonFeatured.forEach(product =>
      exploreContainer.appendChild(createProductCard(product))
    );
  }

  // Build hero slider from featured products
  const slider = document.querySelector(".hero-slider");
  if (slider && featured.length) {
    slider.innerHTML = "";
    featured.forEach((product, i) => {
      const layer = document.createElement("div");
      layer.className = `carousel-layer${i === 0 ? " active" : ""}`;
      layer.dataset.title = String(product.title || "");
      layer.dataset.price = String(product.price || "");
      layer.dataset.desc  = String(product.desc || "");
      layer.innerHTML = `<img src="${safeImageUrl(product.img)}" alt="${safeText(product.title, "Featured product")}" class="hero-main-image">`;
      slider.appendChild(layer);
    });
    if (typeof initHeroSlider === "function") initHeroSlider();
  }
}

// ============================================================
// CART HANDLERS
// ============================================================

function getProductFromCard(btn) {
  return {
    title: btn.dataset.title || "",
    price: btn.dataset.price || "0",
    img:   btn.dataset.img   || "",
    desc:  btn.dataset.desc  || "",
  };
}

function setupAddToCartButtons() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".add-to-cart-btn");
    if (!btn) return;

    const product = getProductFromCard(btn);

    btn.disabled    = true;
    btn.textContent = "Adding…";

    try {
      const result = await API.addToCart(product);
      // find the added item by title to get its _id
      const items = result?.cart?.items || [];
      const added = [...items].reverse().find(i => i.title === product.title);
      const itemId = added?._id || "";
      window.location.href = `/serve/cart${itemId ? `?select=${itemId}` : ""}`;
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled    = false;
      btn.textContent = "Buy Now";
    }
  });
}

function setupLearnMoreButtons() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".hot-learn-btn");
    if (!btn) return;
    const title = btn.dataset.title || "";
    // navigate to a product detail page (slug from title)
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    window.location.href = `/product/${slug}`;
  });
}

function setupBuyNowButtons() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".buy-now-btn");
    if (!btn) return;

    const product = getProductFromCard(btn);

    btn.disabled    = true;
    btn.textContent = "Processing…";

    try {
      await API.addToCart(product);
      window.location.href = "/serve/cart";
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled    = false;
      btn.textContent = "Buy Now";
    }
  });
}

// ============================================================
// THEME TOGGLE — handled by /js/theme.js
// ============================================================

// ============================================================
// NAV — HAMBURGER MENU
// ============================================================

window.toggleMenu = function () {
  const menu = document.querySelector(".quickies");
  if (menu) menu.classList.toggle("show");
};

function setupMenuOutsideClick() {
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
// HERO SLIDER — moved to /js/hero.js
// ============================================================
/*
function setupHeroSlider() {
  const layers = document.querySelectorAll(".hero-slider .carousel-layer");
  const prevBtn = document.querySelector(".hero-slider .carousel-btn.prev");
  const nextBtn = document.querySelector(".hero-slider .carousel-btn.next");

  if (!layers.length || !prevBtn || !nextBtn) return;

  let current = 0;
  let autoPlayTimer;

  function showSlide(index) {
    layers.forEach((layer) => layer.classList.remove("active"));
    layers[index].classList.add("active");
  }

  function nextSlide() {
    current = (current + 1) % layers.length;
    showSlide(current);
  }

  function prevSlide() {
    current = (current - 1 + layers.length) % layers.length;
    showSlide(current);
  }

  function startAutoPlay() {
    autoPlayTimer = setInterval(nextSlide, 6000);
  }

  function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    startAutoPlay();
  }

  prevBtn.addEventListener("click", () => { prevSlide(); resetAutoPlay(); });
  nextBtn.addEventListener("click", () => { nextSlide(); resetAutoPlay(); });

  startAutoPlay();
}
*/


// ============================================================
// LOGOUT — handled by /js/logout.js
// ============================================================

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupQuickUpload();
  setupKarizmaOrderToggle();
  setupCreatorsForm();
  setupMenuOutsideClick();
  // Products section was replaced with the Services grid (static HTML).
  // Skip dynamic product loading on the home page.
  if (document.querySelector(".products")) {
    await loadProducts();
    renderProducts();
  }
  setupAddToCartButtons();
  setupLearnMoreButtons();
  // setupHeroSlider(); — now handled by hero.js
});
