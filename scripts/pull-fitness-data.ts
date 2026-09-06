#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { MIN_EXPORT_DATE } from "./pull-cronometer.ts";

const HELP = `Download fitness data from Cronometer and Hevy.

Usage:
  npm run pull                         Download today
  npm run pull -- --date YYYY-MM-DD   Download one day
  npm run pull -- --all               Download ${MIN_EXPORT_DATE} through today
`;

interface DateRange {
  start: string;
  end: string;
  replace: boolean;
}

interface HelpOptions {
  help: true;
}

interface ExporterCommand {
  name: string;
  script: string;
  args: string[];
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function parseArgs(argv: string[], now = new Date()): DateRange | HelpOptions {
  const today = formatLocalDate(now);
  if (argv.length === 0) return { start: today, end: today, replace: false };
  if (argv.length === 1 && ["-h", "--help"].includes(argv[0])) return { help: true };
  if (argv.length === 1 && argv[0] === "--all") {
    return { start: MIN_EXPORT_DATE, end: today, replace: true };
  }
  if (argv.length === 2 && argv[0] === "--date") {
    const date = argv[1];
    if (!isDate(date)) throw new Error("--date requires YYYY-MM-DD");
    if (date < MIN_EXPORT_DATE) {
      throw new Error(`--date must be on or after ${MIN_EXPORT_DATE}`);
    }
    if (date > today) throw new Error("--date cannot be in the future");
    return { start: date, end: date, replace: false };
  }

  throw new Error("Use no options, --date YYYY-MM-DD, or --all");
}

export function exporterCommands({
  start,
  end,
  replace,
}: DateRange): ExporterCommand[] {
  const args = ["--start", start, "--end", end, ...(replace ? ["--replace"] : [])];
  return [
    {
      name: "Cronometer",
      script: fileURLToPath(new URL("./pull-cronometer.ts", import.meta.url)),
      args,
    },
    {
      name: "Hevy",
      script: fileURLToPath(new URL("./pull-hevy-workouts.ts", import.meta.url)),
      args,
    },
  ];
}

function run({ script, args }: ExporterCommand): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`stopped by ${signal}`));
      else if (code !== 0) reject(new Error(`exited with status ${code}`));
      else resolve();
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if ("help" in options) {
    process.stdout.write(HELP);
    return;
  }

  process.stdout.write(`Downloading fitness data for ${options.start}${options.end === options.start ? "" : ` through ${options.end}`}…\n`);
  for (const command of exporterCommands(options)) {
    process.stdout.write(`\n${command.name}\n`);
    try {
      await run(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${command.name} ${message}`);
    }
  }
  process.stdout.write("\nDone.\n");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  });
}
