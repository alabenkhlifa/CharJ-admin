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
const KORBA = "c1000000-0000-4000-8000-000000000001";
const SOUSSE = "c1000000-0000-4000-8000-000000000002";
const governorates = [
  { code: "TN-21", name_fr: "Nabeul", name_ar: "نابل", name_en: "Nabeul" },
  { code: "TN-51", name_fr: "Sousse", name_ar: "سوسة", name_en: "Sousse" },
];
let cities = [
  { id: KORBA, slug: "korba", governorate_code: "TN-21", name_fr: "Korba", name_ar: "قربة", name_en: "Korba" },
  { id: SOUSSE, slug: "sousse", governorate_code: "TN-51", name_fr: "Sousse", name_ar: "سوسة", name_en: "Sousse" },
];
// search_chargers joins the city and governorate names onto each row.
const readerRow = (c) => {
  const city = cities.find((v) => v.id === c.city_id);
  const gov = governorates.find((g) => g.code === city?.governorate_code);
  return {
    ...c,
    city_fr: city?.name_fr ?? null,
    city_ar: city?.name_ar ?? null,
    city_en: city?.name_en ?? null,
    governorate_code: gov?.code ?? null,
    governorate_fr: gov?.name_fr ?? null,
    governorate_ar: gov?.name_ar ?? null,
    governorate_en: gov?.name_en ?? null,
  };
};
let charger = {
  id: "ee625f21-1111-4444-8888-111111111111",
  name: "Africa Jade Thalasso Hôtel Korba",
  name_ar: "",
  name_fr: "Africa Jade",
  latitude: 36.5597,
  longitude: 10.8577,
  address: "Korba",
  address_ar: "",
  city_id: null,
  highway_direction: null,
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
  // A stored, far-from-expiry Supabase session gets past the sign-in gate
  // without any Auth round trip (supabase-js reads it from localStorage).
  await context.addInitScript(() =>
    localStorage.setItem(
      "charj-admin-auth",
      JSON.stringify({
        access_token: "test.admin.session",
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: 4102444800,
        user: {
          id: "a0000000-0000-4000-8000-000000000001",
          email: "admin@charj.test",
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
    ),
  );
  // Never let the suite reach the real Auth server.
  await context.route("**/auth/v1/**", (route) => route.abort());
  let writes = [],
    conflict = false;
  const cityWrites = [],
    chargerInserts = [];
  // Pins north of 36.5 sit near Korba; everything here is in Nabeul unless
  // it is south of 36 (Sousse).
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const lat = request.postDataJSON()?.p_lat;
    const json = url.pathname.endsWith("/rpc/search_chargers")
      ? [readerRow(charger)]
      : url.pathname.endsWith("/governorates")
        ? governorates
        : url.pathname.endsWith("/cities")
          ? cities
          : url.pathname.endsWith("/rpc/governorate_for_point")
            ? lat < 36
              ? "TN-51"
              : "TN-21"
            : url.pathname.endsWith("/rpc/suggest_city")
              ? lat > 36.5
                ? KORBA
                : null
              : [];
    await route.fulfill({ json, headers: { "content-range": "0-0/1" } });
  });
  await context.route("**/functions/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (route.request().url().includes("admin-cities")) {
      const body = route.request().postDataJSON();
      cityWrites.push(body);
      const { lat: _lat, lng: _lng, ...row } = body;
      const created = { id: "c1000000-0000-4000-8000-000000000003", ...row };
      cities = [...cities, created];
      return route.fulfill({ status: 201, json: created });
    }
    if (route.request().url().includes("admin-add-charger")) {
      chargerInserts.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { id: "new-charger", name: "Yasmine test" } });
    }
    if (!route.request().url().includes("admin-update-charger"))
      return route.fulfill({ json: {} });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    // adminFetch sends the signed-in session, never a bundled secret.
    assert.equal(
      route.request().headers().authorization,
      "Bearer test.admin.session",
    );
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
  // An unlinked charger shows its legacy text, flagged for cleanup.
  const row = page.getByRole("button", { name: `Open ${charger.name}` });
  assert.match(await row.locator("td").nth(1).innerText(), /^Nabeul\s*no city$/);
  await page.getByText(charger.name, { exact: true }).click();
  await page.getByRole("button", { name: "Edit charger", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Display name", { exact: true }).waitFor();
  // Opening never changes the city; the pin's nearest city is only offered.
  await dialog.getByText("Suggested from the pin: Korba, Nabeul", { exact: true }).waitFor();
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
  // Hand-pick a city in another governorate: the pin mismatch is flagged.
  const cityInput = dialog.getByRole("combobox", { name: "City", exact: true });
  await cityInput.click();
  await cityInput.fill("sous");
  await dialog.getByRole("option", { name: /^Sousse/ }).waitFor();
  assert.equal(await dialog.getByRole("option", { name: /^Korba/ }).count(), 0);
  await cityInput.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/editor-city-list-1440.png` });
  await cityInput.press("Enter");
  assert.equal(await cityInput.inputValue(), "Sousse");
  await dialog
    .getByText("The pin is in Nabeul, but Sousse is in Sousse.", { exact: true })
    .waitFor();
  await page.screenshot({ path: `${output}/editor-city-mismatch-1440.png` });
  // The open list fits a phone, and Escape closes the list, not the editor.
  await page.setViewportSize({ width: 375, height: 1000 });
  await cityInput.click();
  await dialog.getByRole("listbox", { name: "Cities" }).waitFor();
  await dialog.getByRole("listbox", { name: "Cities" }).scrollIntoViewIfNeeded();
  assert.ok(
    await dialog
      .locator(".charger-editor-body")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  );
  await page.screenshot({ path: `${output}/editor-city-list-375.png` });
  await cityInput.press("Escape");
  assert.equal(await dialog.getByRole("listbox", { name: "Cities" }).count(), 0);
  assert.equal(await cityInput.inputValue(), "Sousse");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByLabel("Latitude", { exact: true }).fill("36.5598");
  // Moving the pin never overrides a hand-picked city.
  await page.waitForTimeout(900);
  assert.equal(await cityInput.inputValue(), "Sousse");
  await dialog.getByRole("button", { name: "Clear city", exact: true }).click();
  await dialog.getByRole("button", { name: "Use", exact: true }).click();
  assert.equal(await cityInput.inputValue(), "Korba, Nabeul");
  assert.equal(
    await dialog.getByText("The pin is in Nabeul", { exact: false }).count(),
    0,
  );
  await dialog
    .getByLabel("Address (Arabic)", { exact: true })
    .fill("  طريق قربة ");
  await dialog
    .getByLabel("Highway direction", { exact: true })
    .selectOption("south");
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
  assert.equal(writes[0].changes.city_id, KORBA);
  assert.equal(writes[0].changes.address_ar, "طريق قربة");
  assert.equal(writes[0].changes.highway_direction, "south");
  assert.equal("city" in writes[0].changes, false);
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
  // Detail panel and table read the structured place after the refetch.
  await page.getByText("Korba · قربة", { exact: false }).waitFor();
  await page.keyboard.press("Escape");
  await row.locator("td").nth(1).getByText("Korba, Nabeul", { exact: true }).waitFor();

  // ── Add charger: no default city, add a missing city inline ─────────────
  await page.getByRole("button", { name: "Add charger", exact: true }).click();
  const modal = page.getByRole("dialog");
  const modalCity = modal.getByRole("combobox", { name: "City", exact: true });
  assert.equal(await modalCity.inputValue(), "");
  await modal.getByLabel("Name (display)", { exact: true }).fill("Yasmine test");
  await modal.getByLabel("Name (Arabic)", { exact: true }).fill("اختبار");
  await modal
    .getByPlaceholder("36.84, 10.27 — or paste a maps URL", { exact: true })
    .fill("36.40, 10.61");
  // No known city near this pin: nothing is auto-picked.
  await page.waitForTimeout(900);
  assert.equal(await modalCity.inputValue(), "");
  await modal.getByRole("button", { name: "Create charger", exact: true }).click();
  await modal.getByText("Choose a city, or add it if it's missing", { exact: true }).waitFor();
  await modalCity.click();
  await modalCity.fill("Yasmine");
  await modal.getByRole("option", { name: "Add city “Yasmine”", exact: true }).waitFor();
  await modalCity.press("Enter");
  assert.equal(await modal.getByLabel("City slug", { exact: true }).inputValue(), "yasmine");
  assert.equal(await modal.getByLabel("City name (English)", { exact: true }).inputValue(), "Yasmine");
  assert.equal(await modal.getByLabel("City governorate", { exact: true }).inputValue(), "TN-21");
  await modal.getByText("From the charger pin", { exact: true }).waitFor();
  await modal.getByLabel("City name (French)", { exact: true }).fill("Yasmine Hammamet");
  assert.equal(await modal.getByLabel("City slug", { exact: true }).inputValue(), "yasmine-hammamet");
  await modal.getByLabel("City name (Arabic)", { exact: true }).fill("ياسمين الحمامات");
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    const [scroll, client] = await modal.evaluate((el) => [el.scrollWidth, el.clientWidth]);
    assert.ok(scroll <= client + 1, `add modal overflows at ${width}px: ${scroll}/${client}`);
    await page.screenshot({ path: `${output}/add-city-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await modal.getByRole("button", { name: "Add city", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[role="combobox"]')?.value === "Yasmine Hammamet, Nabeul",
  );
  assert.deepEqual(cityWrites, [
    {
      slug: "yasmine-hammamet",
      governorate_code: "TN-21",
      name_fr: "Yasmine Hammamet",
      name_ar: "ياسمين الحمامات",
      name_en: "Yasmine Hammamet",
      lat: 36.4,
      lng: 10.61,
    },
  ]);
  await modal.getByLabel("Address (optional)", { exact: true }).fill("Avenue de la Paix");
  await modal.getByLabel("Address in Arabic (optional)", { exact: true }).fill("شارع السلام");
  await modal.getByRole("button", { name: "Create charger", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(chargerInserts.length, 1);
  assert.equal(chargerInserts[0].city_id, "c1000000-0000-4000-8000-000000000003");
  assert.equal(chargerInserts[0].city, "Yasmine Hammamet, Nabeul");
  assert.equal(chargerInserts[0].address, "Avenue de la Paix");
  assert.equal(chargerInserts[0].address_ar, "شارع السلام");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: editor opens, 375/768/1440 layouts, structured fields, city picker (suggestion, mismatch, no override), patch save, read-back, unsaved guard, conflict preservation, reload, keyboard focus, add charger with inline add-city and no page errors.",
  );
} finally {
  await browser.close();
}
