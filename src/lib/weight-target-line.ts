import type { DatedValue } from "./rolling-average.ts";

const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);

export const weightTargetLine = (
  dates: string[],
  start: DatedValue,
  end: DatedValue,
): DatedValue[] => {
  const startTime = timestamp(start.date);
  const duration = timestamp(end.date) - startTime;
  if (duration <= 0) {
    throw new Error("Weight target end date must follow its start date");
  }

  return dates
    .filter((date) => date >= start.date && date <= end.date)
    .map((date) => {
      const progress = (timestamp(date) - startTime) / duration;
      return {
        date,
        value: start.value + (end.value - start.value) * progress,
      };
    });
};
