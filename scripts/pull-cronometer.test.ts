import assert from "node:assert/strict";
import test from "node:test";

import {
  collectCookies,
  caloriesBody,
  compactNutritionCsv,
  mergeNutritionCsv,
  mergeCookies,
  parseAnticsrf,
  parseArgs,
  parseNonce,
  parseCaloriesResponse,
  parseWeightsCsv,
  parseUserId,
} from "./pull-cronometer.ts";

test("parseArgs clamps the default range to the minimum export date", () => {
  const options = parseArgs([], new Date("2026-09-06T12:00:00"));
  assert.equal(options.start, "2026-09-05");
  assert.equal(options.end, "2026-09-06");
});

test("parseArgs accepts an explicit range", () => {
  const options = parseArgs([
    "--start",
    "2026-09-05",
    "--end",
    "2026-09-30",
  ]);
  assert.equal(options.start, "2026-09-05");
  assert.equal(options.end, "2026-09-30");
});

test("parseArgs never requests data before September 5, 2026", () => {
  const options = parseArgs(["--start", "2020-01-01", "--end", "2026-09-06"]);
  assert.equal(options.start, "2026-09-05");
  assert.throws(
    () => parseArgs(["--start", "2020-01-01", "--end", "2026-09-04"]),
    /on or after 2026-09-05/,
  );
});

test("parseArgs rejects invalid ranges", () => {
  assert.throws(() => parseArgs(["--days", "0"]), /positive integer/);
  assert.throws(
    () => parseArgs(["--start", "2026-02-02", "--end", "2026-02-01"]),
    /cannot be after/,
  );
});

test("parsers extract Cronometer authentication values", () => {
  assert.equal(
    parseAnticsrf('<input type="hidden" name="anticsrf" value="csrf-token">'),
    "csrf-token",
  );
  assert.equal(parseUserId("//OK[-123456,0,7]"), -123456);
  assert.equal(
    parseNonce('//OK[1,["0123456789abcdef0123456789abcdef"]]'),
    "0123456789abcdef0123456789abcdef",
  );
  assert.equal(parseAnticsrf('<input value="reversed" name="anticsrf">'), "reversed");
});

test("cookie helpers collect and merge response cookies", () => {
  const headers = new Headers();
  headers.append("set-cookie", "JSESSIONID=abc; Path=/; HttpOnly");
  headers.append("set-cookie", "sesnonce=old; Path=/");
  assert.equal(collectCookies(headers), "JSESSIONID=abc; sesnonce=old");
  assert.equal(
    mergeCookies("JSESSIONID=abc; sesnonce=old", "sesnonce=new; preference=metric"),
    "JSESSIONID=abc; sesnonce=new; preference=metric",
  );
});

test("compactNutritionCsv keeps only the requested nutrition fields", () => {
  const source = [
    "Date,Energy (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Iron (mg)",
    "2026-09-05,2000.50,150.25,180.50,60.75,25.50,12.00",
  ].join("\n");
  const result = compactNutritionCsv(
    source,
    new Map([["2026-09-05", 1743.39]]),
    new Map([["2026-09-05", { amount: 181.4, unit: "lbs" }]]),
  );
  assert.equal(
    result,
    "Date,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Weight,Weight Unit\n" +
      "2026-09-05,1743.39,150.25,180.5,60.75,25.5,181.4,lbs\n",
  );
});

test("compactNutritionCsv preserves days with weight but no nutrition entries", () => {
  const source = "Date,Protein (g),Carbs (g),Fat (g),Fiber (g)\n";
  const result = compactNutritionCsv(
    source,
    new Map([["2026-09-20", 0]]),
    new Map([["2026-09-20", { amount: 212.6, unit: "lbs" }]]),
  );
  assert.equal(
    result,
    "Date,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Weight,Weight Unit\n" +
      "2026-09-20,,,,,,212.6,lbs\n",
  );
});

test("parseWeightsCsv keeps the latest weight and its source unit", () => {
  const source = [
    "Day,Time,Group,Metric,Unit,Amount",
    "2026-09-05,7:00 AM,Uncategorized,Weight,lbs,182.1",
    "2026-09-05,8:00 PM,Uncategorized,Weight,lbs,181.4",
    "2026-09-05,9:00 PM,Uncategorized,Body Fat,%,18",
    "2026-09-06,,Uncategorized,Weight,kg,82.2",
  ].join("\n");

  assert.deepEqual([...parseWeightsCsv(source)], [
    ["2026-09-05", { amount: 181.4, unit: "lbs" }],
    ["2026-09-06", { amount: 82.2, unit: "kg" }],
  ]);
});

test("compactNutritionCsv requires exact Energy History calories", () => {
  const source = [
    "Date,Protein (g),Carbs (g),Fat (g),Fiber (g)",
    "2026-09-05,100,200,50,20",
  ].join("\n");
  assert.throws(
    () => compactNutritionCsv(source, new Map()),
    /Energy History is missing calories for 2026-09-05/,
  );
});

test("mergeNutritionCsv replaces only the selected dates", () => {
  const existing = [
    "Date,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g)",
    "2026-09-05,1700,140,150,40,14",
    "2026-09-06,900,90,40,20,3",
  ].join("\n");
  const update = [
    "Date,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g)",
    "2026-09-06,1008,107,40,24,2",
  ].join("\n");

  assert.equal(
    mergeNutritionCsv(existing, update, "2026-09-06", "2026-09-06"),
    "Date,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g),Weight,Weight Unit\n" +
      "2026-09-05,1700,140,150,40,14,,\n" +
      "2026-09-06,1008,107,40,24,2,,\n",
  );
});

test("caloriesBody requests the inclusive date range using Cronometer days", () => {
  const body = caloriesBody("header", "nonce", -42, "2026-09-05", "2026-09-06");
  assert.match(body, /getCaloriesConsumedAndBurned/);
  assert.match(body, /\|42\|7\|5\|9\|2026\|7\|7\|9\|2026\|$/);
});

test("parseCaloriesResponse maps consumed energy to ascending dates", () => {
  const response =
    "//OK[0,0,0,0,0,0,0,0,0,0,1000,2000,12,2," +
    "0,0,0,0,0,0,0,0,0,0,900,1743.39,12,2," +
    '2,1,["[[D/158574334","[D/2047612875"],0,7]';
  assert.deepEqual(
    [...parseCaloriesResponse(response, "2026-09-05", "2026-09-06")],
    [
      ["2026-09-05", 1743.39],
      ["2026-09-06", 2000],
    ],
  );
});
