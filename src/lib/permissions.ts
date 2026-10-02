/**
 * Admin roles and permissions: one place that defines what each staff role can
 * do. `User.adminRole` holds the role; admins created before roles existed have
 * none and are treated as owners so nobody is locked out by the upgrade.
 *
 * Enforced server-side by `checkAdmin(area, level)` in lib/admin.ts (every
 * /api/admin route passes the area it belongs to). The admin UI uses the same
 * table only to hide navigation the person could not use anyway.
 */
export const ADMIN_ROLES = ["owner", "manager", "support", "content"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Area =
  | "dashboard"
  | "orders"
  | "refunds"
  | "products"
  | "inventory"
  | "customers"
  | "reviews"
  | "contacts"
  | "content"
  | "marketing"
  | "coupons"
  | "shipping"
  | "settings"
  | "reports"
  | "audit"
  | "team"
  | "self";

export type Level = "view" | "manage";

type Matrix = Partial<Record<Area, Level>>;

const ALL_MANAGE: Matrix = {
  dashboard: "manage", orders: "manage", refunds: "manage", products: "manage",
  inventory: "manage", customers: "manage", reviews: "manage", contacts: "manage",
  content: "manage", marketing: "manage", coupons: "manage", shipping: "manage",
  settings: "manage", reports: "manage", audit: "manage", team: "manage", self: "manage",
};

export const ROLE_PERMISSIONS: Record<AdminRole, Matrix> = {
  owner: ALL_MANAGE,
  manager: {
    ...ALL_MANAGE,
    settings: "view",
    reports: "view",
    audit: "view",
    team: undefined,
  },
  support: {
    dashboard: "view",
    orders: "view",
    customers: "view",
    products: "view",
    reviews: "manage",
    contacts: "manage",
    self: "manage",
  },
  content: {
    dashboard: "view",
    products: "view",
    content: "manage",
    reviews: "manage",
    marketing: "manage",
    self: "manage",
  },
};

export const ROLE_LABELS: Record<AdminRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full access, including team, settings and security" },
  manager: { label: "Manager", description: "Runs the store: orders, refunds, products, customers, marketing. Cannot manage the team" },
  support: { label: "Support", description: "Answers customers: contacts and reviews. Views orders and customers, no refunds" },
  content: { label: "Content", description: "Blogs, testimonials, banners, newsletter and reviews. Views products" },
};

/** Admins from before roles existed have no adminRole: treat them as owners. */
export function effectiveRole(adminRole?: string | null): AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(adminRole ?? "")
    ? (adminRole as AdminRole)
    : "owner";
}

export function can(adminRole: string | null | undefined, area: Area, level: Level = "view"): boolean {
  const granted = ROLE_PERMISSIONS[effectiveRole(adminRole)][area];
  if (!granted) return false;
  return level === "view" ? true : granted === "manage";
}

/** Which area an admin *page* belongs to, for hiding nav and blocking direct visits. */
const PAGE_AREAS: [string, Area][] = [
  ["/admin/products", "products"],
  ["/admin/inventory", "inventory"],
  ["/admin/categories", "products"],
  ["/admin/orders", "orders"],
  ["/admin/abandoned", "orders"],
  ["/admin/payments", "orders"],
  ["/admin/customers", "customers"],
  ["/admin/reviews", "reviews"],
  ["/admin/contacts", "contacts"],
  ["/admin/blogs", "content"],
  ["/admin/testimonials", "content"],
  ["/admin/marketing", "content"],
  ["/admin/site", "content"],
  ["/admin/newsletter", "marketing"],
  ["/admin/coupons", "coupons"],
  ["/admin/shipping", "shipping"],
  ["/admin/reports", "reports"],
  ["/admin/audit", "audit"],
  ["/admin/settings", "settings"],
  ["/admin/security", "self"],
  ["/admin/team", "team"],
];

export function areaForPage(pathname: string): Area {
  const hit = PAGE_AREAS.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? hit[1] : "dashboard";
}

export function canViewPage(adminRole: string | null | undefined, pathname: string): boolean {
  return can(adminRole, areaForPage(pathname), "view");
}
