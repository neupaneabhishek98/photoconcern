// Animated toast — white card + colored left border + animated tick icon.
function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

  const iconPath =
    type === "success"
      ? `<path d="M5 13l4 4L19 7"/>`
      : type === "error"
      ? `<path d="M6 18L18 6M6 6l12 12"/>`
      : `<path d="M12 8v5M12 16h.01"/>`;

  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24">${iconPath}</svg>
    </div>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// Login form submission
document.querySelector(".auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const btn = e.target.querySelector(".auth-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Signing in..."; }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      window.location.href = result.redirect || "/";
    } else {
      showToast(result.message || "Login failed. Please try again.", "error", 4000);
      if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
    }
  } catch (err) {
    showToast("Network error. Please try again.", "error", 4000);
    if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
    console.error(err);
  }
});
