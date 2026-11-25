import { describe, expect, it } from "vitest";
import {
  isOverdueRentalItem,
  sortRentalOperationItems,
} from "../src/features/provider-dashboard/rental-operations/rentalOperationSort";

describe("sortRentalOperationItems", () => {
  const rows = [
    { id: "near", item: { rentalTo: "2026-11-24T10:00:00.000Z" } },
    {
      id: "late",
      item: { rentalFulfillment: { returnDueAt: "2026-11-20T10:00:00.000Z" } },
    },
  ];

  it("puts the longest overdue return first", () => {
    expect(
      sortRentalOperationItems(rows, "MOST_OVERDUE").map((row) => row.id),
    ).toEqual(["late", "near"]);
  });

  it("puts the most recently overdue return first", () => {
    expect(
      sortRentalOperationItems(rows, "NEAREST_OVERDUE").map((row) => row.id),
    ).toEqual(["near", "late"]);
  });
});

describe("isOverdueRentalItem", () => {
  const now = new Date("2026-11-25T10:00:00.000Z").getTime();

  it("keeps a customer return request in the overdue queue", () => {
    expect(
      isOverdueRentalItem(
        {
          rentalTo: "2026-11-24T10:00:00.000Z",
          rentalFulfillment: { status: "CUSTOMER_RETURN_REQUESTED" },
        },
        now,
      ),
    ).toBe(true);
  });

  it("does not mark a completed return as overdue", () => {
    expect(
      isOverdueRentalItem(
        {
          rentalTo: "2026-11-24T10:00:00.000Z",
          rentalFulfillment: { status: "RETURNED" },
        },
        now,
      ),
    ).toBe(false);
  });
});
