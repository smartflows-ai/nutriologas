// The bot must not answer the people of the business: if an assistant replies to a notice on the business number,
// that message arrives as if it were a customer's.
import test from "node:test";
import assert from "node:assert/strict";
import { isTeamNumber } from "../src/lib/team-numbers";

test("a contact whose number is the owner's is a team number, whatever the format", () => {
  assert.equal(isTeamNumber("5215512345678", ["+52 55 1234 5678"]), true);
  assert.equal(isTeamNumber("525512345678", ["+5215512345678"]), true);
  assert.equal(isTeamNumber("5512345678", ["+5215512345678"]), true);
});

test("a number that is nobody on the team is not", () => {
  assert.equal(isTeamNumber("5215599998888", ["+5215512345678", "+5215511112222"]), false);
});

test("empty or missing numbers never match", () => {
  assert.equal(isTeamNumber("", ["+5215512345678"]), false);
  assert.equal(isTeamNumber(null, ["+5215512345678"]), false);
  assert.equal(isTeamNumber("5215512345678", [null, "", "  "]), false);
  assert.equal(isTeamNumber("5215512345678", []), false);
});
