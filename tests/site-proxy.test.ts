import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { parseRedirect, matchRedirect, normalizePath, isProtectedPath } from "@/lib/redirects";

describe("redirect rules", () => {
  it("normalizes paths (case, query, trailing and double slashes)", () => {
    expect(normalizePath("/Shop/")).toBe("/shop");
    expect(normalizePath("old//page?x=1#y")).toBe("/old/page");
    expect(normalizePath("/")).toBe("/");
  });

  it("accepts internal and https targets, defaults to permanent", () => {
    expect(parseRedirect({ from: "/Old-Page/", to: "/new-page" })).toEqual({
      ok: true, from: "/old-page", to: "/new-page", permanent: true,
    });
    expect(parseRedirect({ from: "/a", to: "https://example.com/x", permanent: false })).toMatchObject({ ok: true, permanent: false });
  });

  it("rejects protected sources, self-redirects, bad targets and external sources", () => {
    expect(parseRedirect({ from: "/admin", to: "/x" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "/api/payment/webhook", to: "/x" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "/a", to: "/A/" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "/a", to: "http://insecure.test" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "/a", to: "//evil.test" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "/a", to: "javascript:alert(1)" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "https://x.test/a", to: "/b" })).toMatchObject({ ok: false });
    expect(parseRedirect({ from: "", to: "/b" })).toMatchObject({ ok: false });
  });

  it("matches request paths case-insensitively and never matches protected paths", () => {
    const rules = [{ from: "/old", to: "/new", permanent: true }, { from: "/admin", to: "/x", permanent: true }];
    expect(matchRedirect("/OLD/", rules)?.to).toBe("/new");
    expect(matchRedirect("/other", rules)).toBeUndefined();
    expect(matchRedirect("/admin", rules)).toBeUndefined();
    expect(isProtectedPath("/api/anything")).toBe(true);
    expect(isProtectedPath("/offline")).toBe(true); // the service worker precaches it
    expect(isProtectedPath("/shop")).toBe(false);
  });
});

// --- proxy behaviour ----------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true }),
  getClientIp: () => "1.1.1.1",
}));
vi.mock("next-auth/jwt", () => ({ getToken: async () => null }));

const status = (over: Record<string, unknown> = {}) => ({
  maintenance: { on: false },
  redirects: [{ from: "/old-product", to: "/product/new", permanent: true }],
  ...over,
});

async function runProxy(path: string, opts: { method?: string; cookie?: string; status?: unknown; fail?: boolean } = {}) {
  vi.resetModules();
  const fetchMock = vi.fn(async () => {
    if (opts.fail) throw new Error("down");
    return new Response(JSON.stringify(opts.status ?? status()), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { proxy } = await import("@/proxy");
  const req = new NextRequest(`http://shop.test${path}`, {
    method: opts.method ?? "GET",
    headers: opts.cookie ? { cookie: opts.cookie } : undefined,
  });
  return { res: await proxy(req), fetchMock };
}

describe("proxy storefront handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("redirects a matching old URL with 301", async () => {
    const { res } = await runProxy("/old-product");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("http://shop.test/product/new");
  });

  it("does not put the offline page behind the maintenance screen", async () => {
    const { res } = await runProxy("/offline", { status: status({ maintenance: { on: true } }) });
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("passes normal pages through when not in maintenance", async () => {
    const { res } = await runProxy("/shop");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("serves the maintenance page (503, no-store) to visitors when maintenance is on", async () => {
    const { res } = await runProxy("/shop", { status: status({ maintenance: { on: true } }) });
    expect(res.status).toBe(503);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/maintenance");
    expect(res.headers.get("retry-after")).toBe("3600");
  });

  it("never blocks APIs (payment webhook), admin pages, or non-GET requests during maintenance", async () => {
    const on = status({ maintenance: { on: true } });
    expect((await runProxy("/api/payment/webhook", { status: on, method: "POST" })).res.headers.get("x-middleware-rewrite")).toBeNull();
    expect((await runProxy("/api/products", { status: on })).res.headers.get("x-middleware-rewrite")).toBeNull();
    expect((await runProxy("/checkout", { status: on, method: "POST" })).res.headers.get("x-middleware-rewrite")).toBeNull();
    const admin = await runProxy("/admin/login", { status: on });
    expect(admin.res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("lets a signed-in admin (admin-token cookie) browse the store during maintenance", async () => {
    const { res } = await runProxy("/shop", { status: status({ maintenance: { on: true } }), cookie: "admin-token=abc" });
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("fails open: if the status cannot be read the store works normally", async () => {
    const { res } = await runProxy("/shop", { fail: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not call the status endpoint for itself (no recursion)", async () => {
    const { fetchMock } = await runProxy("/api/site-status");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still enforces the admin cookie on admin pages and APIs", async () => {
    const page = await runProxy("/admin/orders");
    expect(page.res.status).toBe(307);
    expect(page.res.headers.get("location")).toContain("/admin/login");
    const api = await runProxy("/api/admin/orders");
    expect(api.res.status).toBe(403);
  });
});
