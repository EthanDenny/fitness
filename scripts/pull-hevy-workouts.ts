#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_API_BASE_URL = "https://api.hevyapp.com/v1";
const DEFAULT_OUTPUT_PATH = "data/hevy-workouts.json";
const PAGE_SIZE = 10;
export const WORKOUT_CUTOFF = "2026-09-05T00:00:00.000Z";
export const WORKOUT_CUTOFF_DATE = WORKOUT_CUTOFF.slice(0, 10);

export interface Workout {
  id?: string;
  start_time: string;
  [key: string]: unknown;
}

interface WorkoutPage {
  page: number;
  page_count: number;
  workouts: Workout[];
}

interface PageProgress {
  page: number;
  pageCount: number;
  workoutCount: number;
}

interface FetchAllWorkoutsOptions {
  apiKey?: string;
  apiBaseUrl?: string;
  cutoff?: string;
  through?: string;
  fetchImpl?: (url: URL, init?: RequestInit) => Promise<Response>;
  onPage?: (progress: PageProgress) => void;
}

interface HevyOptions {
  help: boolean;
  outputPath: string;
  start: string;
  end: string;
  replace: boolean;
}

interface ExportRange {
  cutoff?: string;
  through?: string;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && formatUtcDate(date) === value;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return formatUtcDate(value);
}

export function parseArgs(argv: string[], now = new Date()): HevyOptions {
  let outputPath = DEFAULT_OUTPUT_PATH;
  let start = WORKOUT_CUTOFF_DATE;
  let end = formatUtcDate(now);
  let replace = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      return { help: true, outputPath, start, end, replace };
    }

    if (argument === "--output" || argument === "-o") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`${argument} requires a file path.`);
      }

      outputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--start" || argument === "--end") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-") || !isDate(value)) {
        throw new Error(`${argument} requires a date in YYYY-MM-DD format.`);
      }

      if (argument === "--start") start = value;
      else end = value;
      index += 1;
      continue;
    }

    if (argument === "--replace") {
      replace = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (end < WORKOUT_CUTOFF_DATE) {
    throw new Error(`--end must be on or after ${WORKOUT_CUTOFF_DATE}.`);
  }
  if (start < WORKOUT_CUTOFF_DATE) start = WORKOUT_CUTOFF_DATE;
  if (start > end) throw new Error("--start cannot be after --end.");

  return { help: false, outputPath, start, end, replace };
}

export async function fetchAllWorkouts({
  apiKey,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  cutoff = WORKOUT_CUTOFF,
  through,
  fetchImpl = fetch,
  onPage = () => {},
}: FetchAllWorkoutsOptions): Promise<Workout[]> {
  if (!apiKey) {
    throw new Error(
      "HEVY_API_KEY is required. Create one at https://hevy.com/settings?developer.",
    );
  }

  const workouts = [];
  const cutoffTimestamp = Date.parse(cutoff);
  const throughTimestamp = through ? Date.parse(through) : Number.POSITIVE_INFINITY;
  let page = 1;
  let pageCount = 1;

  if (Number.isNaN(cutoffTimestamp)) {
    throw new Error(`Invalid workout cutoff: ${cutoff}`);
  }
  if (Number.isNaN(throughTimestamp)) {
    throw new Error(`Invalid workout end: ${through}`);
  }

  while (page <= pageCount) {
    const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/workouts`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(PAGE_SIZE));

    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "api-key": apiKey,
      },
    });

    if (!response.ok) {
      const responseBody = await response.text();
      const details = responseBody.trim()
        ? `: ${responseBody.trim().slice(0, 500)}`
        : "";
      throw new Error(
        `Hevy API request failed (${response.status} ${response.statusText})${details}`,
      );
    }

    const payload: unknown = await response.json();
    validateWorkoutPage(payload, page);

    pageCount = payload.page_count;
    const includedWorkouts = payload.workouts.filter((workout) => {
      const startTimestamp = Date.parse(workout.start_time);

      if (Number.isNaN(startTimestamp)) {
        throw new Error(`Workout ${workout.id ?? "without an ID"} has no valid start_time.`);
      }

      return startTimestamp >= cutoffTimestamp && startTimestamp < throughTimestamp;
    });

    workouts.push(...includedWorkouts);
    onPage({ page, pageCount, workoutCount: workouts.length });
    page += 1;
  }

  return workouts;
}

function validateWorkoutPage(payload: unknown, requestedPage: number): asserts payload is WorkoutPage {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("page" in payload) ||
    !Number.isInteger(payload.page) ||
    !("page_count" in payload) ||
    !Number.isInteger(payload.page_count) ||
    !("workouts" in payload) ||
    !Array.isArray(payload.workouts) ||
    !payload.workouts.every(isWorkout)
  ) {
    throw new Error(`Hevy returned an invalid response for page ${requestedPage}.`);
  }

  if (payload.page !== requestedPage) {
    throw new Error(
      `Hevy returned page ${payload.page} when page ${requestedPage} was requested.`,
    );
  }
}

function isWorkout(value: unknown): value is Workout {
  return (
    typeof value === "object" &&
    value !== null &&
    "start_time" in value &&
    typeof value.start_time === "string" &&
    (!("id" in value) || typeof value.id === "string")
  );
}

function parseWorkoutExport(source: string): Workout[] {
  const data: unknown = JSON.parse(source);
  if (
    typeof data !== "object" ||
    data === null ||
    !("workouts" in data) ||
    !Array.isArray(data.workouts) ||
    !data.workouts.every(isWorkout)
  ) {
    throw new Error("Existing Hevy export is invalid.");
  }
  return data.workouts;
}

export function mergeWorkouts(
  existing: Workout[],
  updates: Workout[],
  cutoff: string,
  through: string,
): Workout[] {
  const startTimestamp = Date.parse(cutoff);
  const endTimestamp = Date.parse(through);
  const retained = existing.filter((workout) => {
    const timestamp = Date.parse(workout.start_time);
    return timestamp < startTimestamp || timestamp >= endTimestamp;
  });
  const workouts = new Map<string, Workout>();
  for (const workout of [...retained, ...updates]) {
    const key = workout.id ?? `${workout.start_time}:${String(workout.title ?? "")}`;
    workouts.set(key, workout);
  }
  return [...workouts.values()].sort(
    (a, b) => Date.parse(b.start_time) - Date.parse(a.start_time),
  );
}

export async function writeExport(
  outputPath: string,
  workouts: Workout[],
  exportedAt = new Date(),
  { cutoff = WORKOUT_CUTOFF, through }: ExportRange = {},
): Promise<string> {
  const absoluteOutputPath = path.resolve(outputPath);
  const outputDirectory = path.dirname(absoluteOutputPath);
  const temporaryPath = `${absoluteOutputPath}.${process.pid}.tmp`;
  const exportData = {
    exported_at: exportedAt.toISOString(),
    workouts_since: cutoff,
    ...(through
      ? { workouts_through: new Date(Date.parse(through) - 1).toISOString() }
      : {}),
    workout_count: workouts.length,
    workouts,
  };

  await mkdir(outputDirectory, { recursive: true });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(exportData, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporaryPath, absoluteOutputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  return absoluteOutputPath;
}

function printHelp() {
  console.log(`Pull Hevy workouts from September 5, 2026 onward and save them as JSON.

Usage:
  npm run hevy:pull
  npm run hevy:pull -- --start YYYY-MM-DD --end YYYY-MM-DD
  npm run hevy:pull -- --output path/to/workouts.json

Environment:
  HEVY_API_KEY   Required Hevy Pro API key
`);
}

async function main() {
  const { help, outputPath, start, end, replace } = parseArgs(process.argv.slice(2));

  if (help) {
    printHelp();
    return;
  }

  const cutoff = `${start}T00:00:00.000Z`;
  const through = `${addDays(end, 1)}T00:00:00.000Z`;
  let workouts = await fetchAllWorkouts({
    apiKey: process.env.HEVY_API_KEY,
    cutoff,
    through,
    onPage: ({ page, pageCount, workoutCount }) => {
      console.log(
        `Fetched page ${page}/${pageCount} (${workoutCount} workouts so far)`,
      );
    },
  });
  const absoluteOutputPath = path.resolve(outputPath);
  if (!replace && existsSync(absoluteOutputPath)) {
    const existing = parseWorkoutExport(await readFile(absoluteOutputPath, "utf8"));
    workouts = mergeWorkouts(existing, workouts, cutoff, through);
  }
  const savedPath = await writeExport(outputPath, workouts, new Date(), {
    cutoff: replace ? cutoff : WORKOUT_CUTOFF,
    through,
  });

  console.log(`Saved ${workouts.length} workouts to ${savedPath}`);
}

const isCommandLineEntry =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCommandLineEntry) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to pull Hevy workouts: ${message}`);
    process.exitCode = 1;
  });
}
