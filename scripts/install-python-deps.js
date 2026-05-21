/**
 * Postinstall hook — install Python deps for the passport photo tool.
 *
 * Tries `python3 -m pip install -r requirements.txt` first, then `python`.
 * Failure is non-fatal: the server still boots, only /api/tools/passport
 * will return a clear "Python not installed" error to the client.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REQS = path.resolve(__dirname, "..", "requirements.txt");
if (!fs.existsSync(REQS)) {
  console.log("[install-python-deps] requirements.txt not found, skipping.");
  process.exit(0);
}

// Skip on local dev when SKIP_PIP=1, useful if you manage venvs manually.
if (process.env.SKIP_PIP === "1") {
  console.log("[install-python-deps] SKIP_PIP=1 set, skipping.");
  process.exit(0);
}

function tryInstall(bin) {
  console.log(`[install-python-deps] trying: ${bin} -m pip install -r requirements.txt`);
  const res = spawnSync(bin, ["-m", "pip", "install", "--user", "--quiet", "-r", REQS], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return res.status === 0;
}

const candidates = ["python3", "python"];
let installed = false;
for (const bin of candidates) {
  if (tryInstall(bin)) {
    console.log(`[install-python-deps] ✓ Python deps installed via ${bin}`);
    installed = true;
    break;
  }
}

if (!installed) {
  console.warn(
    "[install-python-deps] ⚠ Could not install Python deps automatically.\n" +
    "  The site will still run, but /serve/tools/passport will return an error\n" +
    "  until the host has python + opencv-python-headless + numpy installed."
  );
}

// Never fail the npm install — let the Node server boot regardless.
process.exit(0);
