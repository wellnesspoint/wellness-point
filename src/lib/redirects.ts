/**
 * Redirect rules: validation (admin API) and matching (proxy). Pure functions.
 */
export interface RedirectRule {
  from: string;
  to: string;
  permanent: boolean;
}

/** Paths that can never be redirected: they would lock the owner out or break the site. */
const PROTECTED_PREFIXES = ["/admin", "/api", "/_next", "/maintenance", "/offline"];

/** Lower-case, drop query/hash and any trailing slash ("/Shop/" -> "/shop"). */
export function normalizePath(input: string): string {
  let p = input.trim().split(/[?#]/)[0].toLowerCase();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

export function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export function parseRedirect(
  input: { from?: unknown; to?: unknown; permanent?: unknown }
): { ok: true; from: string; to: string; permanent: boolean } | { ok: false; error: string } {
  const rawFrom = String(input.from ?? "").trim();
  const rawTo = String(input.to ?? "").trim();
  if (!rawFrom || !rawTo) return { ok: false, error: "Both the old and the new address are required" };
  if (rawFrom.length > 200 || rawTo.length > 500) return { ok: false, error: "Address is too long" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawFrom)) {
    return { ok: false, error: "The old address must be a path on this site, like /old-page" };
  }

  const from = normalizePath(rawFrom);
  if (isProtectedPath(from)) {
    return { ok: false, error: "Admin, API and system pages cannot be redirected" };
  }

  const to = rawTo;
  if (/^https:\/\//i.test(to)) {
    try {
      new URL(to);
    } catch {
      return { ok: false, error: "The new address is not a valid URL" };
    }
  } else if (to.startsWith("/") && !to.startsWith("//")) {
    // keep case and any query string of an internal target as typed
    if (normalizePath(to) === from) return { ok: false, error: "A page cannot redirect to itself" };
  } else {
    return { ok: false, error: "The new address must start with / or https://" };
  }

  return { ok: true, from, to, permanent: input.permanent === undefined ? true : Boolean(input.permanent) };
}

/** First matching rule for a request path, or undefined. */
export function matchRedirect(pathname: string, rules: RedirectRule[]): RedirectRule | undefined {
  const path = normalizePath(pathname);
  if (isProtectedPath(path)) return undefined;
  return rules.find((r) => r.from === path);
}
