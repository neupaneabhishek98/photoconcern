(function setupGoogleAuth() {
  const button = document.getElementById("googleSignInBtn");
  if (!button) return;

  const originalHtml = button.innerHTML;
  let clientId = "";
  let initialized = false;
  let rendered = false;

  function toast(message, type = "info", duration = 3500) {
    if (typeof window.showToast === "function") {
      window.showToast(message, type, duration);
      return;
    }
    alert(message);
  }

  function setLoading(isLoading) {
    button.disabled = isLoading;
    button.innerHTML = isLoading ? "Signing in..." : originalHtml;
  }

  async function submitCredential(credential) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ credential }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.message || "Google sign-in failed.");
      }

      toast(body.message || "Signed in with Google.", "success", 1800);
      setTimeout(() => {
        window.location.href = body.redirect || "/";
      }, body.delay || 700);
    } catch (err) {
      console.error("[google-auth]", err);
      toast(err.message || "Google sign-in failed. Please try again.", "error", 4500);
      setLoading(false);
    }
  }

  function initializeGoogle() {
    if (initialized) return true;
    if (!clientId || !window.google?.accounts?.id) return false;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response?.credential) {
          toast("Google sign-in was cancelled.", "info", 2500);
          return;
        }
        submitCredential(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    initialized = true;
    renderGoogleButton();
    return true;
  }

  function renderGoogleButton() {
    if (rendered || !window.google?.accounts?.id?.renderButton) return;

    const container = document.createElement("div");
    container.className = "google-rendered-btn";
    container.style.width = "100%";
    button.insertAdjacentElement("afterend", container);

    try {
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.max(button.offsetWidth || 0, 240),
      });
      button.style.display = "none";
      rendered = true;
    } catch (err) {
      console.error("[google-auth] render button", err);
      container.remove();
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/auth/google/config", { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.clientId) {
        throw new Error(body.message || "Google sign-in is not configured on this server yet.");
      }
      clientId = body.clientId;
      let tries = 0;
      const timer = setInterval(() => {
        if (initializeGoogle()) {
          clearInterval(timer);
          return;
        }
        if (++tries > 40) {
          clearInterval(timer);
          button.dataset.googleAuthError = "Google sign-in could not load. Check that accounts.google.com is not blocked and refresh the page.";
        }
      }, 100);
    } catch (err) {
      console.warn("[google-auth] config", err);
      button.dataset.googleAuthError = err.message;
    }
  }

  button.addEventListener("click", () => {
    if (button.dataset.googleAuthError) {
      toast(button.dataset.googleAuthError, "error", 5000);
      return;
    }

    if (!initializeGoogle()) {
      toast("Google sign-in is still loading. Please try again in a moment.", "info", 2500);
      return;
    }

    window.google.accounts.id.prompt((notification) => {
      const notDisplayed = typeof notification?.isNotDisplayed === "function" && notification.isNotDisplayed();
      const skipped = typeof notification?.isSkippedMoment === "function" && notification.isSkippedMoment();
      if (notDisplayed || skipped) {
        toast("Use the Google button above. If it still fails, make sure this Render URL is added to Authorized JavaScript origins in Google Cloud.", "error", 6000);
      }
    });
  });

  loadConfig();
})();
