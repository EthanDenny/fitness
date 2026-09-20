import assert from "node:assert/strict";
import test from "node:test";
import { rollingAverage } from "../src/lib/rolling-average.ts";

const dates = [
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
];

test("waits for a complete calendar window", () => {
  assert.deepEqual(
    rollingAverage(dates.slice(0, 6), dates.slice(0, 6).map((date) => ({ date, value: 1 }))),
    [],
  );
});

test("averages only non-null values inside the calendar window", () => {
  const points = dates.slice(0, 6).map((date, index) => ({
    date,
    value: index + 1,
  }));

  assert.deepEqual(rollingAverage(dates, points), [
    { date: "2026-09-20", value: 3.5 },
  ]);
});

test("uses all seven values when none are null", () => {
  const points = dates.map((date, index) => ({ date, value: index + 1 }));
  assert.deepEqual(rollingAverage(dates, points), [
    { date: "2026-09-20", value: 4 },
  ]);
});
