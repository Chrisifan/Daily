import test from "node:test";
import assert from "node:assert/strict";
import { appendToast, consumeQueuedToast, createToastRecord, removeToast } from "./ToastProvider.js";

test("createToastRecord creates a success toast with a generated id", () => {
  const toast = createToastRecord({ tone: "success", title: "Saved" });

  assert.equal(toast.tone, "success");
  assert.equal(toast.title, "Saved");
  assert.match(toast.id, /^toast-/);
});

test("appendToast adds a toast to the queue", () => {
  const toast = createToastRecord({ tone: "info", title: "Queued" }, "toast-1");

  assert.deepEqual(appendToast([], toast), [toast]);
});

test("removeToast removes the matching toast from the queue", () => {
  const first = createToastRecord({ tone: "success", title: "First" }, "toast-1");
  const second = createToastRecord({ tone: "error", title: "Second" }, "toast-2");

  assert.deepEqual(removeToast([first, second], "toast-1"), [second]);
});

test("consumeQueuedToast returns and clears a queued toast", () => {
  let stored = JSON.stringify({ tone: "success", title: "Saved", description: "Applied" });
  const removedKeys: string[] = [];
  const storage = {
    getItem(key: string) {
      return key === "daily.pending-toast" ? stored : null;
    },
    removeItem(key: string) {
      removedKeys.push(key);
      if (key === "daily.pending-toast") {
        stored = "";
      }
    },
  };

  assert.deepEqual(consumeQueuedToast(storage), {
    tone: "success",
    title: "Saved",
    description: "Applied",
  });
  assert.deepEqual(removedKeys, ["daily.pending-toast"]);
});

test("consumeQueuedToast clears invalid queued payloads", () => {
  const removedKeys: string[] = [];
  const storage = {
    getItem() {
      return "{invalid-json";
    },
    removeItem(key: string) {
      removedKeys.push(key);
    },
  };

  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    assert.equal(consumeQueuedToast(storage), null);
    assert.deepEqual(removedKeys, ["daily.pending-toast"]);
  } finally {
    console.error = originalConsoleError;
  }
});
