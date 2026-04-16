import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowBlockingAccountsLoading } from "./integrations-view-state";

test("integrations page keeps current account list visible during background refresh", () => {
  assert.equal(shouldShowBlockingAccountsLoading(true, 1), false);
});

test("integrations page shows blocking loading only before the first account load", () => {
  assert.equal(shouldShowBlockingAccountsLoading(true, 0), true);
  assert.equal(shouldShowBlockingAccountsLoading(false, 0), false);
});
