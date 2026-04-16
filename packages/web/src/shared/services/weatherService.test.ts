import test from "node:test";
import assert from "node:assert/strict";
import {
  wmoCodeToCondition,
  wmoCodeToDescription,
} from "./weatherService";

test("wmoCodeToDescription maps drizzle and rain shower codes to rainy copy", () => {
  assert.equal(wmoCodeToDescription(80), "home.weather.rainy");
  assert.equal(wmoCodeToDescription(81), "home.weather.rainy");
  assert.equal(wmoCodeToDescription(82), "home.weather.rainy");
});

test("wmoCodeToCondition maps shower codes 80 and 81 to rainy instead of snow", () => {
  assert.equal(wmoCodeToCondition(80, false), "rainy");
  assert.equal(wmoCodeToCondition(81, false), "rainy");
  assert.equal(wmoCodeToCondition(85, false), "snow");
});
