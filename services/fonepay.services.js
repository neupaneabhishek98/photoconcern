/**
 * Fonepay Dynamic QR service.
 *
 * Fonepay issues a per-transaction "dynamic QR" that the customer scans from
 * their bank/wallet app. Their exact contract is shared with merchants after
 * onboarding, so this file does two things:
 *
 *   - In TEST mode (FONEPAY_MODE=test), it builds a JSON QR payload that
 *     encodes the order id + amount and renders it as a PNG data-URL.
 *     Lets you wire up UI end-to-end before you have real credentials.
 *
 *   - In LIVE mode, it POSTs to FONEPAY_API_BASE with merchant
 *     code/username/password/secret and returns the qrMessage Fonepay returns.
 *     Adjust `requestLiveQr()` to match the exact endpoint Fonepay gives you.
 */

const crypto = require("crypto");
const QRCode = require("qrcode");

const MODE = (process.env.FONEPAY_MODE || "test").toLowerCase();

function makeReference(orderId) {
  return ("PC" + String(orderId) + crypto.randomBytes(2).toString("hex"))
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 25)
    .toUpperCase();
}

function signTestPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function requestTestQr(order) {
  const reference = makeReference(order._id || order.orderId);
  const payload = {
    mode: "TEST",
    merchant: "SHOPHUB",
    amount: order.total,
    currency: "NPR",
    orderId: order.orderId || order._id,
    reference,
    issuedAt: new Date().toISOString(),
  };
  payload.signature = signTestPayload(payload);

  const qrString = JSON.stringify(payload);
  const qrDataUrl = await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });

  return {
    mode: "test",
    reference,
    amount: order.total,
    qrString,
    qrDataUrl,
    expiresInSeconds: 600,
    note: "TEST QR. Replace with real Fonepay credentials and set FONEPAY_MODE=live.",
  };
}

async function requestLiveQr(order) {
  // TODO: After Fonepay onboarding, fill this in. Their typical flow:
  //   POST {FONEPAY_API_BASE}/api/merchantRequest
  //   Body: { merchantCode, username, password, amount, remarks1, prn, ... }
  //   HMAC-signed with FONEPAY_SECRET_KEY.
  //   Response.qrMessage -> render with QRCode.toDataURL().
  throw new Error(
    "FONEPAY_MODE=live is set but requestLiveQr() has not been implemented. " +
    "See services/fonepay.services.js comments."
  );
}

async function createDynamicQr(order) {
  if (MODE === "live") return requestLiveQr(order);
  return requestTestQr(order);
}

function verifyWebhook(body) {
  if (MODE === "live") {
    return { ok: false, error: "live verify not implemented" };
  }
  if (!body || !body.reference) {
    return { ok: false, error: "missing reference" };
  }
  return { ok: true, reference: body.reference, amount: body.amount };
}

module.exports = { createDynamicQr, verifyWebhook };
