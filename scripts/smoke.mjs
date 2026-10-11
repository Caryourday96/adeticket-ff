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
  const origin = new URL(base).origin;
  const writeCheck = await fetch(base + "/api/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "deployment-origin-smoke-check" }),
    signal: controller.signal,
  });
  if (writeCheck.status === 403)
    throw new Error(`API rejected the deployed game origin ${origin}.`);
  if (writeCheck.status !== 401)
    throw new Error(`Expected invalid smoke login to return HTTP 401, got ${writeCheck.status}.`);
  console.log(`ok API write origin ${origin} (reached login validation)`);
  const bible = await fetch(base + "/bibleblitz/socket.io/?EIO=4&transport=polling", {
    headers: { Origin: "https://adeticket.com" },
    signal: controller.signal,
  });
  if (!bible.ok || bible.headers.get("access-control-allow-origin") !== "https://adeticket.com")
    throw new Error("Bible Blitz transport or portfolio CORS check failed.");
  if (!(await bible.text()).startsWith('0{"sid":'))
    throw new Error("Bible Blitz returned a page instead of an Engine.IO handshake.");
  console.log("ok Bible Blitz transport and portfolio origin");
} finally {
  clearTimeout(timeout);
}
