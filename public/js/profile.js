document.addEventListener("DOMContentLoaded", async () => {


/* ============================================================
   SECTION 1 — AUTH-AWARE FETCH
   All API calls go through apiFetch.
   401 → redirect to /login immediately.
   ============================================================ */

    async function apiFetch(url, options = {}) {
        const res = await fetch(url, { credentials: "include", ...options });
        if (res.status === 401) {
            window.location.href = "/login";
            throw new Error("Unauthenticated");
        }
        return res;
    }


/* ============================================================
   SECTION 2 — THEME TOGGLE
   Handled by /js/theme.js (loaded on every page).
   ============================================================ */


/* ============================================================
   SECTION 3 — HAMBURGER MENU
   Toggles .show on .quickies, closes on outside click.
   ============================================================ */

    const hamburger = document.querySelector(".hamburger");
    const navMenu   = document.querySelector(".quickies");

    if (hamburger) {
        hamburger.addEventListener("click", (e) => {
            e.stopPropagation();
            navMenu.classList.toggle("show");
        });
    }

    document.addEventListener("click", (e) => {
        if (navMenu && hamburger && !hamburger.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove("show");
        }
    });


/* ============================================================
   SECTION 4 — PROFILE DATA FETCH
   GET /api/profile → normalized flat object from DB.
   ============================================================ */

    async function getProfile() {
        const res = await apiFetch("/api/profile");
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
    }

    let profile, pendingProfile;

    try {
        profile        = await getProfile();
        pendingProfile = { ...profile };
    } catch (err) {
        console.error("[profile] load failed:", err);
        return;
    }


/* ============================================================
   SECTION 5 — HEADER / AVATAR SYNC
   Updates name, email, avatar letter, account type label.
   ============================================================ */

    function syncHeader(p) {
        const nameEl   = document.getElementById("profileNameHeading");
        const emailEl  = document.getElementById("profileEmailHeading");
        const avatarEl = document.getElementById("profileAvatarLetter");
        const roleEl   = document.getElementById("accountTypeText");

        if (nameEl)   nameEl.textContent   = p.fullName || "—";
        if (emailEl)  emailEl.textContent  = p.email    || "—";
        if (avatarEl) avatarEl.textContent = (p.fullName || "A")[0].toUpperCase();
        if (roleEl && p.role) {
            roleEl.innerText = "Account type: " + p.role.charAt(0).toUpperCase() + p.role.slice(1);
        }
    }

    syncHeader(profile);


/* ============================================================
   SECTION 6 — INLINE EDIT (personal info fields)
   .field-view elements are contentEditable.
   Any change populates pendingProfile and shows the save bar.
   ============================================================ */

    document.querySelectorAll(".field-view").forEach(el => {
        const key      = el.dataset.field;
        el.textContent = profile[key] || "—";
        el.contentEditable = true;

        el.addEventListener("input", () => {
            pendingProfile[key] = el.textContent.trim();
            showSaveBar();
        });
    });


/* ============================================================
   SECTION 7 — FLOATING SAVE BAR
   Hidden by default. Appears on any field change.
   Save → PUT /api/profile. Discard → re-fetch from DB.
   ============================================================ */

    let saveBar = document.getElementById("_floatingSaveBar");
    if (!saveBar) {
        saveBar = document.createElement("div");
        saveBar.id = "_floatingSaveBar";
        saveBar.innerHTML = `
            <button id="_discardBtn">Discard</button>
            <button id="_saveBtn">Save changes</button>
        `;
        document.body.appendChild(saveBar);
    }

    hideSaveBar();

    function showSaveBar() { saveBar.style.display = "flex"; }
    function hideSaveBar()  { saveBar.style.display = "none"; }

    const saveBtn    = saveBar.querySelector("#_saveBtn");
    const discardBtn = saveBar.querySelector("#_discardBtn");

    saveBtn.addEventListener("click", async () => {
        saveBtn.disabled    = true;
        saveBtn.textContent = "Saving…";
        try {
            const res = await apiFetch("/api/profile", {
                method:  "PUT",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(pendingProfile)
            });
            if (!res.ok) throw new Error("Save failed");
            profile = { ...pendingProfile };
            syncHeader(profile);
            hideSaveBar();
            showProfileToast("Profile saved successfully", "success");
        } catch (err) {
            console.error("[save] error:", err);
            showProfileToast("Could not save changes. Please try again.", "error");
        } finally {
            saveBtn.disabled    = false;
            saveBtn.textContent = "Save changes";
        }
    });

    discardBtn.addEventListener("click", async () => {
        try {
            profile        = await getProfile();
            pendingProfile = { ...profile };

            document.querySelectorAll(".field-view").forEach(el => {
                el.textContent = profile[el.dataset.field] || "—";
            });
            syncHeader(profile);

            // restore address dropdowns
            if (provinceSelect)     provinceSelect.value     = profile.province       || "";
            if (districtSelect)     districtSelect.value     = profile.district       || "";
            if (municipalitySelect) municipalitySelect.value = profile.municipality   || "";
            if (wardInput)          wardInput.value          = profile.ward           || "";
            if (detailsInput)       detailsInput.value       = profile.addressDetails || "";
            if (profile.province)   populateDistricts(profile.province);
            if (profile.district)   populateMunicipalities(profile.province, profile.district);
            updateAddressStatus();

            hideSaveBar();
            showProfileToast("Changes discarded", "info");
        } catch (err) {
            console.error("[discard] error:", err);
            showProfileToast("Could not reload profile", "error");
        }
    });

    // Shared toast helper for save/discard feedback (with icon)
    function showProfileToast(message, type = "success") {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            document.body.appendChild(container);
        }
        const toast = document.createElement("div");
        toast.className = `toast toast--${type}`;
        const iconSvg =
            type === "success"
                ? `<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>`
                : type === "error"
                ? `<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>`
                : `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v5M12 16h.01"/>`;
        const iconBg =
            type === "success" ? "#22c55e" :
            type === "error"   ? "#e70000" : "#3b82f6";
        toast.innerHTML = `
            <div class="toast-icon" style="background:${iconBg}">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="#fff">${iconSvg}</svg>
            </div>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
            toast.classList.remove("show");
            toast.classList.add("hide");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }


/* ============================================================
   SECTION 8 — ACCOUNT TYPE SWITCH POPUP
   Shows a modal asking for new role details + current password.
   Fields shown depend on target role (freelancer/studio need
   extra fields: pan, location; customer just needs basics).
   On confirm → PUT /api/profile/role → re-fetch profile.
   ============================================================ */

    // new role fields per target role
    const ROLE_FIELDS = {
        customer: [
            { key: "fullName", label: "Full Name",    type: "text",     placeholder: "Your full name" },
            { key: "email",    label: "Email",        type: "email",    placeholder: "your@email.com" },
            { key: "phone",    label: "Phone",        type: "tel",      placeholder: "+977 98XXXXXXXX" },
            { key: "password", label: "New Password", type: "password", placeholder: "Password for new account" },
        ],
        freelancer: [
            { key: "fullName", label: "Full Name",    type: "text",     placeholder: "Your full name" },
            { key: "email",    label: "Email",        type: "email",    placeholder: "your@email.com" },
            { key: "phone",    label: "Phone",        type: "tel",      placeholder: "+977 98XXXXXXXX" },
            { key: "pan",      label: "PAN Number",   type: "text",     placeholder: "e.g. 123456789" },
            { key: "location", label: "Location",     type: "text",     placeholder: "City, District" },
            { key: "password", label: "New Password", type: "password", placeholder: "Password for new account" },
        ],
        studio: [
            { key: "fullName", label: "Studio Name",  type: "text",     placeholder: "Your studio name" },
            { key: "email",    label: "Studio Email", type: "email",    placeholder: "studio@email.com" },
            { key: "phone",    label: "Studio Phone", type: "tel",      placeholder: "+977 98XXXXXXXX" },
            { key: "pan",      label: "PAN Number",   type: "text",     placeholder: "e.g. 123456789" },
            { key: "location", label: "Location",     type: "text",     placeholder: "City, District" },
            { key: "password", label: "New Password", type: "password", placeholder: "Password for new account" },
        ],
    };

    function buildRolePopup(targetRole) {
        const existing = document.getElementById("_rolePopupOverlay");
        if (existing) existing.remove();

        const label      = targetRole.charAt(0).toUpperCase() + targetRole.slice(1);
        const newFields  = ROLE_FIELDS[targetRole] || [];

        const newFieldsHTML = newFields.map(f => `
            <div class="popup-field">
                <label class="popup-label">${f.label}</label>
                <input class="popup-input field-input" type="${f.type}" data-key="${f.key}" placeholder="${f.placeholder}" />
            </div>
        `).join("");

        const overlay = document.createElement("div");
        overlay.id        = "_rolePopupOverlay";
        overlay.className = "popup-overlay";
        overlay.innerHTML = `
            <div class="popup-card" role="dialog" aria-modal="true">

                <div class="popup-header">
                    <h3 class="popup-title">Switch to ${label}</h3>
                    <p class="popup-subtitle">Verify your identity, then fill in your new account details. Your current account will be deleted.</p>
                </div>

                <div class="popup-body">

                    <div class="popup-section-label">Verify current account</div>
                    <div class="popup-field">
                        <label class="popup-label">Current Password</label>
                        <input class="popup-input field-input" type="password" id="_currentPasswordInput" placeholder="Enter your current password" />
                    </div>

                    <div class="popup-divider"></div>

                    <div class="popup-section-label">New ${label} account details</div>
                    ${newFieldsHTML}

                    <p class="popup-warning">⚠ This will permanently delete your current account and create a new one.</p>
                </div>

                <div class="popup-footer">
                    <button class="popup-btn-cancel" id="_popupCancel">Cancel</button>
                    <button class="popup-btn-confirm" id="_popupConfirm">Switch Account</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById("_popupCancel").addEventListener("click", () => overlay.remove());

        document.getElementById("_popupConfirm").addEventListener("click", async () => {
            const confirmBtn      = document.getElementById("_popupConfirm");
            const currentPassword = document.getElementById("_currentPasswordInput").value.trim();
            const roleData        = {};

            overlay.querySelectorAll(".popup-input[data-key]").forEach(inp => {
                roleData[inp.dataset.key] = inp.value.trim();
            });

            // validation
            if (!currentPassword) {
                document.getElementById("_currentPasswordInput").focus();
                return;
            }
            if (!roleData.email || !roleData.password) {
                alert("Email and new password are required.");
                return;
            }

            confirmBtn.disabled    = true;
            confirmBtn.textContent = "Switching…";

            try {
                const res = await apiFetch("/api/profile/switch-role", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ newRole: targetRole, currentPassword, ...roleData })
                });

                if (!res.ok) {
                    const err = await res.json();
                    // show error near current password field if wrong password
                    if (res.status === 401) {
                        const pwInput = document.getElementById("_currentPasswordInput");
                        pwInput.style.borderColor = "#e70000";
                        pwInput.style.boxShadow   = "0 0 0 3px rgba(231, 0, 0, 0.2)";
                        pwInput.placeholder       = err.message;
                        pwInput.value             = "";
                        pwInput.focus();
                    } else {
                        alert(err.message || "Failed to switch account.");
                    }
                    confirmBtn.disabled    = false;
                    confirmBtn.textContent = "Switch Account";
                    return;
                }

                overlay.remove();
                document.getElementById("accountMenu")?.classList.remove("show");

                // re-fetch profile with new account data
                profile        = await getProfile();
                pendingProfile = { ...profile };
                document.querySelectorAll(".field-view").forEach(el => {
                    el.textContent = profile[el.dataset.field] || "—";
                });
                syncHeader(profile);

            } catch (err) {
                console.error("[roleSwitch] error:", err);
                confirmBtn.disabled    = false;
                confirmBtn.textContent = "Switch Account";
            }
        });
    }

    window.toggleAccountDropdown = function () {
        document.getElementById("accountMenu")?.classList.toggle("show");
    };

    window.changeAccountType = function (type) {
        const roleMap = { "Customer": "customer", "Freelancer": "freelancer", "Studio": "studio" };
        const newRole = roleMap[type];
        if (!newRole || newRole === profile.role) return;
        document.getElementById("accountMenu")?.classList.remove("show");
        buildRolePopup(newRole);
    };


/* ============================================================
   SECTION 9 — STATS (cart count, account age)
   Cart count from /api/cart. Age from profile.createdAt.
   ============================================================ */

    async function loadStats() {
        try {
            const res = await apiFetch("/api/cart");
            if (res.ok) {
                const { cart } = await res.json();
                const total = (cart?.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
                const el = document.getElementById("statOrders");
                if (el) el.textContent = total;
            }
        } catch (e) { /* handled by apiFetch */ }

        try {
            if (profile.createdAt) {
                const months = Math.max(1, Math.round(
                    (Date.now() - new Date(profile.createdAt)) / (1000 * 60 * 60 * 24 * 30)
                ));
                const el = document.getElementById("statAge");
                if (el) el.textContent = months === 1 ? "1 month" : months + " months";
            }
        } catch (e) { /* ignore */ }
    }

    await loadStats();


/* ============================================================
   SECTION 10 — DELIVERY ADDRESS
   Fetches saved address from /api/address/fetch.
   Loads province/district/municipality from /api/nepal-data.
   Cascades dropdowns. Saves via /api/address/save.
   Changes trigger the floating save bar.
   ============================================================ */

    const provinceSelect     = document.getElementById("provinceInput");
    const districtSelect     = document.getElementById("districtInput");
    const municipalitySelect = document.getElementById("municipalityInput");
    const wardInput          = document.getElementById("wardInput");
    const detailsInput       = document.getElementById("detailsInput");
    const addressStatus      = document.getElementById("addressStatus");

    let addressData    = [];
    let savedAddress   = {};
    let pendingAddress = {};

    function updateAddressStatus() {
        const filled = provinceSelect?.value && districtSelect?.value && municipalitySelect?.value;
        if (addressStatus) {
            addressStatus.textContent      = filled ? "Saved"   : "Missing";
            addressStatus.style.background = filled ? "#dcfce7" : "";
            addressStatus.style.color      = filled ? "#16a34a" : "";
        }
    }

    function populateDistricts(provinceName) {
        const province = addressData.find(p => p.name === provinceName);
        districtSelect.innerHTML     = `<option value="">Select District</option>`;
        municipalitySelect.innerHTML = `<option value="">Select Municipality</option>`;
        province?.districtList.forEach(d => {
            const opt = document.createElement("option");
            opt.value = opt.textContent = d.name;
            districtSelect.appendChild(opt);
        });
    }

    function populateMunicipalities(provinceName, districtName) {
        const province = addressData.find(p => p.name === provinceName);
        const district = province?.districtList.find(d => d.name === districtName);
        municipalitySelect.innerHTML = `<option value="">Select Municipality</option>`;
        district?.municipalityList.forEach(m => {
            const opt = document.createElement("option");
            opt.value = opt.textContent = m.name;
            municipalitySelect.appendChild(opt);
        });
    }

    async function loadAddress() {
        try {
            // load nepal geo data
            const geoRes  = await fetch("/api/nepal-data");
            const geoData = await geoRes.json();
            addressData   = geoData.provinceList || [];

            provinceSelect.innerHTML = `<option value="">Select Province</option>`;
            addressData.forEach(p => {
                const opt = document.createElement("option");
                opt.value = opt.textContent = p.name;
                provinceSelect.appendChild(opt);
            });

            // fetch saved address from DB
            const addrRes  = await apiFetch("/api/address/fetch");
            const addrData = await addrRes.json();
            savedAddress   = addrData.deliveryAddress || {};
            pendingAddress = { ...savedAddress };

            // restore saved values
            if (savedAddress.province) {
                provinceSelect.value = savedAddress.province;
                populateDistricts(savedAddress.province);
            }
            if (savedAddress.district) {
                districtSelect.value = savedAddress.district;
                populateMunicipalities(savedAddress.province, savedAddress.district);
            }
            if (savedAddress.municipality) municipalitySelect.value = savedAddress.municipality;
            if (savedAddress.ward)         wardInput.value          = savedAddress.ward;
            if (savedAddress.addressDetails) detailsInput.value     = savedAddress.addressDetails;

            updateAddressStatus();
        } catch (err) {
            console.error("[loadAddress] error:", err);
        }
    }

    // address save bar (separate from profile save bar)
    let addrSaveBar = document.getElementById("_addrSaveBar");
    if (!addrSaveBar) {
        addrSaveBar = document.createElement("div");
        addrSaveBar.id = "_addrSaveBar";
        addrSaveBar.innerHTML = `
            <span class="addr-save-label">Delivery address changed</span>
            <button id="_addrDiscardBtn">Discard</button>
            <button id="_addrSaveBtn">Save Address</button>
        `;
        document.body.appendChild(addrSaveBar);
    }
    addrSaveBar.style.display = "none";

    function showAddrBar() { addrSaveBar.style.display = "flex"; }
    function hideAddrBar() { addrSaveBar.style.display = "none"; }

    document.getElementById("_addrSaveBtn").addEventListener("click", async () => {
        const btn = document.getElementById("_addrSaveBtn");
        btn.disabled    = true;
        btn.textContent = "Saving…";
        try {
            const res = await apiFetch("/api/address/save", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(pendingAddress)
            });
            if (!res.ok) throw new Error("Address save failed");
            savedAddress = { ...pendingAddress };
            updateAddressStatus();
            hideAddrBar();
            showProfileToast("Address saved successfully", "success");
        } catch (err) {
            console.error("[address save] error:", err);
            showProfileToast("Could not save address. Please try again.", "error");
        } finally {
            btn.disabled    = false;
            btn.textContent = "Save Address";
        }
    });

    document.getElementById("_addrDiscardBtn").addEventListener("click", () => {
        pendingAddress = { ...savedAddress };
        provinceSelect.value     = savedAddress.province       || "";
        districtSelect.value     = savedAddress.district       || "";
        municipalitySelect.value = savedAddress.municipality   || "";
        wardInput.value          = savedAddress.ward           || "";
        detailsInput.value       = savedAddress.addressDetails || "";
        if (savedAddress.province) populateDistricts(savedAddress.province);
        if (savedAddress.district) populateMunicipalities(savedAddress.province, savedAddress.district);
        updateAddressStatus();
        hideAddrBar();
        showProfileToast("Address changes discarded", "info");
    });

    provinceSelect?.addEventListener("change", () => {
        populateDistricts(provinceSelect.value);
        pendingAddress.province     = provinceSelect.value;
        pendingAddress.district     = "";
        pendingAddress.municipality = "";
        showAddrBar();
        updateAddressStatus();
    });

    districtSelect?.addEventListener("change", () => {
        populateMunicipalities(provinceSelect.value, districtSelect.value);
        pendingAddress.district     = districtSelect.value;
        pendingAddress.municipality = "";
        showAddrBar();
        updateAddressStatus();
    });

    municipalitySelect?.addEventListener("change", () => {
        pendingAddress.municipality = municipalitySelect.value;
        showAddrBar();
        updateAddressStatus();
    });

    wardInput?.addEventListener("input", () => {
        pendingAddress.ward = wardInput.value;
        showAddrBar();
    });

    detailsInput?.addEventListener("input", () => {
        pendingAddress.addressDetails = detailsInput.value;
        showAddrBar();
    });

    await loadAddress();


});
