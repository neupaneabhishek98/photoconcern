// Shared logout — used by all pages.
async function logout() {
    try {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (e) {}
    window.location.href = "/login";
}

// Apply saved theme immediately to prevent flash
(function () {
    const t = localStorage.getItem("theme");
    if (t === "dark") document.documentElement.classList.add("theme-dark");
    // also apply to body once DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        if (t === "dark") document.body.classList.add("theme-dark");
    });
})();

(function () {
    const style = document.createElement("style");
    style.textContent = `
        /* ── Page loading spinner ── */
        #_pageLoader {
            position: fixed;
            inset: 0;
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(6px);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            transition: opacity 0.35s ease;
        }
        body.theme-dark #_pageLoader {
            background: rgba(10,15,28,0.94);
        }
        #_pageLoader.hidden {
            opacity: 0;
            pointer-events: none;
        }
        ._loader-ring {
            width: 44px;
            height: 44px;
            border: 3px solid rgba(84,131,179,0.2);
            border-top-color: #5483B3;
            border-radius: 50%;
            animation: _spin 0.75s linear infinite;
        }
        ._loader-text {
            font-size: 0.82rem;
            font-weight: 600;
            color: rgba(2,16,36,0.45);
            font-family: 'Manrope', 'Poppins', sans-serif;
            letter-spacing: 0.04em;
        }
        body.theme-dark ._loader-text { color: rgba(229,231,235,0.45); }
        @keyframes _spin { to { transform: rotate(360deg); } }

        /* ── logout button ── */
        .logout-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            padding: 14px 16px;
            font-size: 0.8rem;
            font-family: inherit;
            text-decoration: none;
            color: #333;
            background: none;
            border: none;
            border-bottom: 1px solid rgba(0,0,0,0.05);
            cursor: pointer;
            text-align: left;
        }
        .logout-btn:hover { background: #f5f5f5; }
        .logout-btn:active { background: #ececec; }
        body.theme-dark .logout-btn { color: #e70000; background: none; border-bottom-color: rgba(255,255,255,0.1); }
        body.theme-dark .logout-btn:hover { background: rgba(255,255,255,0.06); border-radius: 8px; }

        /* nav login button */
        .nav-login-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 36px;
            padding: 0 24px;
            background: transparent;
            color: #fff !important;
            font-size: 0.85rem;
            font-weight: 700;
            font-family: inherit;
            border-radius: 4px;
            text-decoration: none;
            white-space: nowrap;
            border: 1.5px solid #fff;
            transition: box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
            box-shadow: none;
        }
        .nav-login-btn:hover {
            background: #10a37f;
            border-color: #10a37f;
            box-shadow: none;
        }
        .nav-login-btn:active { background: #0e8f70; border-color: #0e8f70; }
        body.theme-dark .nav-login-btn { background: transparent; color: #fff !important; border-color: #fff; }
        body.theme-dark .nav-login-btn:hover { background: #10a37f; border-color: #10a37f; }
        @media (min-width: 768px) {
            .nav-login-btn { height: 40px; padding: 0 36px; font-size: 0.9rem; }
        }
    `;
    document.head.appendChild(style);

    // inject spinner into body as soon as DOM is available
    function injectLoader() {
        const loader = document.createElement("div");
        loader.id = "_pageLoader";
        loader.innerHTML = `<div class="_loader-ring"></div><span class="_loader-text">Loading…</span>`;
        document.body.prepend(loader);

        // hide after page fully loads (or max 4s)
        const hide = () => {
            loader.classList.add("hidden");
            setTimeout(() => loader.remove(), 400);
        };

        if (document.readyState === "complete") {
            hide();
        } else {
            window.addEventListener("load", hide);
            setTimeout(hide, 4000); // fallback
        }
    }

    if (document.body) {
        injectLoader();
    } else {
        document.addEventListener("DOMContentLoaded", injectLoader);
    }
})();
