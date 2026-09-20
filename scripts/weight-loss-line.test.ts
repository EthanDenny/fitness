import assert from "node:assert/strict";
import test from "node:test";
import { weightLossLine } from "../src/lib/weight-loss-line.ts";

test("starts at day one and falls two pounds per week", () => {
  assert.deepEqual(
    weightLossLine(
      ["2026-09-05", "2026-09-12", "2026-09-19"],
      { date: "2026-09-05", value: 215.2 },
    ),
    [
      { date: "2026-09-05", value: 215.2 },
      { date: "2026-09-12", value: 213.2 },
      { date: "2026-09-19", value: 211.2 },
    ],
  );
});

test("returns no line without a starting weight", () => {
  assert.deepEqual(weightLossLine(["2026-09-05"], undefined), []);
});
