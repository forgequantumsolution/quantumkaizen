export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  skip: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '25'), 10)));
  const sortBy = String(query.sortBy || 'createdAt');
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const skip = (page - 1) * limit;

  return { page, limit, sortBy, sortOrder, skip };
}

export function buildPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
