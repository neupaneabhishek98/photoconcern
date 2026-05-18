#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "_site");

const ROUTES = [
  ["/serve/checkout/upload", "./checkout_upload.html"],
  ["/serve/category/sports", "./category-sports.html"],
  ["/serve/category/events", "./category-events.html"],
  ["/serve/category/office", "./category-office.html"],
  ["/serve/category/custom", "./category-custom.html"],
  ["/serve/category/gifts", "./category-sports.html"],
  ["/serve/tools/passport", "./passport.html"],
  ["/serve/tools/retouch", "#"],
  ["/serve/tools/mrp", "#"],
  ["/serve/contact", "./contact.html"],
  ["/serve/wishlist", "./wishlist.html"],
  ["/serve/profile", "./profile.html"],
  ["/serve/cart", "./cart.html"],
  ["/forgot-password", "./forgot_password.html"],
  ["/payment-fail", "./payment_fail.html"],
  ["/admin/dashboard", "./admin_dashboard.html"],
  ["/admin/login", "./login_admin.html"],
  ["/login/admin", "./login_admin.html"],
  ["/success", "./payment_success.html"],
  ["/orders", "./orders.html"],
  ["/signup", "./signup.html"],
  ["/login", "./login.html"],
];

const STATIC_API_ROUTES = [
  ["/api/products", "./resources/products.json"],
  ["/api/nepal-data", "./resources/nepal-address.json"],
];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function replaceAll(content, from, to) {
  return content.split(from).join(to);
}

function rewriteForPages(content) {
  let output = content;

  output = output.replace(/(["'(=])\/(css|js|resources)\//g, "$1./$2/");
  output = output.replace(/href="\/"/g, 'href="./index.html"');
  output = output.replace(/href='\/'/g, "href='./index.html'");
  output = output.replace(/window\.location\.href\s*=\s*"\/"/g, 'window.location.href = "./index.html"');
  output = output.replace(/window\.location\.href\s*=\s*'\/'/g, "window.location.href = './index.html'");

  for (const [from, to] of [...ROUTES].sort((a, b) => b[0].length - a[0].length)) {
    output = replaceAll(output, from, to);
  }

  for (const [from, to] of STATIC_API_ROUTES) {
    output = replaceAll(output, from, to);
  }

  return output;
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

copyDir(PUBLIC_DIR, OUT_DIR);

const htmlDir = path.join(PUBLIC_DIR, "html");
for (const file of fs.readdirSync(htmlDir)) {
  if (file.endsWith(".html")) {
    fs.copyFileSync(path.join(htmlDir, file), path.join(OUT_DIR, file));
  }
}

fs.rmSync(path.join(OUT_DIR, "html"), { recursive: true, force: true });

for (const file of walk(OUT_DIR)) {
  if (!/\.(html|css|js|json)$/i.test(file)) continue;
  const original = fs.readFileSync(file, "utf8");
  const rewritten = rewriteForPages(original);
  if (rewritten !== original) fs.writeFileSync(file, rewritten);
}

fs.copyFileSync(path.join(OUT_DIR, "index.html"), path.join(OUT_DIR, "404.html"));
console.log(`GitHub Pages artifact built at ${OUT_DIR}`);
