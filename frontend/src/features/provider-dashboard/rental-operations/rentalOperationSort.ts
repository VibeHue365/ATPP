export type RentalReturnSort =
  "DEFAULT" | "RETURN_DUE_ASC" | "MOST_OVERDUE" | "NEAREST_OVERDUE";

export function getRentalReturnDueAt(item: any): number {
  const value = item?.rentalFulfillment?.returnDueAt || item?.rentalTo;
  const timestamp = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

export function sortRentalOperationItems<T extends { item: any }>(
  rows: T[],
  sort: RentalReturnSort,
): T[] {
  if (sort === "DEFAULT") return rows;
  const direction = sort === "NEAREST_OVERDUE" ? -1 : 1;
  return [...rows].sort(
    (left, right) =>
      (getRentalReturnDueAt(left.item) - getRentalReturnDueAt(right.item)) *
      direction,
  );
}
