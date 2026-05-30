/* ============================================================
   checkout_upload.js

   Workflow:
   1. User arrives here after order is saved to DB.
   2. They select multiple design photos (optional).
   3. Click "Confirm & Pay":
      - Uploads photos to /api/orders/:orderId/upload-designs
        (Cloudflare Images API ready — see backend TODO)
      - Calls POST /api/orders/:orderId/confirm
      - COD → /success?orderId=xxx
      - Online payment → payment gateway (TODO)
   4. Cancel or navigate away → cancel order in DB + WhatsApp

   URL params: ?orderId=xxx&method=cod&total=1234
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get("orderId");
    const method  = params.get("method") || "cod";
    const total   = Number(params.get("total")) || 0;

    // show amount
    const badge = document.getElementById("uploadTotalBadge");
    if (badge) badge.textContent = `Order Total: Rs.${total.toLocaleString()}`;

    // button label
    const submitBtn = document.getElementById("uploadSubmit");
    if (submitBtn) {
        submitBtn.textContent = method === "cod"
            ? "Place Order"
            : `Pay with ${method.charAt(0).toUpperCase() + method.slice(1)}`;
    }

    let orderCompleted  = false;
    let cancelHandled   = false; // prevents double cancel (button + pagehide)
    let selectedFiles   = [];
    let previewUrls     = [];


/* ── cancel helper ── */
    async function cancelOrder(reason) {
        if (!orderId || orderCompleted || cancelHandled) return;
        cancelHandled = true; // block any subsequent calls
        try {
            await fetch(`/api/orders/${orderId}/cancel`, {
                method:      "POST",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({ reason }),
            });
        } catch (e) { console.error("[cancel]", e); }
    }

    // cancel button — set cancelHandled BEFORE navigating so pagehide is blocked
    document.getElementById("cancelBtn")?.addEventListener("click", async () => {
        await cancelOrder("User clicked Cancel on upload page");
        window.location.href = "/serve/cart";
    });

    // browser back / tab close — only fires if not already handled
    window.addEventListener("pagehide", () => {
        if (orderCompleted || cancelHandled || !orderId) return;
        cancelHandled = true;
        navigator.sendBeacon(
            `/api/orders/${orderId}/cancel`,
            new Blob(
                [JSON.stringify({ reason: "User left upload page without completing" })],
                { type: "application/json" }
            )
        );
    });


/* ── multiple photo picker ── */
    const photoSlot        = document.getElementById("photoSlot");
    const photoInput       = document.getElementById("photoInput");
    const photoPreviewGrid = document.getElementById("photoPreviewGrid");
    const photoCount       = document.getElementById("photoCount");

    photoSlot?.addEventListener("click", () => photoInput.click());

    photoInput?.addEventListener("change", () => {
        const newFiles = Array.from(photoInput.files);
        if (!newFiles.length) return;

        // filter images only — reject anything else with a message
        const nonImages = newFiles.filter(f => !f.type.startsWith("image/"));
        if (nonImages.length) {
            alert(`Only image files are allowed.\nRejected: ${nonImages.map(f => f.name).join(", ")}`);
            photoInput.value = "";
            return;
        }

        // merge with existing selection (no duplicates by name+size)
        newFiles.forEach(f => {
            const exists = selectedFiles.some(e => e.name === f.name && e.size === f.size);
            if (!exists) selectedFiles.push(f);
        });

        renderPreviews();
    });

    function renderPreviews() {
        photoPreviewGrid.innerHTML = "";
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        previewUrls = [];

        selectedFiles.forEach((file, idx) => {
            const url  = URL.createObjectURL(file);
            previewUrls.push(url);
            const wrap = document.createElement("div");
            wrap.className = "preview-thumb";
            const img = document.createElement("img");
            img.src = url;
            img.alt = file.name;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "preview-remove";
            remove.dataset.idx = String(idx);
            remove.setAttribute("aria-label", `Remove ${file.name}`);
            remove.textContent = "x";
            wrap.append(img, remove);
            photoPreviewGrid.appendChild(wrap);
        });

        // update slot text + count
        if (selectedFiles.length > 0) {
            photoSlot.classList.add("has-file");
            photoSlot.querySelector(".upload-slot-text").textContent =
                `${selectedFiles.length} photo${selectedFiles.length > 1 ? "s" : ""} selected`;
            photoCount.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} ready to upload`;
        } else {
            photoSlot.classList.remove("has-file");
            photoSlot.querySelector(".upload-slot-text").textContent = "Click to select photos";
            photoCount.textContent = "";
        }
    }

    // remove individual photo
    photoPreviewGrid?.addEventListener("click", (e) => {
        const btn = e.target.closest(".preview-remove");
        if (!btn) return;
        const idx = Number(btn.dataset.idx);
        selectedFiles.splice(idx, 1);
        renderPreviews();
    });


/* ── form submit ── */
    document.getElementById("uploadForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        submitBtn.disabled    = true;
        submitBtn.textContent = "Uploading…";

        const note = document.getElementById("noteInput")?.value.trim() || "";

        try {
            /* ── Step 1: upload design photos ────────────────
               Calls POST /api/orders/:orderId/upload-designs
               with multipart/form-data.
               Backend uploads to Cloudflare Images and saves
               URLs to the order document.
               If no files selected, skip this step.
               ─────────────────────────────────────────────── */
            if (selectedFiles.length > 0) {
                submitBtn.textContent = `Uploading ${selectedFiles.length} photo${selectedFiles.length > 1 ? "s" : ""}…`;

                const formData = new FormData();
                selectedFiles.forEach(f => formData.append("designs", f));

                const uploadRes = await fetch(`/api/orders/${orderId}/upload-designs`, {
                    method:      "POST",
                    credentials: "include",
                    body:        formData,
                    // NOTE: do NOT set Content-Type header — browser sets it with boundary
                });

                if (!uploadRes.ok) {
                    const err = await uploadRes.json().catch(() => ({}));
                    alert(err.message || "Photo upload failed. Please try again.");
                    submitBtn.disabled    = false;
                    submitBtn.textContent = method === "cod" ? "Place Order" : `Pay with ${method}`;
                    return;
                }
            }

            /* ── Step 2: confirm order ── */
            submitBtn.textContent = "Confirming order…";

            const confirmRes = await fetch(`/api/orders/${orderId}/confirm`, {
                method:      "POST",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({ note }),
            });

            if (!confirmRes.ok) {
                const err = await confirmRes.json().catch(() => ({}));
                alert(err.message || "Could not confirm order. Please try again.");
                submitBtn.disabled    = false;
                submitBtn.textContent = method === "cod" ? "Place Order" : `Pay with ${method}`;
                return;
            }

            orderCompleted = true;

            /* ── Step 3: redirect based on payment method ── */

            if (method === "cod") {
                window.location.href = `/success?orderId=${orderId}`;
                return;
            }

            /* ── eSewa ────────────────────────────────────────
               TODO: Replace with actual eSewa integration.
               const payRes = await fetch(`/api/orders/${orderId}/pay/esewa`, {
                   method: "POST", credentials: "include"
               });
               const { esewaUrl, params } = await payRes.json();
               // build hidden form and POST to esewaUrl with params
               ─────────────────────────────────────────────── */
            if (method === "esewa") {
                window.location.href = `/success?orderId=${orderId}`; // PLACEHOLDER
                return;
            }

            /* ── Khalti ───────────────────────────────────────
               TODO: Replace with actual Khalti integration.
               const payRes = await fetch(`/api/orders/${orderId}/pay/khalti`, {
                   method: "POST", credentials: "include"
               });
               const { paymentUrl } = await payRes.json();
               window.location.href = paymentUrl;
               ─────────────────────────────────────────────── */
            if (method === "khalti") {
                window.location.href = `/success?orderId=${orderId}`; // PLACEHOLDER
                return;
            }

            /* ── IME Pay ──────────────────────────────────────
               TODO: Add IME Pay integration here.
               ─────────────────────────────────────────────── */
            if (method === "ime") {
                window.location.href = `/success?orderId=${orderId}`; // PLACEHOLDER
                return;
            }

            /* ── ConnectIPS ───────────────────────────────────
               TODO: Add ConnectIPS integration here.
               ─────────────────────────────────────────────── */
            if (method === "connectips") {
                window.location.href = `/success?orderId=${orderId}`; // PLACEHOLDER
                return;
            }

            window.location.href = `/success?orderId=${orderId}`;

        } catch (err) {
            console.error("[upload/confirm]", err);
            alert("Something went wrong. Please try again.");
            submitBtn.disabled    = false;
            submitBtn.textContent = method === "cod" ? "Place Order" : `Pay with ${method}`;
        }
    });

});
