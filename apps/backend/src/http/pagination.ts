import { z } from "zod";

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Pagination = {
  limit: number;
  offset: number;
};

export type PaginatedResult<T> = {
  items: T[];
  page: Pagination & {
    total: number;
    returned: number;
    hasMore: boolean;
  };
};

export function parsePaginationQuery(input: unknown): Pagination {
  return paginationQuerySchema.parse(input);
}

export function paginateItems<T>(items: T[], pagination: Pagination): PaginatedResult<T> {
  const sliced = items.slice(pagination.offset, pagination.offset + pagination.limit);
  return {
    items: sliced,
    page: {
      ...pagination,
      total: items.length,
      returned: sliced.length,
      hasMore: pagination.offset + sliced.length < items.length,
    },
  };
}