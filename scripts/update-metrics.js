const fs = require("node:fs");
const admin = require("firebase-admin");

const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
if (!credentials.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");

admin.initializeApp({ credential: admin.credential.cert(credentials) });
const db = admin.firestore();
const onlineSince = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);
}

function badge(label, value, color) {
  const leftWidth = Math.max(78, label.length * 7 + 14);
  const rightWidth = Math.max(42, String(value).length * 8 + 16);
  const width = leftWidth + rightWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)"><rect width="${leftWidth}" height="20" fill="#555"/><rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/><rect width="${width}" height="20" fill="url(#s)"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text><text x="${leftWidth / 2}" y="14">${escapeXml(label)}</text><text x="${leftWidth + rightWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text><text x="${leftWidth + rightWidth / 2}" y="14">${escapeXml(value)}</text></g>
</svg>\n`;
}

async function main() {
  const [metrics, online] = await Promise.all([
    db.collection("app_metrics").doc("android_installs").get(),
    db.collection("app_installs").where("lastSeenAt", ">=", onlineSince).count().get()
  ]);
  const data = {
    online: online.data().count || 0,
    installs: metrics.get("totalInstalls") || 0,
    appDownloads: metrics.get("totalDownloads") || 0,
    updatedAt: new Date().toISOString()
  };
  fs.mkdirSync("badges", { recursive: true });
  fs.writeFileSync("badges/online.svg", badge("online now", data.online, "#2ea043"));
  fs.writeFileSync("badges/installs.svg", badge("total installs", data.installs, "#0969da"));
  fs.writeFileSync("metrics.json", `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
