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
    <span>${message}</span>
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

  function openPicker() {
    input.click();
  }

  function clearObjectUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
  }

  function renderPreview() {
    clearObjectUrls();
    preview.innerHTML = "";

    if (!files.length) {
      meta.textContent = "JPG, PNG, WEBP or PDF";
      return;
    }

    meta.textContent = `${files.length} file${files.length === 1 ? "" : "s"} ready`;

    files.slice(0, 6).forEach((file, index) => {
      const tile = document.createElement("div");
      tile.className = "quick-upload-thumb";

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        tile.innerHTML = `<img src="${url}" alt="${file.name}">`;
      } else {
        tile.classList.add("quick-upload-thumb--file");
        tile.textContent = file.name.split(".").pop()?.toUpperCase() || "FILE";
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
  }

  function addFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter((file) =>
      file.type.startsWith("image/") || file.type === "application/pdf"
    );
    files = [...files, ...nextFiles].slice(0, 12);
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

  continueBtn.addEventListener("click", async () => {
    continueBtn.disabled = true;
    continueBtn.textContent = "Starting...";

    try {
      await API.addToCart({
        title: "Custom Photo Upload",
        price: "0",
        img: "/resources/photobook.png",
        desc: files.length
          ? `${files.length} selected file${files.length === 1 ? "" : "s"} for custom printing.`
          : "Custom photo printing order.",
      });
      window.location.href = "/serve/cart";
    } catch (err) {
      showToast(err.message, "error");
      continueBtn.disabled = false;
      continueBtn.textContent = "Continue order";
    }
  });
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

  card.innerHTML = `
  <div class="product-card-thumb">
    <img src="${product.img}" alt="${product.title}" loading="lazy">
  </div>
  <div class="product-inform">
    <h3>${product.title}</h3>
    <p class="desc-product">${product.desc}</p>
    <p class="price-product">${product.price}</p>
  </div>
  <div class="card-actions">
    <button type="button" class="add-to-cart-btn"
      data-title="${product.title}"
      data-price="${product.price}"
      data-img="${product.img}"
      data-desc="${product.desc}">Buy Now</button>
    <button type="button" class="hot-learn-btn"
      data-title="${product.title}">Learn More</button>
  </div>
`;

  return card;
}

function createFeaturedBanner(product, index) {
  const wrap = document.createElement("div");
  wrap.className = "hot-section";  // same class as photo book — identical layout
  wrap.innerHTML = `
    <div class="hot-img-wrap">
      <img src="${product.img}" alt="${product.title}" class="hot-img">
      <div class="hot-overlay">
        <div class="hot-top">
          <div class="hot-badge">#${index + 1} Top Selling</div>
        </div>
        <div class="hot-content">
          <h2 class="hot-title">${product.title}</h2>
          <p class="hot-desc">${product.desc}</p>
          <p class="hot-price">${product.price}</p>
          <div class="hot-actions">
            <button type="button" class="add-to-cart-btn hot-cart-btn"
              data-title="${product.title}"
              data-price="${product.priceNum || product.price}"
              data-img="${product.img}"
              data-desc="${product.desc}">Buy Now</button>
            <button type="button" class="hot-learn-btn"
              data-title="${product.title}">Learn More</button>
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
      layer.dataset.title = product.title;
      layer.dataset.price = product.price;
      layer.dataset.desc  = product.desc;
      layer.innerHTML = `<img src="${product.img}" alt="${product.title}" class="hero-main-image">`;
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
  setupMenuOutsideClick();
  await loadProducts();
  renderProducts();
  setupAddToCartButtons();
  setupLearnMoreButtons();
  // setupHeroSlider(); — now handled by hero.js
});
