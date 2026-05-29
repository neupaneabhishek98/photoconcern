# Backend Documentation — PhotoConcern

## What is this?

PhotoConcern's backend is a Node.js server that handles everything behind the scenes — user accounts, orders, cart, wishlist, delivery addresses, admin panel, file uploads, and WhatsApp notifications. It talks to a MongoDB database and a Cloudflare R2 bucket for storing images.

---

## Stack

| What | Technology | Version |
|------|-----------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express | 5.2.1 |
| Database | MongoDB (via Mongoose) | Mongoose 9.3.3 |
| Authentication | express-session + bcrypt | session 1.19.0 / bcrypt 6.0.0 |
| File uploads | Multer | 2.1.1 |
| Cloud storage | Cloudflare R2 (S3-compatible) | @aws-sdk/client-s3 3.x |
| WhatsApp | Twilio | 5.13.1 |
| Email | Nodemailer | 8.0.4 |
| Rate limiting | express-rate-limit | 8.3.2 |
| Environment | dotenv | 17.3.1 |

---

## Folder Structure

```
server.js              — entry point, registers all routes
routes/                — one file per feature
models/                — MongoDB schemas
middlewares/           — auth check, rate limiting
services/              — WhatsApp notification helper
config/                — Cloudflare R2 client setup
db/                    — MongoDB connection
```

---

## How Authentication Works

Sessions are used — no JWT tokens in cookies. When a user logs in, their MongoDB `_id` is stored in `req.session.userId`. Every protected route checks for that before doing anything. If it's missing, the server returns a `401` and the frontend redirects to `/login`.

Admin login works the same way but stores `req.session.adminId` instead.

Passwords are hashed with bcrypt (10 salt rounds) before saving. Plain text passwords are never stored.

---

## Routes Overview

### User Auth
- `POST /api/login` — checks email/password, creates session
- `POST /api/logout` — destroys session
- `POST /api/register` — creates new user (customer, studio, or freelancer)

### Profile
- `GET /api/profile` — returns logged-in user's data in a flat shape
- `PUT /api/profile` — updates profile fields
- `POST /api/profile/switch-role` — deletes current account, creates new one with different role, updates session

### Cart
- `GET /api/cart` — fetch cart items
- `POST /api/cart/add` — add item
- `PATCH /api/cart/item/:id/quantity` — update quantity
- `DELETE /api/cart/item/:id` — remove item
- `POST /api/cart/item/:id/wishlist` — move item to wishlist

### Wishlist
- `GET /api/wishlist`
- `POST /api/wishlist/add`
- `DELETE /api/wishlist/remove`
- `POST /api/wishlist/move-to-cart`

### Delivery Address
- `GET /api/address/fetch`
- `POST /api/address/save`

### Orders
- `POST /api/orders/place` — saves order to DB, sends WhatsApp to admin
- `POST /api/orders/:id/confirm` — marks order as processing, sends WhatsApp
- `POST /api/orders/:id/cancel` — marks cancelled, sends WhatsApp, sets 24h TTL for auto-delete
- `POST /api/orders/:id/upload-designs` — uploads design photos to Cloudflare R2
- `GET /api/orders` — user's order list
- `GET /api/orders/:id` — single order

### Admin
- `POST /api/admin/login` — admin session
- `POST /api/admin/logout`
- `GET /api/admin/orders` — all orders
- `GET /api/admin/orders/active` — processing orders only
- `PATCH /api/admin/orders/:id/deliver` — mark as delivered
- `GET /api/admin/users` — all users
- `GET /api/admin/contacts` — all contact form messages
- `GET /api/admin/proxy-image?url=` — proxies R2 images to avoid CORS on download

### Contact
- `POST /api/contact` — saves message, sends email to admin

---

## Database Models

### User
Stores customers, studios, and freelancers in one collection. Each role has its own set of fields (e.g. `studio_name`, `free_email`). The `role` field determines which fields are active.

### Order
Stores everything about an order — items, delivery address, totals, payment method, status, design image URLs. Has a `cancelledAt` TTL field that auto-deletes cancelled orders after 24 hours. Order IDs follow Nepali BS year format: `2082-0`, `2082-1`, etc.

### Cart / Wishlist / DeliveryAddress
Each linked to a user by `userId`. One document per user.

### Admin
Separate collection from users. Password is auto-hashed via a pre-save hook.

### Contact
Stores name, email, subject, and message from the contact form.

---

## File Uploads (Cloudflare R2)

When a user uploads design photos on the checkout page, the files go through Multer (stored in memory, never written to disk), then uploaded to Cloudflare R2 using the AWS S3-compatible SDK. The public URL is saved to `order.designImages[]` in MongoDB.

Only image files are accepted — validated both by Multer's `fileFilter` and a MIME type whitelist on the route.

---

## WhatsApp Notifications

Uses Twilio's WhatsApp API. Notifications are sent to the admin number when:
- A new order is placed
- An order is confirmed
- An order is cancelled

WhatsApp failures are caught silently — they never block the order from being saved.

Note: Twilio sandbox requires the recipient to opt in by sending a join message. For production use, a Twilio WhatsApp Business number is needed.

---

## Rate Limiting

Applied per route category to prevent abuse:

| Route type | Window | Max requests |
|-----------|--------|-------------|
| Login / Register / Logout | 15 min | 10 |
| Profile role switch | 15 min | 20 |
| Order placement | 1 hour | 30 |
| File uploads | 1 hour | 50 |
| Contact form | 1 hour | 10 |
| All other /api routes | 10 min | 200 |

---

## Environment Variables Needed

These must be set in your hosting environment (e.g. Render dashboard). Never commit real values to git.

```
atlas_url          — MongoDB connection string
SESSION_SECRET     — random secret for session encryption
EMAIL_USER         — Gmail address for contact form emails
EMAIL_PASS         — Gmail app password
TWILIO_ACCOUNT_SID — Twilio account SID
TWILIO_AUTH_TOKEN  — Twilio auth token
ADMIN_WHATSAPP     — WhatsApp number to receive order notifications
ENDPOINTS_URL      — Cloudflare R2 endpoint URL
Access_Key_ID      — R2 access key
SECRET_ACCESS_KEY  — R2 secret key
bucket_name        — R2 bucket name
R2_PUBLIC_URL      — Public URL of your R2 bucket
```
