import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  fetchAllWorkouts,
  mergeWorkouts,
  parseArgs,
  WORKOUT_CUTOFF,
  writeExport,
} from "./pull-hevy-workouts.ts";

test("parseArgs accepts a custom output path", () => {
  assert.deepEqual(parseArgs(["--output", "exports/workouts.json"], new Date("2026-09-06T12:00:00Z")), {
    help: false,
    outputPath: "exports/workouts.json",
    start: "2026-09-05",
    end: "2026-09-06",
    replace: false,
  });
});

test("parseArgs accepts and validates a date range", () => {
  assert.deepEqual(parseArgs(["--start", "2026-09-05", "--end", "2026-09-05"]), {
    help: false,
    outputPath: "data/hevy-workouts.json",
    start: "2026-09-05",
    end: "2026-09-05",
    replace: false,
  });
  assert.throws(() => parseArgs(["--start", "not-a-date"]), /YYYY-MM-DD/);
});

test("fetchAllWorkouts follows every page", async () => {
  const requestedPages: number[] = [];
  const fetchImpl = async (url: URL, options?: RequestInit) => {
    const page = Number(url.searchParams.get("page"));
    requestedPages.push(page);
    assert.equal(url.searchParams.get("pageSize"), "10");
    assert.equal(new Headers(options?.headers).get("api-key"), "test-key");

    return Response.json({
      page,
      page_count: 2,
      workouts: [
        {
          id: `workout-${page}`,
          start_time: `2026-09-0${page + 4}T12:00:00.000Z`,
        },
      ],
    });
  };

  const workouts = await fetchAllWorkouts({
    apiKey: "test-key",
    apiBaseUrl: "https://example.test/v1",
    fetchImpl,
  });

  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(workouts, [
    { id: "workout-1", start_time: "2026-09-05T12:00:00.000Z" },
    { id: "workout-2", start_time: "2026-09-06T12:00:00.000Z" },
  ]);
});

test("fetchAllWorkouts ignores workouts before September 5, 2026", async () => {
  const workouts = await fetchAllWorkouts({
    apiKey: "test-key",
    fetchImpl: async () =>
      Response.json({
        page: 1,
        page_count: 1,
        workouts: [
          { id: "before", start_time: "2026-09-04T23:59:59.999Z" },
          { id: "at-cutoff", start_time: WORKOUT_CUTOFF },
          { id: "after", start_time: "2026-09-05T12:00:00.000Z" },
        ],
      }),
  });

  assert.deepEqual(
    workouts.map(({ id }) => id),
    ["at-cutoff", "after"],
  );
});

test("fetchAllWorkouts excludes workouts after the selected range", async () => {
  const workouts = await fetchAllWorkouts({
    apiKey: "test-key",
    cutoff: "2026-09-05T00:00:00.000Z",
    through: "2026-09-06T00:00:00.000Z",
    fetchImpl: async () =>
      Response.json({
        page: 1,
        page_count: 1,
        workouts: [
          { id: "selected", start_time: "2026-09-05T23:59:59.999Z" },
          { id: "next-day", start_time: "2026-09-06T00:00:00.000Z" },
        ],
      }),
  });

  assert.deepEqual(workouts.map(({ id }) => id), ["selected"]);
});

test("mergeWorkouts replaces only workouts in the selected range", () => {
  const yesterday = { id: "yesterday", start_time: "2026-09-05T12:00:00.000Z" };
  const stale = { id: "today-old", start_time: "2026-09-06T10:00:00.000Z" };
  const current = { id: "today-new", start_time: "2026-09-06T11:00:00.000Z" };

  assert.deepEqual(
    mergeWorkouts(
      [stale, yesterday],
      [current],
      "2026-09-06T00:00:00.000Z",
      "2026-09-07T00:00:00.000Z",
    ),
    [current, yesterday],
  );
});

test("fetchAllWorkouts reports API errors without exposing the key", async () => {
  await assert.rejects(
    fetchAllWorkouts({
      apiKey: "super-secret",
      fetchImpl: async () =>
        new Response('{"error":"Unauthorized"}', {
          status: 401,
          statusText: "Unauthorized",
        }),
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /401 Unauthorized/);
      assert.doesNotMatch(error.message, /super-secret/);
      return true;
    },
  );
});

test("writeExport writes metadata and workouts", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "hevy-export-"));
  const outputPath = path.join(directory, "nested", "workouts.json");
  const exportedAt = new Date("2026-09-06T12:00:00.000Z");

  const workout = { id: "workout-1", start_time: "2026-09-05T12:00:00.000Z" };
  await writeExport(outputPath, [workout], exportedAt);

  const data = JSON.parse(await readFile(outputPath, "utf8"));
  assert.deepEqual(data, {
    exported_at: "2026-09-06T12:00:00.000Z",
    workouts_since: "2026-09-05T00:00:00.000Z",
    workout_count: 1,
    workouts: [workout],
  });
});
