export function sortProviderSchedules<T extends { startsAt?: Date | string | null; scheduledDate?: Date | string | null }>(
  schedules: T[],
): T[] {
  const timestamp = (schedule: T) => {
    const value = schedule.startsAt ?? schedule.scheduledDate;
    const parsed = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  };
  return [...schedules].sort((left, right) => timestamp(left) - timestamp(right));
}
