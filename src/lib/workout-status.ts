export type WorkoutStatus = "worked out" | "rest" | "pending";

export const workoutStatus = (
  date: string,
  today: string,
  workoutDates: ReadonlySet<string>,
): WorkoutStatus => {
  if (workoutDates.has(date)) return "worked out";
  if (date === today) return "pending";
  return "rest";
};
