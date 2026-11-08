export interface SafePagination {
  page: number;
  limit: number;
  skip: number;
}

export function clampPagination(
  query?: { page?: number; limit?: number },
  defaultLimit = 20,
  maxLimit = 100,
): SafePagination {
  const rawPage = Number(query?.page);
  const rawLimit = Number(query?.limit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
