const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/St_Johns",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const partsFor = (instant: Date) =>
  Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );

export const fitnessDate = (instant: Date | string): string => {
  const { year, month, day } = partsFor(
    typeof instant === "string" ? new Date(instant) : instant,
  );
  return `${year}-${month}-${day}`;
};

export const fitnessDayStart = (date: string): string => {
  const midnight = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(midnight)) throw new Error(`Invalid date: ${date}`);

  let instant = midnight;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { year, month, day, hour, minute, second } = partsFor(new Date(instant));
    const localClock = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    const correction = midnight - localClock;
    instant += correction;
    if (correction === 0) return new Date(instant).toISOString();
  }

  throw new Error(`Could not find the start of ${date} in America/St_Johns`);
};
