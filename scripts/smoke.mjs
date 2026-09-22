const base = (process.env.BASE_URL || "https://ff.adeticket.com").replace(/\/$/, "");
const checks = ["/api/health", "/api/config", "/cast", "/ads.txt"];
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);
try {
  for (const path of checks) {
    const response = await fetch(base + path, { signal: controller.signal });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    console.log(`ok ${path} (${response.status})`);
  }
} finally {
  clearTimeout(timeout);
}
