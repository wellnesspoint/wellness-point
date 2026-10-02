import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { can, effectiveRole, canViewPage, ADMIN_ROLES } from "@/lib/permissions";

describe("permissions matrix", () => {
  it("treats admins without a role (pre-roles accounts) as owners", () => {
    expect(effectiveRole(undefined)).toBe("owner");
    expect(effectiveRole(null)).toBe("owner");
    expect(effectiveRole("nonsense")).toBe("owner");
    expect(can(undefined, "team", "manage")).toBe(true);
  });

  it("owner can do everything; only owner manages the team", () => {
    expect(can("owner", "refunds", "manage")).toBe(true);
    expect(can("manager", "team", "view")).toBe(false);
    expect(can("support", "team", "view")).toBe(false);
    expect(can("content", "team", "manage")).toBe(false);
  });

  it("manager runs the store but only views settings, reports and audit", () => {
    expect(can("manager", "orders", "manage")).toBe(true);
    expect(can("manager", "refunds", "manage")).toBe(true);
    expect(can("manager", "settings", "view")).toBe(true);
    expect(can("manager", "settings", "manage")).toBe(false);
    expect(can("manager", "audit", "manage")).toBe(false);
  });

  it("support can answer customers but not refund or edit orders/products", () => {
    expect(can("support", "contacts", "manage")).toBe(true);
    expect(can("support", "reviews", "manage")).toBe(true);
    expect(can("support", "orders", "view")).toBe(true);
    expect(can("support", "orders", "manage")).toBe(false);
    expect(can("support", "refunds", "view")).toBe(false);
    expect(can("support", "reports", "view")).toBe(false);
    expect(can("support", "coupons", "view")).toBe(false);
  });

  it("content role edits content and reviews but cannot see revenue, coupons or customers", () => {
    expect(can("content", "content", "manage")).toBe(true);
    expect(can("content", "marketing", "manage")).toBe(true);
    expect(can("content", "products", "manage")).toBe(false);
    expect(can("content", "reports", "view")).toBe(false);
    expect(can("content", "customers", "view")).toBe(false);
  });

  it("every role may manage its own security settings and see the dashboard", () => {
    for (const r of ADMIN_ROLES) {
      expect(can(r, "self", "manage")).toBe(true);
      expect(can(r, "dashboard", "view")).toBe(true);
    }
  });

  it("maps pages to areas for navigation", () => {
    expect(canViewPage("support", "/admin/orders")).toBe(true);
    expect(canViewPage("support", "/admin/reports")).toBe(false);
    expect(canViewPage("content", "/admin/blogs")).toBe(true);
    expect(canViewPage("manager", "/admin/team")).toBe(false);
    expect(canViewPage("owner", "/admin/team")).toBe(true);
    expect(canViewPage("support", "/admin")).toBe(true);
  });
});

// --- checkAdmin enforcement -------------------------------------------------
const verifyAdminToken = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ verifyAdminToken: () => verifyAdminToken() }));

describe("checkAdmin", () => {
  beforeEach(() => verifyAdminToken.mockReset());

  it("returns null when not signed in", async () => {
    const { checkAdmin } = await import("@/lib/admin");
    verifyAdminToken.mockResolvedValue(null);
    expect(await checkAdmin("orders", "view")).toBeNull();
  });

  it("returns null when the role lacks the area/level, a session when allowed", async () => {
    const { checkAdmin } = await import("@/lib/admin");
    verifyAdminToken.mockResolvedValue({ id: "1", adminRole: "support" });
    expect(await checkAdmin("orders", "manage")).toBeNull();
    expect(await checkAdmin("orders", "view")).not.toBeNull();
    expect(await checkAdmin()).not.toBeNull(); // no area = any signed-in admin
  });
});

// --- refund gating on the order route ----------------------------------------
describe("team routes", () => {
  it("rejects a non-owner adding a team member", async () => {
    vi.resetModules();
    vi.doMock("@/lib/admin-auth", () => ({
      verifyAdminToken: async () => ({ id: "1", email: "m@x.test", name: "M", role: "admin", adminRole: "manager" }),
    }));
    vi.doMock("@/lib/db", () => ({ default: async () => {} }));
    vi.doMock("@/models/User", () => ({ default: {} }));
    vi.doMock("@/lib/audit", () => ({ logAudit: async () => {} }));
    const { POST } = await import("@/app/api/admin/team/route");
    const res = await POST(
      new NextRequest("http://x.test/api/admin/team", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.test", adminRole: "owner" }),
      })
    );
    expect(res.status).toBe(403);
  });
});
