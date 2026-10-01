/**
 * Whitelist + validate coupon input from the admin form. On create, code/type/value
 * are required; on update only the supplied fields are touched (the code itself is
 * immutable once created). Empty/null dates clear them.
 */
export function parseCoupon(
  body: any,
  creating: boolean
): { data: Record<string, unknown> } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };
  const data: Record<string, unknown> = {};

  if (creating) {
    const code = String(body.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      return { error: "Code must be 3-30 characters: letters, numbers, - or _" };
    }
    data.code = code;
  }

  if (creating || body.type !== undefined) {
    if (body.type !== "percent" && body.type !== "fixed") {
      return { error: "Type must be percent or fixed" };
    }
    data.type = body.type;
  }

  if (creating || body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) return { error: "Discount value must be greater than 0" };
    data.value = Math.round(value * 100) / 100;
  }

  // percent must be ≤ 100 (checked against the effective type by the caller too)
  if (data.type === "percent" && (data.value as number) > 100) {
    return { error: "A percentage discount can't exceed 100" };
  }

  for (const key of ["minOrder", "maxDiscount"] as const) {
    if (body[key] === undefined) continue;
    const n = body[key] === "" || body[key] === null ? 0 : Number(body[key]);
    if (!Number.isFinite(n) || n < 0) return { error: `${key} must be 0 or more` };
    data[key] = Math.round(n * 100) / 100;
  }
  for (const key of ["usageLimit", "perUserLimit"] as const) {
    if (body[key] === undefined) continue;
    const n = body[key] === "" || body[key] === null ? 0 : Number(body[key]);
    if (!Number.isInteger(n) || n < 0) return { error: `${key} must be a whole number, 0 or more` };
    data[key] = n;
  }

  if (body.description !== undefined) data.description = String(body.description).trim().slice(0, 200);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") return { error: "isActive must be true or false" };
    data.isActive = body.isActive;
  }

  for (const key of ["startsAt", "expiresAt"] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      data[key] = null;
      continue;
    }
    const d = new Date(body[key]);
    if (Number.isNaN(d.getTime())) return { error: `Invalid ${key}` };
    data[key] = d;
  }
  if (data.startsAt instanceof Date && data.expiresAt instanceof Date && data.expiresAt <= data.startsAt) {
    return { error: "Expiry must be after the start date" };
  }
  return { data };
}
