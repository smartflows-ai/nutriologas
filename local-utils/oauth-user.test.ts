// Which user an OAuth callback belongs to when the same email exists in several tenants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickOAuthUser } from "../src/lib/oauth-user";

const doctorCustomer = { id: "u1", role: "CUSTOMER", tenantId: "t-doctor" };
const farAdmin = { id: "u2", role: "ADMIN", tenantId: "t-far" };

test("prefers the signed-in user when the email is shared by several tenants", () => {
  assert.equal(pickOAuthUser([doctorCustomer, farAdmin], "u2")?.id, "u2");
  assert.equal(pickOAuthUser([farAdmin, doctorCustomer], "u1")?.id, "u1");
});

test("without a session, picks the admin instead of the first customer", () => {
  assert.equal(pickOAuthUser([doctorCustomer, farAdmin], null)?.id, "u2");
});

test("a session id that is not among the candidates is ignored", () => {
  assert.equal(pickOAuthUser([doctorCustomer, farAdmin], "other")?.id, "u2");
});

test("returns the only candidate, or null when there is none", () => {
  assert.equal(pickOAuthUser([doctorCustomer], null)?.id, "u1");
  assert.equal(pickOAuthUser([], "u1"), null);
});
