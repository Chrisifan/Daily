import test from "node:test";
import assert from "node:assert/strict";
import {
  TIME_SELECT_DROPDOWN_CONTENT_CLASSNAME,
  TIME_SELECT_DROPDOWN_ITEM_CLASSNAME,
} from "./settings-field-styles";

test("TimeSelectField uses the shared dropdown surface styling", () => {
  assert.match(TIME_SELECT_DROPDOWN_CONTENT_CLASSNAME, /rounded-xl/);
  assert.match(TIME_SELECT_DROPDOWN_CONTENT_CLASSNAME, /border-black\/5/);
  assert.match(TIME_SELECT_DROPDOWN_CONTENT_CLASSNAME, /bg-white\/95/);
  assert.match(TIME_SELECT_DROPDOWN_CONTENT_CLASSNAME, /backdrop-blur-xl/);
});

test("TimeSelectField uses the shared dropdown item row styling", () => {
  assert.match(TIME_SELECT_DROPDOWN_ITEM_CLASSNAME, /flex h-8 items-center/);
  assert.match(TIME_SELECT_DROPDOWN_ITEM_CLASSNAME, /px-3 text-sm/);
  assert.doesNotMatch(TIME_SELECT_DROPDOWN_ITEM_CLASSNAME, /rounded-xl/);
});
