import type { DatedValue } from "./rolling-average.ts";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const weightLossLine = (
  dates: string[],
  startingPoint: DatedValue | undefined,
  poundsPerWeek = 2,
): DatedValue[] => {
  if (!startingPoint) return [];

  const startingTime = Date.parse(`${startingPoint.date}T00:00:00Z`);
  return dates
    .filter((date) => date >= startingPoint.date)
    .map((date) => {
      const elapsedDays =
        (Date.parse(`${date}T00:00:00Z`) - startingTime) / millisecondsPerDay;
      return {
        date,
        value: startingPoint.value - (elapsedDays * poundsPerWeek) / 7,
      };
    });
};
