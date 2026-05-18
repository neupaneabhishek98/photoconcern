// Show toast function (reuse your register one)
function showToast(message, type = "info", duration = 3000) {
  const toast = document.createElement("div");
  toast.innerText = message;
  toast.className = `toast ${type}`;
  toast.style = `
    margin-top: 10px;
    padding: 10px 20px;
    border-radius: 5px;
    color: white;
    background-color: ${type === "success" ? "green" : type === "error" ? "red" : "blue"};
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.getElementById("toast-container").appendChild(toast);

  setTimeout(() => toast.style.opacity = 1, 50);

  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => toast.remove(), 300);
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
