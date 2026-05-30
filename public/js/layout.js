/* ============================================================
   layout.js — shared header + footer renderer.
   Loaded on every page. Injects the same navbar into any
   element with data-pc-header and the same footer into any
   element with data-pc-footer.
   ============================================================ */

(function () {
  // ── Inject FontAwesome (idempotent) ────────────────────────
  if (!document.querySelector('link[data-pc-fa]')) {
    const fa = document.createElement("link");
    fa.rel = "stylesheet";
    fa.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css";
    fa.setAttribute("data-pc-fa", "1");
    fa.crossOrigin = "anonymous";
    fa.referrerPolicy = "no-referrer";
    document.head.appendChild(fa);
  }

  // ── Header markup ──────────────────────────────────────────
  const HEADER_HTML = `
    <div class="navbar">
      <div class="nav-bar-left">
        <a href="/" class="photoconcern-nav" aria-label="PhotoConcern Home">
          <img src="/resources/logo_alt.webp?v=20260530-2" alt="PhotoConcern" class="nav-logo nav-logo-white">
          <img src="/resources/logo_white.webp?v=20260530-2" alt="" class="nav-logo nav-logo-alt" aria-hidden="true">
        </a>
        <a href="https://www.messenger.com/t/photoconcernnepal" target="_blank" rel="noopener" class="nav-contact-btn" aria-label="Chat with PhotoConcern on Messenger">
          <svg class="icons-svg-nav nav-chat-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path class="chat-bubble" d="M4.4 11.2c0-4.1 3.6-7.2 8-7.2s8 3.1 8 7.2-3.6 7.2-8 7.2c-.9 0-1.8-.1-2.6-.4l-4.3 2.2 1.1-4A6.9 6.9 0 0 1 4.4 11.2Z" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/>
            <path class="chat-spark" d="M16.8 6.7l.6 1.2 1.3.5-1.3.5-.6 1.2-.6-1.2-1.3-.5 1.3-.5.6-1.2Z" fill="currentColor"/>
            <circle class="chat-dot chat-dot-1" cx="9.4" cy="11.4" r="0.82" fill="currentColor"/>
            <circle class="chat-dot chat-dot-2" cx="12.2" cy="11.4" r="0.82" fill="currentColor"/>
            <circle class="chat-dot chat-dot-3" cx="15" cy="11.4" r="0.82" fill="currentColor"/>
          </svg>
        </a>
      </div>

      <div class="nav-bar-right">
        <a href="/serve/cart" aria-label="Cart">
          <svg class="icons-svg-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 8h15l-2 11H7L5 4H3"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 8V6a3 3 0 0 1 6 0v2"/>
            <circle cx="9" cy="21" r="1.25"/>
            <circle cx="17" cy="21" r="1.25"/>
          </svg>
        </a>

        <a href="/serve/profile" aria-label="Profile">
          <svg class="icons-svg-nav" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM6 20c0-3.31 2.69-6 6-6s6 2.69 6 6H6z"/>
          </svg>
        </a>

        <div class="hamburger" onclick="toggleMenu()">
          <svg class="icons-svg-nav" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </div>

        <div class="quickies">
          <a href="/serve/cart">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 8h15l-2 11H7L5 4H3"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>
            </svg><span>Cart</span>
          </a>
          <a href="/serve/wishlist">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
            </svg><span>Wishlist</span>
          </a>
          <a href="/orders">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m7.5 4.27 9 0"/><path d="M6 7h12l-1 14H7L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>
            </svg><span>My Orders</span>
          </a>
          <a href="/serve/contact">
            <svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg><span>Contact</span>
          </a>
          <a href="#" aria-label="Toggle theme" class="theme-toggle">
            <span class="icon"></span><span>Theme</span>
          </a>
          <button onclick="logout()" class="logout-btn">
            <svg class="menu-item-icon" fill="currentColor" viewBox="0 0 474 512.46">
              <path d="M249.71.13 12.08 35.6C5.46 36.59 0 43.43 0 50.23v418.88c0 6.77 5.39 9.38 12.08 10.31l237.63 32.97c6.68.92 12.08-7.77 12.08-14.63V10.44c0-6.86-5.53-11.28-12.08-10.31zm124.96 329.08-.01-34.07c-.58.17-1.2.27-1.83.27h-53.47c-3.55 0-6.45-2.96-6.45-6.45v-66.2c0-3.48 2.97-6.45 6.45-6.45h53.47c.63 0 1.24.1 1.82.27v-34.06c0-6.29 5.1-11.4 11.39-11.4 3.29 0 6.25 1.4 8.33 3.63l76.01 70.9c4.59 4.27 4.85 11.47.58 16.06l-76.95 75.59c-4.47 4.4-11.67 4.34-16.07-.13a11.439 11.439 0 0 1-3.27-7.96zm-87.26 129.54h31.02V345.46h25.37v113.9c0 6.77-2.8 12.95-7.27 17.44-4.47 4.52-10.67 7.31-17.49 7.31h-31.63v-25.36zm31.02-292.48V52.98h-31.02V27.62h31.63c6.81 0 13.01 2.79 17.49 7.27 4.47 4.48 7.27 10.68 7.27 17.49v113.89h-25.37zm-87.67 58.52-24.93-5.68v74.24l24.93-7.18v-61.38z"/>
            </svg><span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // ── Footer markup ──────────────────────────────────────────
  const FOOTER_HTML = `
    <div class="site-footer-inner">
      <div class="site-footer-brand">
        <a href="/" aria-label="PhotoConcern Home">
          <img src="/resources/logo_alt.webp?v=20260530-2" alt="PhotoConcern" class="site-footer-logo site-footer-logo-white">
          <img src="/resources/logo_white.webp?v=20260530-2" alt="" class="site-footer-logo site-footer-logo-alt" aria-hidden="true">
        </a>
      </div>

      <ul class="site-footer-col site-footer-home">
        <li><a href="/">Home</a></li>
        <li><a href="/serve/cart">Cart</a></li>
        <li><a href="/serve/contact">Contact us</a></li>
      </ul>

      <div class="site-footer-socials">
        <a href="https://facebook.com/photoconcernnepal" target="_blank" rel="noopener" aria-label="Facebook" class="site-footer-social-tile site-footer-social-tile--fb">
          <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
        </a>

        <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram" class="site-footer-social-tile site-footer-social-tile--ig">
          <i class="fa-brands fa-instagram" aria-hidden="true"></i>
        </a>

        <a href="https://wa.me/9779800000000" target="_blank" rel="noopener" aria-label="WhatsApp" class="site-footer-social-tile site-footer-social-tile--wa">
          <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
        </a>
      </div>

      <button type="button" class="site-footer-top" aria-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>
        </svg>
        <span class="site-footer-top-label">Back to top</span>
      </button>
    </div>

    <div class="site-footer-divider"></div>

    <div class="site-footer-copy">
      &copy; 2026 PhotoConcern. All rights reserved. Built by
      <a href="https://neupaneabhishek98.github.io/" target="_blank" rel="noopener" class="site-footer-credit">Er. Abhishek Neupane</a>
    </div>
  `;

  // ── Mount placeholders ────────────────────────────────────
  function mount() {
    document.querySelectorAll("[data-pc-header]").forEach(el => {
      el.innerHTML = HEADER_HTML;
    });
    // If the page doesn't define a footer placeholder, append one
    if (!document.querySelector("[data-pc-footer]")) {
      const f = document.createElement("footer");
      f.setAttribute("data-pc-footer", "");
      document.body.appendChild(f);
    }
    document.querySelectorAll("[data-pc-footer]").forEach(el => {
      el.classList.add("footers", "site-footer");
      el.innerHTML = FOOTER_HTML;
    });

    // Ensure toggleMenu exists for the injected hamburger
    if (typeof window.toggleMenu !== "function") {
      window.toggleMenu = function () {
        const menu = document.querySelector(".quickies");
        if (menu) menu.classList.toggle("show");
      };
    }

    const updateFooterTopVisibility = () => {
      const topButton = document.querySelector(".site-footer-top");
      if (!topButton) return;
      const hasScroll = document.documentElement.scrollHeight > window.innerHeight + 8;
      topButton.classList.toggle("is-hidden", !hasScroll);
    };
    updateFooterTopVisibility();
    window.addEventListener("resize", updateFooterTopVisibility, { passive: true });
    window.addEventListener("load", updateFooterTopVisibility, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
