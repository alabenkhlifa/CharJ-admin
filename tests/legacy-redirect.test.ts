import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyRedirect } from "../src/lib/legacy-redirect.ts";

// "route?query" as the hash would read, or null.
const redirect = (hash: string): string | null => {
  const at = hash.indexOf("?");
  const route = at === -1 ? hash : hash.slice(0, at);
  const params = new URLSearchParams(at === -1 ? "" : hash.slice(at + 1));
  const out = legacyRedirect(route, params);
  if (!out) return null;
  const query = out.params.toString();
  return `${out.route}${query ? `?${query}` : ""}`;
};

const TABLE: Array<[string, string | null]> = [
  ["overview", "summary"],
  ["analytics", "usage"],
  ["users?user=X", "usage?tab=users&user=X"],
  ["vehicles", "usage?tab=catalog"],
  ["map", "chargers?view=map"],
  ["submissions", "community?tab=submissions"],
  ["feedback", "community?tab=feedback"],
  ["reviews", "community?tab=reviews"],
  ["visits", "community?tab=visits"],
  ["chargers?id=1&status=operational", "chargers?id=1&status=operational"],
  ["notifications", "notifications"],
  ["summary", "summary"],
  ["usage?tab=users&user=X", "usage?tab=users&user=X"],
  ["community?tab=reviews", "community?tab=reviews"],
  ["settings", "settings"],
  ["nonsense", null],
  ["", null],
];

for (const [from, to] of TABLE) {
  test(`legacyRedirect ${from || "(empty)"} -> ${to}`, () => {
    assert.equal(redirect(from), to);
  });
}

test("legacy params are kept next to the new tab", () => {
  assert.equal(redirect("users"), "usage?tab=users");
  assert.equal(redirect("map?x=1"), "chargers?view=map&x=1");
});
