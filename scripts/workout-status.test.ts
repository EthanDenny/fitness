import assert from "node:assert/strict";
import test from "node:test";
import { workoutStatus } from "../src/lib/workout-status.ts";

const workoutDates = new Set([
  "2026-09-05",
  "2026-09-06",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
  "2026-09-13",
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-19",
]);

test("marks dates with workouts as worked out", () => {
  assert.equal(
    workoutStatus("2026-09-19", "2026-09-19", workoutDates),
    "worked out",
  );
});

test("leaves the current day pending when it has no workout", () => {
  assert.equal(
    workoutStatus("2026-09-20", "2026-09-20", workoutDates),
    "pending",
  );
});

test("marks every completed no-workout day as rest", () => {
  assert.equal(
    workoutStatus("2026-09-17", "2026-09-19", workoutDates),
    "rest",
  );
  assert.equal(
    workoutStatus("2026-09-18", "2026-09-19", workoutDates),
    "rest",
  );
  assert.equal(
    workoutStatus("2026-09-20", "2026-09-21", workoutDates),
    "rest",
  );
});
