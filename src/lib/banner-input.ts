const POSITIONS = ["hero", "promo", "sidebar"];

/** Image/link URLs must be https or site-relative — blocks `javascript:` links. */
function isSafeUrl(v: string): boolean {
  return /^https:\/\//i.test(v) || (v.startsWith("/") && !v.startsWith("//"));
}

/**
 * Whitelist + validate banner input (the routes used to pass the raw request
 * body straight to Mongoose). On create all of title/imageUrl are required; on
 * update only the supplied fields are touched. An empty/null date clears it.
 */
export function parseBanner(
  body: any,
  creating: boolean
): { data: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };
  const data: Record<string, unknown> = {};

  if (body.title !== undefined || creating) {
    const title = String(body.title ?? "").trim();
    if (!title) return { error: "Title is required" };
    data.title = title.slice(0, 120);
  }
  if (body.subtitle !== undefined) data.subtitle = String(body.subtitle).trim().slice(0, 200);

  if (body.imageUrl !== undefined || creating) {
    const imageUrl = String(body.imageUrl ?? "").trim();
    if (!imageUrl) return { error: "Image URL is required" };
    if (!isSafeUrl(imageUrl)) return { error: "Image URL must start with https:// or /" };
    data.imageUrl = imageUrl;
  }
  if (body.linkUrl !== undefined) {
    const linkUrl = String(body.linkUrl ?? "").trim();
    if (linkUrl && !isSafeUrl(linkUrl)) return { error: "Link URL must start with https:// or /" };
    data.linkUrl = linkUrl;
  }
  if (body.position !== undefined) {
    if (!POSITIONS.includes(body.position)) return { error: "Invalid position" };
    data.position = body.position;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return { error: "isActive must be true or false" };
    data.isActive = body.isActive;
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) return { error: "Sort order must be a number" };
    data.sortOrder = Math.trunc(n);
  }
  for (const key of ["startDate", "endDate"] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      data[key] = null;
      continue;
    }
    const d = new Date(body[key]);
    if (Number.isNaN(d.getTime())) return { error: `Invalid ${key}` };
    data[key] = d;
  }
  if (data.startDate instanceof Date && data.endDate instanceof Date && data.endDate < data.startDate) {
    return { error: "End date can't be before the start date" };
  }
  return { data };
}
