/**
 * Google Drive service — uploads customer design photos directly into the
 * business owner's Drive (photoconcern65@gmail.com) using a service account.
 *
 * Folder layout created automatically per upload:
 *   <DRIVE_ROOT_FOLDER_NAME>/<YYYY-MM-DD>/<Customer Name>/<photo files>
 * default DRIVE_ROOT_FOLDER_NAME = "Online Orders"
 *
 * SETUP (one-time):
 *   1. Create a Google Cloud project, enable the Drive API.
 *   2. Create a Service Account, download its JSON key file.
 *   3. Save the key file at  ./config/service-account.json  (gitignored).
 *   4. Log in to Drive as photoconcern65@gmail.com, create a folder called
 *      "Online Orders", and SHARE it (Editor access) with the service account
 *      email (looks like xxxx@xxxx.iam.gserviceaccount.com).
 *
 * The file exports uploadOrderFiles(customerName, files, opts) which accepts
 * multer file objects (with .buffer + .originalname + .mimetype) and returns
 * { folderId, folderName, files: [{ id, name, webViewLink, ... }] }.
 */

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { google } = require("googleapis");

const KEYFILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE || "./config/service-account.json";
const ROOT_FOLDER_NAME = process.env.DRIVE_ROOT_FOLDER_NAME || "Online Orders";

let driveClient = null;
let rootFolderIdCache = null;

function getDrive() {
  if (driveClient) return driveClient;
  const keyPath = path.resolve(KEYFILE);
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Service account keyfile not found at ${keyPath}. ` +
      `See services/drive.services.js header for setup.`
    );
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

async function findOrCreateFolder(name, parentId = null) {
  const drive = getDrive();
  const safeName = name.replace(/'/g, "\\'");
  const qParts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${safeName}'`,
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const list = await drive.files.list({
    q: qParts.join(" and "),
    fields: "files(id, name, parents)",
    pageSize: 10,
    spaces: "drive",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id;
  }
  const fileMeta = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) fileMeta.parents = [parentId];
  const created = await drive.files.create({
    requestBody: fileMeta,
    fields: "id",
    supportsAllDrives: true,
  });
  return created.data.id;
}

async function getRootFolderId() {
  if (rootFolderIdCache) return rootFolderIdCache;
  const drive = getDrive();
  const safeName = ROOT_FOLDER_NAME.replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${safeName}'`,
    fields: "files(id, name, owners)",
    pageSize: 10,
    spaces: "drive",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  if (!list.data.files || list.data.files.length === 0) {
    throw new Error(
      `Drive folder "${ROOT_FOLDER_NAME}" was not found. Log in as ` +
      `photoconcern65@gmail.com, create that folder, and share it (Editor) ` +
      `with the service account email.`
    );
  }
  rootFolderIdCache = list.data.files[0].id;
  return rootFolderIdCache;
}

function todayFolderName(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sanitizeName(name) {
  if (!name) return "Unknown Customer";
  return name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Unknown Customer";
}

function bufferToStream(buffer) {
  return Readable.from(buffer);
}

/**
 * Upload an array of multer file objects (memoryStorage) into the
 * "Online Orders / YYYY-MM-DD / <Customer> /" folder. Returns:
 *   { folderId, folderName, folderUrl, files: [{ id, name, webViewLink, mimeType }] }
 */
async function uploadOrderFiles(customerName, files, opts = {}) {
  if (!files || files.length === 0) {
    return { folderId: null, folderName: null, folderUrl: null, files: [] };
  }

  const drive = getDrive();
  const rootId = await getRootFolderId();
  const dateId = await findOrCreateFolder(todayFolderName(opts.date), rootId);
  const safeCustomer = sanitizeName(customerName);

  const customerFolderName = opts.orderId
    ? `${safeCustomer} - ${opts.orderId}`
    : safeCustomer;
  const customerId = await findOrCreateFolder(customerFolderName, dateId);

  const results = [];
  for (const f of files) {
    // multer memoryStorage gives us a Buffer in f.buffer.
    // multer diskStorage gives us f.path.
    let media;
    if (f.buffer) {
      media = { mimeType: f.mimetype, body: bufferToStream(f.buffer) };
    } else if (f.path) {
      media = { mimeType: f.mimetype, body: fs.createReadStream(f.path) };
    } else {
      throw new Error("file has neither .buffer nor .path");
    }
    const meta = {
      name: f.originalname || `upload-${Date.now()}`,
      parents: [customerId],
    };
    const resp = await drive.files.create({
      requestBody: meta,
      media,
      fields: "id, name, mimeType, webViewLink, webContentLink",
      supportsAllDrives: true,
    });
    results.push(resp.data);
    // cleanup disk temp file if any
    if (f.path) fs.unlink(f.path, () => {});
  }

  const folderUrl = `https://drive.google.com/drive/folders/${customerId}`;
  return { folderId: customerId, folderName: customerFolderName, folderUrl, files: results };
}

module.exports = {
  uploadOrderFiles,
  _internals: { findOrCreateFolder, getRootFolderId, todayFolderName, sanitizeName },
};
