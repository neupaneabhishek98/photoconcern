/* ============================================================
   navbar.js — shared across all pages
   1) Session-aware navbar:
        - Logged in   → profile + cart visible
        - Not logged  → profile becomes a Login button, cart hidden
   2) Active-state highlighting on nav icons (primary color #e70000).
   ============================================================ */

(function highlightActiveNav() {
    const path = (location.pathname || "/").toLowerCase();
    const matches = [
        ["/serve/contact",    /^\/serve\/contact/],
        ["/serve/cart",       /^\/serve\/cart/],
        ["/serve/wishlist",   /^\/serve\/wishlist/],
        ["/serve/profile",    /^\/serve\/profile/],
        ["/orders",           /^\/orders/],
        ["/serve/tools/passport", /^\/serve\/tools\/passport/],
        ["/serve/tools/mrp",  /^\/serve\/tools\/mrp/],
        ["/serve/tools/retouch", /^\/serve\/tools\/retouch/],
        ["/",                 /^\/$/],
    ];
    function activate(selector) {
        document.querySelectorAll(selector).forEach((a) => a.classList.add("is-active"));
    }
    for (const [href, re] of matches) {
        if (re.test(path)) {
            activate(`.nav-bar-right > a[href="${href}"]`);
            activate(`.quickies a[href="${href}"]`);
            break;
        }
    }
})();

document.addEventListener("DOMContentLoaded", async () => {

    const profileLink =
        document.querySelector('a[href="/serve/profile"][aria-label="Profile"]') ||
        document.querySelector('a[href="/serve/profile"]');

    const cartLink =
        document.querySelector('a[href="/serve/cart"][aria-label="Cart"]') ||
        document.querySelector('a[href="/serve/cart"]');

    const hamburger = document.querySelector(".hamburger");

    if (!profileLink) return;

    try {
        const res = await fetch("/api/profile", { credentials: "include" });

        if (res.status === 401 || !res.ok) {
            // not logged in — swap profile to Login button
            const loginBtn = document.createElement("a");
            loginBtn.href        = "/login";
            loginBtn.className   = "nav-login-btn";
            loginBtn.textContent = "Login";
            loginBtn.setAttribute("aria-label", "Login");
            profileLink.replaceWith(loginBtn);

            // hide cart icon
            if (cartLink) cartLink.style.display = "none";

            if (hamburger) {
                const phoneLink = document.createElement("a");
                phoneLink.href = "/serve/contact";
                phoneLink.className = "nav-phone-btn";
                phoneLink.setAttribute("aria-label", "Contact PhotoConcern");
                phoneLink.innerHTML = `
                    <svg class="icons-svg-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M22 16.92v2.6a2 2 0 0 1-2.18 2 19.78 19.78 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.78 19.78 0 0 1-3.07-8.63A2 2 0 0 1 4.11 1.82h2.6a2 2 0 0 1 2 1.72c.13.98.36 1.93.7 2.84a2 2 0 0 1-.45 2.11L7.85 9.6a16 16 0 0 0 6.55 6.55l1.11-1.11a2 2 0 0 1 2.11-.45c.91.34 1.86.57 2.84.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                `;
                hamburger.replaceWith(phoneLink);
            }

            // hide logout button in quickies
            document.querySelectorAll(".logout-btn").forEach(btn => btn.style.display = "none");
        }

    } catch (e) {
        // network error — leave as-is
    }
});
