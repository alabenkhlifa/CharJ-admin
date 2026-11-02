import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { OFFLINE_MESSAGE, sessionToken } from "../src/lib/session-token.ts";

// The errors are auth-js's own classes, as getSession hands them back.

test("sessionToken: a live session gives its access token", () => {
  assert.deepEqual(sessionToken({ data: { session: { access_token: "abc" } }, error: null }), { kind: "token", token: "abc" });
});

test("sessionToken: a refresh that can't reach the server keeps the session (offline, no sign-out)", () => {
  // fetch failed while offline: auth-js wraps it with status 0 and keeps the stored session.
  assert.deepEqual(sessionToken({ data: { session: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) }), { kind: "offline" });
  // A 5xx from the auth server is retryable too.
  assert.deepEqual(sessionToken({ data: { session: null }, error: new AuthRetryableFetchError("Service Unavailable", 503) }), { kind: "offline" });
  assert.equal(OFFLINE_MESSAGE, "Can't reach the server.");
});

test("sessionToken: no session, or the server refusing the refresh token, signs out", () => {
  assert.deepEqual(sessionToken({ data: { session: null }, error: null }), { kind: "signed-out" });
  const refused = new AuthApiError("Invalid Refresh Token: Refresh Token Not Found", 400, "refresh_token_not_found");
  assert.deepEqual(sessionToken({ data: { session: null }, error: refused }), { kind: "signed-out" });
  assert.deepEqual(sessionToken({ data: { session: null }, error: new AuthSessionMissingError() }), { kind: "signed-out" });
  // A session without a token is no session.
  assert.deepEqual(sessionToken({ data: { session: { access_token: "" } }, error: null }), { kind: "signed-out" });
});
