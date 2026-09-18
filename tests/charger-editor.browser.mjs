// Run with a local Vite server and Playwright available via PLAYWRIGHT_MODULE.
// All Supabase traffic is intercepted; this suite never writes production data.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const output =
  process.env.CHARGER_EDITOR_ARTIFACTS || "/tmp/charj-editor-browser";
await mkdir(output, { recursive: true });
let charger = {
  id: "ee625f21-1111-4444-8888-111111111111",
  name: "Africa Jade Thalasso Hôtel Korba",
  name_ar: "",
  name_fr: "Africa Jade",
  latitude: 36.5597,
  longitude: 10.8577,
  address: "Korba",
  city: "Nabeul",
  operator: "Hotel",
  status: "operational",
  source: "ocm",
  ocm_id: 312495,
  access_type: "customers_only",
  connectors: [{ type: "Type 2", power_kw: 11, count: 1, voltage: 230 }],
  working_hours: null,
  exclusive_to: [],
  amenities: [],
  photos: [],
  contact_id: null,
  contact_phone: null,
  is_verified: true,
  verified_by: "ala",
  verified_at: "2026-09-17T12:00:00Z",
  manual_overrides: { status: "operational" },
  created_at: "2026-04-01T12:00:00Z",
  updated_at: "2026-09-18T08:00:00.123456Z",
};
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("charj-admin:auth", "1"),
  );
  let writes = [],
    conflict = false;
  await context.route("**/rest/v1/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("search_chargers") ? [charger] : [],
      headers: { "content-range": "0-0/1" },
    }),
  );
  await context.route("**/functions/v1/**", async (route) => {
    if (!route.request().url().includes("admin-update-charger"))
      return route.fulfill({ json: {} });
    if (route.request().method() === "GET")
      return route.fulfill({ json: charger });
    const body = route.request().postDataJSON();
    writes.push(body);
    if (conflict)
      return route.fulfill({
        status: 409,
        json: {
          error:
            "This charger changed since you opened it. Reload before saving.",
        },
      });
    assert.equal(body.expected_updated_at, charger.updated_at);
    charger = {
      ...charger,
      ...body.changes,
      updated_at: "2026-09-18T09:00:00Z",
    };
    if (body.changes.location) {
      charger.latitude = body.changes.location.lat;
      charger.longitude = body.changes.location.lng;
    }
    await route.fulfill({ json: charger });
  });
  // Avoid external map assets in this isolated form test.
  await context.route("https://maps.googleapis.com/**", (route) =>
    route.abort(),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${process.env.CHARGER_EDITOR_URL || "http://127.0.0.1:5175"}/#/chargers`,
  );
  await page.getByText(charger.name, { exact: true }).click();
  await page.getByRole("button", { name: "Edit charger", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Display name", { exact: true }).waitFor();
  assert.equal(
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .isDisabled(),
    true,
  );
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() =>
      Promise.all(
        document.getAnimations().map((animation) => animation.finished),
      ),
    );
    const sizing = await page.evaluate(() => {
      const main = document.querySelector("main"),
        dialog = document.querySelector(".charger-editor"),
        body = document.querySelector(".charger-editor-body");
      return {
        main: [main.scrollWidth, main.clientWidth],
        dialog: [dialog.scrollWidth, dialog.clientWidth],
        body: [body.scrollWidth, body.clientWidth],
      };
    });
    for (const [name, [scroll, client]] of Object.entries(sizing))
      assert.ok(
        scroll <= client + 1,
        `${name} overflows at ${width}px: ${scroll}/${client}`,
      );
    await page.screenshot({ path: `${output}/editor-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel("Arabic name", { exact: true }).fill("أفريكا جاد");
  await dialog.getByLabel("Latitude", { exact: true }).fill("36.5598");
  await dialog.getByLabel("Status", { exact: true }).selectOption("planned");
  await dialog
    .getByRole("button", { name: "Add connector", exact: true })
    .click();
  await dialog.getByLabel("Connector 2 type", { exact: true }).fill("CCS");
  await dialog.getByLabel("Connector 2 power (kW)", { exact: true }).fill("50");
  await dialog.getByLabel("Connector 2 count", { exact: true }).fill("2");
  await dialog
    .getByLabel("Access type", { exact: true })
    .selectOption("brand_exclusive");
  await dialog.getByRole("button", { name: "Add brand", exact: true }).click();
  await dialog.getByLabel("Allowed brand 1", { exact: true }).fill("BYD");
  await dialog
    .getByLabel("Working hours mode", { exact: true })
    .selectOption("weekly");
  await dialog
    .getByLabel("mon availability", { exact: true })
    .selectOption("open");
  await dialog.getByLabel("mon end 1", { exact: true }).fill("12:00");
  await dialog
    .getByRole("button", { name: "Add mon period", exact: true })
    .click();
  await dialog.getByLabel("mon start 2", { exact: true }).fill("14:00");
  await dialog.getByLabel("mon end 2", { exact: true }).fill("24:00");
  await dialog
    .getByRole("button", { name: "Copy Monday to weekdays", exact: true })
    .click();
  await dialog
    .getByLabel("sun availability", { exact: true })
    .selectOption("closed");
  await page.setViewportSize({ width: 375, height: 1000 });
  await dialog.getByRole("link", { name: "Hours", exact: true }).click();
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector("#edit-hours").getBoundingClientRect().top -
          document.querySelector(".charger-editor-body").getBoundingClientRect()
            .top -
          12,
      ) < 2,
  );
  assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth));
  assert.ok(
    await dialog
      .locator(".charger-editor-body")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  await page.screenshot({ path: `${output}/editor-hours-375.png` });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "light"),
  );
  await page.screenshot({ path: `${output}/editor-hours-light-375.png` });
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel("Wi-Fi", { exact: true }).check();
  await dialog.getByRole("button", { name: "Add photo", exact: true }).click();
  await dialog
    .getByLabel("Photo URL 1", { exact: true })
    .fill("https://example.com/charger.jpg");
  await dialog
    .getByLabel("Contact phone", { exact: true })
    .fill("+216 12345678");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await page.getByText("Charger changes saved.", { exact: true }).waitFor();
  assert.equal(writes.length, 1);
  assert.equal(charger.connectors[0].voltage, 230);
  assert.deepEqual(charger.connectors[1], {
    type: "CCS",
    power_kw: 50,
    count: 2,
  });
  assert.equal(charger.working_hours.weekly.mon.length, 2);
  assert.deepEqual(
    charger.working_hours.weekly.fri,
    charger.working_hours.weekly.mon,
  );
  assert.equal("sat" in charger.working_hours.weekly, false);
  assert.deepEqual(charger.working_hours.weekly.sun, []);
  assert.equal("verified_at" in writes[0].changes, false);
  assert.equal("name" in writes[0].changes, false);
  assert.equal(charger.contact_phone, "+216 12345678");
  await page.getByRole("button", { name: "Edit charger", exact: true }).click();
  assert.equal(
    await dialog
      .getByLabel("Connector 2 power (kW)", { exact: true })
      .inputValue(),
    "50",
  );
  await dialog.getByLabel("Display name", { exact: true }).fill("Unsaved name");
  await page.keyboard.press("Escape");
  await dialog.getByText("Discard unsaved changes?", { exact: true }).waitFor();
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  assert.equal(
    await dialog.getByLabel("Display name", { exact: true }).inputValue(),
    "Unsaved name",
  );
  conflict = true;
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await dialog
    .getByText(
      "This charger changed since you opened it. Reload before saving.",
      { exact: false },
    )
    .waitFor();
  assert.equal(
    await dialog.getByLabel("Display name", { exact: true }).inputValue(),
    "Unsaved name",
  );
  await dialog
    .getByRole("button", { name: "Reload latest details…", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Discard & reload", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector(".charger-editor-save-row")
      ?.textContent?.includes("No changes yet"),
  );
  assert.equal(
    await dialog.getByLabel("Display name", { exact: true }).inputValue(),
    charger.name,
  );
  await dialog
    .getByRole("button", { name: "Close charger editor", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Cancel",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Edit charger", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: editor opens, 375/768/1440 layouts, structured fields, patch save, read-back, unsaved guard, conflict preservation, reload, keyboard focus and no page errors.",
  );
} finally {
  await browser.close();
}
