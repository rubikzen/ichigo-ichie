const base = (process.env.SMOKE_BASE_URL || "https://www.ichigoichiematcha.fr").replace(/\/$/, "");
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

await check("homepage + canonical", async () => {
  const response = await fetch(`${base}/`);
  const html = await response.text();
  expect(response.ok, `HTTP ${response.status}`);
  expect(html.includes('rel="canonical"'), "canonical absent");
  expect(html.includes("application/ld+json"), "JSON-LD absent");
});

await check("robots.txt", async () => {
  const response = await fetch(`${base}/robots.txt`);
  const text = await response.text();
  expect(response.ok, `HTTP ${response.status}`);
  expect(text.includes("Disallow: /admin/"), "admin non protégé dans robots");
  expect(text.includes("Sitemap:"), "sitemap absent");
});

await check("sitemap.xml", async () => {
  const response = await fetch(`${base}/sitemap.xml`);
  const text = await response.text();
  expect(response.ok, `HTTP ${response.status}`);
  expect(text.includes(`${base}/`), "homepage absente du sitemap");
});

await check("admin noindex header", async () => {
  const response = await fetch(`${base}/admin`, { redirect: "manual" });
  const robots = response.headers.get("x-robots-tag") || "";
  expect(robots.includes("noindex"), `X-Robots-Tag inattendu: ${robots || "absent"}`);
});

await check("contact honeypot is harmless", async () => {
  const response = await fetch(`${base}/api/contact`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ website: "smoke-test-bot" }),
  });
  const data = await response.json().catch(() => ({}));
  expect(response.status === 200 && data.ok === true, `HTTP ${response.status}`);
});

await check("orders reject invalid payload", async () => {
  const response = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(response.status >= 400 && response.status < 500, `HTTP ${response.status}`);
});

await check("orders reject non-JSON", async () => {
  const response = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not-json",
  });
  expect(response.status === 415, `attendu 415, reçu ${response.status}`);
});

console.log(`\nSmoke: ${failures ? `${failures} échec(s)` : "PASS"}`);
process.exitCode = failures ? 1 : 0;
