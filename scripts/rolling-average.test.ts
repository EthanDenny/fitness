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

test("builds partial averages from the first day", () => {
  assert.deepEqual(
    rollingAverage(
      dates.slice(0, 3),
      dates.slice(0, 3).map((date, index) => ({ date, value: index + 1 })),
    ),
    [
      { date: "2026-09-14", value: 1 },
      { date: "2026-09-15", value: 1.5 },
      { date: "2026-09-16", value: 2 },
    ],
  );
});

test("averages only non-null values inside the calendar window", () => {
  const points = dates.slice(0, 6).map((date, index) => ({
    date,
    value: index + 1,
  }));

  assert.equal(rollingAverage(dates, points).at(-1)?.value, 3.5);
});

test("uses only the latest seven values once the window is full", () => {
  const eightDates = [...dates, "2026-09-21"];
  const points = eightDates.map((date, index) => ({ date, value: index + 1 }));

  assert.deepEqual(rollingAverage(eightDates, points).at(-1), {
    date: "2026-09-21",
    value: 5,
  });
});
