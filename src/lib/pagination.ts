import { IST_OFFSET_MS, DAY_MS } from "./dates";

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

/** Parse ?page=&limit= with sane bounds. */
export function parsePagination(
  params: URLSearchParams,
  { defaultLimit = 25, maxLimit = 100 }: { defaultLimit?: number; maxLimit?: number } = {}
): PageParams {
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(params.get("limit") || String(defaultLimit), 10) || defaultLimit)
  );
  return { page, limit, skip: (page - 1) * limit };
}

/** Escape user text before using it inside a RegExp / Mongo $regex. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn "YYYY-MM-DD" inputs (IST calendar days, as picked in the admin UI)
 * into a [gte, lt) UTC range. Invalid or empty values are ignored.
 */
export function istDateRange(
  from: string | null,
  to: string | null
): { $gte?: Date; $lt?: Date } | null {
  const parse = (v: string | null): number | null => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const [y, m, d] = v.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d);
    return Number.isNaN(t) ? null : t - IST_OFFSET_MS;
  };
  const start = parse(from);
  const endDay = parse(to);
  if (start === null && endDay === null) return null;
  const range: { $gte?: Date; $lt?: Date } = {};
  if (start !== null) range.$gte = new Date(start);
  if (endDay !== null) range.$lt = new Date(endDay + DAY_MS);
  return range;
}

export function pageMeta(total: number, { page, limit }: PageParams) {
  return { total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}
