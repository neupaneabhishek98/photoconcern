# Frontend Documentation — PhotoConcern

## What is this?

PhotoConcern's frontend is plain HTML, CSS, and vanilla JavaScript — no framework, no build step. Every page is a static HTML file served directly by Express. JavaScript files handle all the interactivity, API calls, and dynamic rendering.

---

## Stack

| What | Technology |
|------|-----------|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Scripting | Vanilla JavaScript (ES2020+) |
| Fonts | Google Fonts — Manrope, Poppins |
| ZIP downloads | JSZip 3.10.1 (CDN, admin only) |
| Icons | Inline SVG |

No npm packages on the frontend. No React, Vue, or Angular.

---

## Pages and What They Do

### Home (`index.html` + `index.js`)
The main storefront. Loads products from `/api/products` (a JSON file), renders product cards with "Add to Cart" and "Buy Now" buttons. Has a hero banner with an image carousel. Theme toggle (dark/light) stored in localStorage.

### Cart (`cart.html` + `cart.js`)
Shows the user's cart fetched from the DB. Items can be selected with checkboxes, quantities adjusted, items moved to wishlist or deleted. The checkout popup opens when "Proceed to Checkout" is clicked — it shows order summary, editable delivery address, and payment method selection. On confirm, the order is saved to DB and the user is redirected to the upload page.

### Wishlist (`wishlist.html` + `wishlist.js`)
Fetches wishlist items from DB. Each item can be added to cart (moves it) or removed. Uses toast notifications instead of alerts.

### Profile (`profile.html` + `profile.js`)
Shows user info fetched from DB. Fields are directly editable by clicking on them. A floating save bar appears when changes are made. Delivery address uses cascading dropdowns loaded from a Nepal address JSON. Account type switching opens a popup that verifies the current password, collects new role details, deletes the old account, and creates a new one.

### Orders (`orders.html` + `orders.js`)
Fetches the user's order history from DB. Shows order ID (in Nepali BS year format), status, items, delivery address, total, and payment method.

### Checkout Upload (`checkout_upload.html` + `checkout_upload.js`)
After placing an order, the user lands here to upload custom design photos. Multiple images can be selected at once. Photos are uploaded to Cloudflare R2 via the backend. If the user cancels or navigates away, the order is automatically cancelled in DB and a WhatsApp notification is sent to the admin.

### Payment Success / Fail
Success page fetches real order data from DB using the `?orderId=` URL param and shows order number, date, estimated delivery, total, and payment method. Fail page shows cancellation details.

### Admin Dashboard (`admin_dashboard.html` + `admin_dashboard.js`)
Protected — redirects to `/login/admin` if not authenticated. Has four tabs:
- **Active Orders** — processing orders, click any row to see full details in a popup, mark as delivered
- **Order History** — all orders with category and status filters
- **Users** — all registered users
- **Messages** — contact form submissions

On mobile, the sidebar is replaced by a bottom navigation bar.

### Admin Login (`login_admin.html` + `login_admin.js`)
Simple form that POSTs to `/api/admin/login`. Shows inline error messages.

---

## Shared Scripts

### `logout.js`
Loaded on every page. Provides the `logout()` function that POSTs to `/api/logout` and redirects to `/login`. Also injects styles for the logout button and the login button shown when not authenticated.

### `navbar.js`
Loaded on every page. Silently checks `/api/profile` on load. If the user is not logged in (401 response), the profile icon in the navbar is replaced with a visible "Login" button that links to `/login`.

---

## How API Calls Work

Every page that needs auth uses an `apiFetch()` wrapper function. It adds `credentials: "include"` to every request (so the session cookie is sent) and automatically redirects to `/login` if the server returns a 401.

```js
async function apiFetch(url, options = {}) {
    const res = await fetch(url, { credentials: "include", ...options });
    if (res.status === 401) {
        window.location.href = "/login";
        throw new Error("Unauthenticated");
    }
    return res;
}
```

---

## Theme System

Dark/light mode is toggled by adding/removing the `theme-dark` class on `<body>`. The preference is saved in `localStorage`. Every CSS file has a `body.theme-dark` section that overrides colors.

---

## Products Data

All product data lives in `/public/resources/products.json`. Each product has a `category` field (`custom`, `sports`, `events`, `office`) used for filtering in the admin dashboard and category pages. The home page and category pages both load from this file.

---

## Delivery Address

Nepal's province → district → municipality data is loaded from `/public/resources/nepal-address.json`. The dropdowns cascade — selecting a province populates districts, selecting a district populates municipalities.

---

## Order ID Format

Orders use a Nepali Bikram Sambat (BS) year-based ID: `2082-0`, `2082-1`, `2082-2`, and so on. The year increments automatically when the new BS year starts (around mid-April).

---

## File Upload Flow

1. User selects images on the checkout upload page (images only, validated client-side and server-side)
2. Files are sent as `multipart/form-data` to `POST /api/orders/:id/upload-designs`
3. Backend uploads to Cloudflare R2 and returns public URLs
4. URLs are saved to the order in MongoDB
5. Admin can view and download all design images from the order detail popup in the dashboard (downloaded as a ZIP)

---

## Image Ratios

All product images across every page use the same **4:3 ratio** for thumbnails and **1:1 ratio** for square card thumbs. Upload images at the correct ratio to avoid cropping or distortion.

### Standard Ratios

| Context | Ratio | CSS Rule | Notes |
|---------|-------|----------|-------|
| Product card thumb (home, category, wishlist) | **1:1** | `aspect-ratio: 1 / 1` + `object-fit: cover` | Square. Use 800×800px minimum |
| Hero slider image | **4:3** | `max-width: 400px; height: 340px` + `object-fit: contain` | Shown full without cropping |
| Cart item thumbnail | **1:1** | `60×60px` fixed + `object-fit: cover` | Small square preview |
| Order item thumbnail | **1:1** | `50×50px` fixed + `object-fit: cover` | Small square preview |
| Checkout upload preview | **1:1** | `aspect-ratio: 1` + `object-fit: cover` | User-uploaded design file |
| Admin order popup image | **1:1** | `80×80px` fixed + `object-fit: cover` | Design file preview |

### Recommended Upload Sizes

| Image Type | Recommended Size | Format |
|------------|-----------------|--------|
| Product photo | 800×800px | `.webp` or `.jpg` |
| Hero banner image | 800×600px | `.webp` or `.jpg` |
| Custom design upload | Any — shown as preview | `.jpg`, `.png`, `.webp` |

### How It Works in CSS

Product card thumbs use a CSS custom property so the ratio can be changed globally:

```css
.products,
.products2 {
  --product-thumb-aspect: 1 / 1;
}

.product-card-thumb {
  aspect-ratio: var(--product-thumb-aspect, 1 / 1);
  object-fit: cover;
}
```

To change all product card images to 4:3 sitewide, just update the variable:

```css
.products, .products2 { --product-thumb-aspect: 4 / 3; }
```
