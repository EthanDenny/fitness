import assert from "node:assert/strict";
import test from "node:test";

import { exporterCommands, parseArgs } from "./pull-fitness-data.ts";

const NOW = new Date("2026-09-06T12:00:00");

test("combined pull defaults to today", () => {
  assert.deepEqual(parseArgs([], NOW), {
    start: "2026-09-06",
    end: "2026-09-06",
    replace: false,
  });
});

test("combined pull accepts one date", () => {
  assert.deepEqual(parseArgs(["--date", "2026-09-05"], NOW), {
    start: "2026-09-05",
    end: "2026-09-05",
    replace: false,
  });
});

test("combined pull accepts all days since the cutoff", () => {
  assert.deepEqual(parseArgs(["--all"], NOW), {
    start: "2026-09-05",
    end: "2026-09-06",
    replace: true,
  });
});

test("combined pull rejects dates outside its supported range", () => {
  assert.throws(() => parseArgs(["--date", "2026-09-04"], NOW), /on or after/);
  assert.throws(() => parseArgs(["--date", "2026-09-07"], NOW), /future/);
  assert.throws(() => parseArgs(["--date", "September 5"], NOW), /YYYY-MM-DD/);
});

test("combined pull passes the same range to both exporters", () => {
  const commands = exporterCommands({
    start: "2026-09-05",
    end: "2026-09-06",
    replace: true,
  });
  assert.deepEqual(
    commands.map(({ name, args }) => ({ name, args })),
    [
      {
        name: "Cronometer",
        args: ["--start", "2026-09-05", "--end", "2026-09-06", "--replace"],
      },
      {
        name: "Hevy",
        args: ["--start", "2026-09-05", "--end", "2026-09-06", "--replace"],
      },
    ],
  );
});
