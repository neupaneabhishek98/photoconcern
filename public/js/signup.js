const accountDropdown = document.getElementById("account_type");
const customerForm    = document.querySelector(".customerForm");
const studioForm      = document.querySelector(".studioForm");
const freelancerForm  = document.querySelector(".freelancerForm");
const forms           = [customerForm, studioForm, freelancerForm];

accountDropdown.addEventListener("change", function () {
    const value = this.value;
    forms.forEach(f => { if (f) f.style.display = "none"; });
    if (value === "customer")   customerForm.style.display   = "flex";
    else if (value === "studio")     studioForm.style.display     = "flex";
    else if (value === "freelancer") freelancerForm.style.display = "flex";
});

// ── toast ──────────────────────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
    const container = document.getElementById("toast-container");
    if (!container) { alert(message); return; }

    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: #fff;
        font-size: 0.9rem;
        font-weight: 600;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        opacity: 0;
        transition: opacity 0.3s ease;
        background: ${type === "success" ? "#16a34a" : type === "error" ? "#e70000" : "#021024"};
    `;
    container.appendChild(toast);
    setTimeout(() => toast.style.opacity = 1, 50);
    setTimeout(() => {
        toast.style.opacity = 0;
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ── helpers ────────────────────────────────────────────────
function isValidPhone(val) {
    const d = String(val).replace(/\D/g, "");
    return d.length === 8 || d.length === 10;
}

function isValidPan(val) {
    const d = String(val).replace(/\D/g, "");
    return d.length === 9;
}

// ── get active form section ────────────────────────────────
function getActiveRole() {
    return accountDropdown.value;
}

// ── password match check per role ─────────────────────────
function passwordsMatch(role) {
    const formMap = {
        customer:   ".customerForm",
        studio:     ".studioForm",
        freelancer: ".freelancerForm",
    };
    const pairMap = { customer: "1", studio: "2", freelancer: "3" };

    const formEl = document.querySelector(formMap[role]);
    if (!formEl) return true;

    const pair       = pairMap[role];
    const passInputs = formEl.querySelectorAll(`input[type="password"][data-pair="${pair}"]`);
    if (passInputs.length < 2) return true;

    const pass    = passInputs[0].value;
    const confirm = passInputs[1].value;

    if (!pass) {
        showToast("Password cannot be empty.", "error");
        return false;
    }

    return pass === confirm;
}

// ── form submit ────────────────────────────────────────────
document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const role = getActiveRole();

    // password match
    if (!passwordsMatch(role)) {
        showToast("Passwords do not match.", "error");
        return;
    }

    // phone validation
    const phoneMap = {
        customer:   'input[name="phone"]',
        studio:     'input[name="studio_phone"]',
        freelancer: 'input[name="free_phone"]',
    };
    const phoneInput = document.querySelector(phoneMap[role]);
    if (phoneInput?.value && !isValidPhone(phoneInput.value)) {
        showToast("Phone number must be 8 or 10 digits.", "error");
        phoneInput.focus();
        return;
    }

    // PAN validation (studio + freelancer only)
    const panMap = {
        studio:     'input[name="studio_pan"]',
        freelancer: 'input[name="free_pan"]',
    };
    if (panMap[role]) {
        const panInput = document.querySelector(panMap[role]);
        if (panInput?.value && !isValidPan(panInput.value)) {
            showToast("PAN number must be exactly 9 digits.", "error");
            panInput.focus();
            return;
        }
    }

    // collect form data — store phone as string, location as string
    const formData = new FormData(this);
    const data     = Object.fromEntries(formData.entries());

    // ensure phone stored as string (already is, but be explicit)
    if (data.phone)        data.phone        = String(data.phone).trim();
    if (data.studio_phone) data.studio_phone = String(data.studio_phone).trim();
    if (data.free_phone)   data.free_phone   = String(data.free_phone).trim();

    try {
        const res    = await fetch("/api/register", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(data),
        });
        const result = await res.json();

        showToast(result.message, result.type || (res.ok ? "success" : "error"));

        if (result.redirect) {
            setTimeout(() => window.location.href = result.redirect, result.delay || 3000);
        }
    } catch (err) {
        showToast("Failed to submit. Please try again.", "error");
        console.error(err);
    }
});
