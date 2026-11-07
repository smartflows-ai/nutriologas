// Ticket #16 follow-up: when does a failed OAuth token refresh mean the connection is really gone?
// Only a revoked or expired refresh token ("invalid_grant") does. A busy provider or a bad server setting must not
// disconnect the customer's calendar. Run: npx tsx --test local-utils/oauth-refresh.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createRefreshCooldown, isPermanentRefreshFailure } from "../src/lib/oauth-refresh";

const googleRevoked = JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." });
const microsoftRevoked = JSON.stringify({
  error: "invalid_grant",
  error_description: "AADSTS70008: The provided authorization code or refresh token has expired.",
});

test("a revoked or expired refresh token is permanent, for Google and Microsoft", () => {
  assert.equal(isPermanentRefreshFailure(400, googleRevoked), true);
  assert.equal(isPermanentRefreshFailure(400, microsoftRevoked), true);
  assert.equal(isPermanentRefreshFailure(401, googleRevoked), true);
});

test("a busy or failing provider is temporary: rate limit and server errors keep the connection", () => {
  for (const status of [429, 500, 502, 503, 504]) {
    assert.equal(isPermanentRefreshFailure(status, "{}"), false, String(status));
    assert.equal(isPermanentRefreshFailure(status, googleRevoked), false, `${status} even with that body`);
  }
});

test("a wrong client setting on our side is not the customer's fault, so the connection stays", () => {
  assert.equal(isPermanentRefreshFailure(401, JSON.stringify({ error: "invalid_client" })), false);
  assert.equal(isPermanentRefreshFailure(400, JSON.stringify({ error: "invalid_request" })), false);
  assert.equal(isPermanentRefreshFailure(400, JSON.stringify({ error: "unauthorized_client" })), false);
});

test("a temporary-unavailable answer is not permanent", () => {
  assert.equal(isPermanentRefreshFailure(400, JSON.stringify({ error: "temporarily_unavailable" })), false);
});

test("an unreadable, empty or HTML body is never treated as permanent", () => {
  assert.equal(isPermanentRefreshFailure(400, ""), false);
  assert.equal(isPermanentRefreshFailure(400, "<html>Bad gateway</html>"), false);
  assert.equal(isPermanentRefreshFailure(400, "null"), false);
  assert.equal(isPermanentRefreshFailure(400, "[]"), false);
});

test("a success status is never a failure to decide on", () => {
  assert.equal(isPermanentRefreshFailure(200, googleRevoked), false);
});

// Errors that only the customer can fix by signing in again never heal by retrying, so they count as permanent too.
test("an answer that needs the customer to sign in or consent again is permanent", () => {
  for (const error of ["interaction_required", "consent_required", "login_required"]) {
    assert.equal(isPermanentRefreshFailure(400, JSON.stringify({ error })), true, error);
  }
});

test("those sign-in errors still follow the status rule: a server error is never permanent", () => {
  assert.equal(isPermanentRefreshFailure(503, JSON.stringify({ error: "interaction_required" })), false);
});

// After a temporary failure the connection is kept, but every request must not hit the provider again.
test("a connection that just failed rests for the cooldown, then is tried again", () => {
  let clock = 1_000;
  const cooldown = createRefreshCooldown(60_000, () => clock);
  assert.equal(cooldown.isCoolingDown("t1:GOOGLE"), false);
  cooldown.mark("t1:GOOGLE");
  assert.equal(cooldown.isCoolingDown("t1:GOOGLE"), true);
  clock += 59_999;
  assert.equal(cooldown.isCoolingDown("t1:GOOGLE"), true);
  clock += 1;
  assert.equal(cooldown.isCoolingDown("t1:GOOGLE"), false);
});

test("the cooldown is kept per business and provider", () => {
  const cooldown = createRefreshCooldown(60_000, () => 0);
  cooldown.mark("t1:GOOGLE");
  assert.equal(cooldown.isCoolingDown("t2:GOOGLE"), false);
  assert.equal(cooldown.isCoolingDown("t1:MICROSOFT"), false);
});

test("a successful refresh clears the cooldown", () => {
  const cooldown = createRefreshCooldown(60_000, () => 0);
  cooldown.mark("t1:GOOGLE");
  cooldown.clear("t1:GOOGLE");
  assert.equal(cooldown.isCoolingDown("t1:GOOGLE"), false);
});

test("marking again restarts the rest period", () => {
  let clock = 0;
  const cooldown = createRefreshCooldown(1_000, () => clock);
  cooldown.mark("k");
  clock = 900;
  cooldown.mark("k");
  clock = 1_500;
  assert.equal(cooldown.isCoolingDown("k"), true);
  clock = 1_900;
  assert.equal(cooldown.isCoolingDown("k"), false);
});
