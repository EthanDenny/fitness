import assert from "node:assert/strict";
import test from "node:test";
import { weightTargetLine } from "../src/lib/weight-target-line.ts";

const start = { date: "2026-09-05", value: 215.2 };
const end = { date: "2026-11-07", value: 200 };

test("draws a linear target between fixed start and end weights", () => {
  const points = weightTargetLine(
    ["2026-09-04", "2026-09-05", "2026-10-07", "2026-11-07", "2026-11-08"],
    start,
    end,
  );

  assert.equal(points[0].value, 215.2);
  assert.ok(Math.abs(points[1].value - 207.4793650793651) < 0.000000001);
  assert.equal(points[2].value, 200);
  assert.deepEqual(points.map(({ date }) => date), [
    "2026-09-05",
    "2026-10-07",
    "2026-11-07",
  ]);
});

test("rejects a target that does not move forward in time", () => {
  assert.throws(
    () => weightTargetLine([], start, { date: start.date, value: 200 }),
    /must follow/,
  );
});
