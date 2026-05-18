/* ============================================================
   navbar.js — shared across all pages
   1) Session-aware navbar:
        - Logged in   → profile + cart visible
        - Not logged  → profile becomes a Login button, cart hidden
   2) Active-state highlighting on nav icons (primary color #d00106).
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

            // hide logout button in quickies
            document.querySelectorAll(".logout-btn").forEach(btn => btn.style.display = "none");
        }

    } catch (e) {
        // network error — leave as-is
    }
});
