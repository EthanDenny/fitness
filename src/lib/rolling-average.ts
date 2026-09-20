export interface DatedValue {
  date: string;
  value: number;
}

export const rollingAverage = (
  dates: string[],
  points: DatedValue[],
  windowSize = 7,
): DatedValue[] => {
  const valuesByDate = new Map(points.map(({ date, value }) => [date, value]));

  return dates.flatMap((date, index) => {
    if (index < windowSize - 1) return [];

    const values = dates
      .slice(index - windowSize + 1, index + 1)
      .map((windowDate) => valuesByDate.get(windowDate))
      .filter((value): value is number =>
        typeof value === "number" && Number.isFinite(value),
      );

    return values.length > 0
      ? [{
          date,
          value: values.reduce((sum, value) => sum + value, 0) / values.length,
        }]
      : [];
  });
};
