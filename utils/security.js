const crypto = require("crypto");

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isInternalHost(hostname) {
  return BLOCKED_HOSTS.some((pattern) => pattern.test(hostname));
}

function isSafeUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (!/^https?:$/i.test(url.protocol)) {
      return false;
    }
    if (isInternalHost(url.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isSafeRedirectUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (isInternalHost(url.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeMoney(money) {
  const parsed = parseFloat(money);
  if (isNaN(parsed) || parsed <= 0 || parsed > 100000) {
    return null;
  }
  return parsed.toFixed(2);
}

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function verifyApiKey(providedKey, storedHash) {
  const providedHash = hashApiKey(providedKey);
  return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
}

module.exports = {
  isSafeUrl,
  isSafeRedirectUrl,
  escapeHtml,
  sanitizeMoney,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
};
