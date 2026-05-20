// ============================================================
// theme.js — Shared theme utility for all pages
// Loaded on every page. Handles:
//   1. Flash prevention (applied before DOM renders via logout.js IIFE)
//   2. Theme toggle button (sun/moon icon + body class)
//   3. localStorage persistence
// ============================================================

const THEME_ICONS = {
  sun: `<svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>`,
  moon: `<svg class="menu-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`,
};

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else {
    document.body.classList.remove("theme-dark");
  }

  const iconContainer = document.querySelector(".theme-toggle .icon");
  if (iconContainer) {
    iconContainer.innerHTML = theme === "dark" ? THEME_ICONS.moon : THEME_ICONS.sun;
  }
}

function setupThemeToggle() {
  const themeButton = document.querySelector(".theme-toggle");
  if (!themeButton) return;

  const savedTheme = localStorage.getItem("theme") || "light";

  applyTheme(savedTheme);

  themeButton.addEventListener("click", (e) => {
    e.preventDefault();
    document.body.classList.toggle("theme-dark");
    const newTheme = document.body.classList.contains("theme-dark") ? "dark" : "light";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  });
}

document.addEventListener("DOMContentLoaded", setupThemeToggle);
