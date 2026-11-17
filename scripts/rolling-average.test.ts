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
      { date: "2026-09-14", value: 1, incomplete: false },
      { date: "2026-09-15", value: 1.5, incomplete: false },
      { date: "2026-09-16", value: 2, incomplete: false },
    ],
  );
});

test("leaves missing days empty and resumes averaging available values", () => {
  const points = dates.map((date, index) => ({
    date,
    value: index + 1,
  })).filter((point) => point.date !== "2026-09-17");

  const averages = rollingAverage(dates, points);
  assert(!averages.some((point) => point.date === "2026-09-17"));
  assert.deepEqual(averages.find((point) => point.date === "2026-09-18"), {
    date: "2026-09-18", value: 2.75, incomplete: true,
  });
  assert.deepEqual(averages.at(-1), {
    date: "2026-09-20", value: 4, incomplete: true,
  });
});

test("does not extend the average past the last measurement", () => {
  assert.deepEqual(rollingAverage(dates, [{ date: dates[0], value: 0 }]), [
    { date: dates[0], value: 0, incomplete: false },
  ]);
});

test("uses only the latest seven values once the window is full", () => {
  const eightDates = [...dates, "2026-09-21"];
  const points = eightDates.map((date, index) => ({ date, value: index + 1 }));

  assert.deepEqual(rollingAverage(eightDates, points).at(-1), {
    date: "2026-09-21",
    value: 5,
    incomplete: false,
  });
});
