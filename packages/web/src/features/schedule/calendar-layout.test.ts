import test from "node:test";
import assert from "node:assert/strict";
import { resolveDisplayStartSlot } from "./calendar-layout";

test("resolveDisplayStartSlot preserves the compressed gap after a stacked overlap group", () => {
  const displayStartSlot = resolveDisplayStartSlot({
    compressedStartSlot: 36,
    previousDisplayEndSlot: 36,
    previousCompressedEndSlot: 28,
    overlapsPrevious: false,
  });

  assert.equal(displayStartSlot, 44);
});

test("resolveDisplayStartSlot keeps overlapping items visually stacked", () => {
  const displayStartSlot = resolveDisplayStartSlot({
    compressedStartSlot: 24,
    previousDisplayEndSlot: 28,
    previousCompressedEndSlot: 28,
    overlapsPrevious: true,
  });

  assert.equal(displayStartSlot, 28);
});

test("resolveDisplayStartSlot does not add extra space when there is no stacked overflow", () => {
  const displayStartSlot = resolveDisplayStartSlot({
    compressedStartSlot: 36,
    previousDisplayEndSlot: 28,
    previousCompressedEndSlot: 28,
    overlapsPrevious: false,
  });

  assert.equal(displayStartSlot, 36);
});
