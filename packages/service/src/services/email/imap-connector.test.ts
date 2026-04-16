import test from "node:test";
import assert from "node:assert/strict";
import { buildImapKeepaliveConfig } from "./imap-connector.js";

test("buildImapKeepaliveConfig uses node-imap keepalive defaults for heartbeat monitoring", () => {
  assert.deepEqual(buildImapKeepaliveConfig(300000), {
    interval: 300000,
    idleInterval: 300000,
    forceNoop: false,
  });
});

test("buildImapKeepaliveConfig disables keepalive when heartbeat monitoring is turned off", () => {
  assert.equal(buildImapKeepaliveConfig(0), false);
  assert.equal(buildImapKeepaliveConfig(undefined), false);
});
