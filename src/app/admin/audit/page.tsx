"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { History, Search, Download } from "lucide-react";
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import Pagination, { useDebounced } from "@/components/admin/Pagination";

interface AuditLogItem {
  _id: string;
  actor?: { name?: string; email?: string };
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  createdAt: string;
}

const ENTITIES = [
  { value: "all", label: "Everything" },
  { value: "order", label: "Orders" },
  { value: "product", label: "Products" },
  { value: "user", label: "Customers" },
  { value: "coupon", label: "Coupons" },
  { value: "shipping", label: "Shipping" },
  { value: "settings", label: "Settings" },
  { value: "banner", label: "Banners" },
  { value: "newsletter", label: "Newsletter" },
  { value: "admin", label: "Admin sign-ins & 2FA" },
  { value: "review", label: "Reviews" },
  { value: "contact", label: "Contact messages" },
  { value: "subscriber", label: "Subscribers" },
  { value: "category", label: "Categories" },
  { value: "redirect", label: "Redirects" },
];

// Where to look at the thing a log entry is about.
const ENTITY_LINKS: Record<string, string> = {
  order: "/admin/orders",
  product: "/admin/products",
  user: "/admin/customers",
  coupon: "/admin/coupons",
  shipping: "/admin/shipping",
  settings: "/admin/settings",
  banner: "/admin/marketing",
  newsletter: "/admin/newsletter",
  review: "/admin/reviews",
  contact: "/admin/contacts",
  subscriber: "/admin/newsletter",
  category: "/admin/categories",
  redirect: "/admin/site",
};

const actionColor = (action: string) => {
  if (/(refund|delete|archive|disable|bulk)/.test(action)) return "bg-red-100 text-red-700";
  if (/(create|enable|restore|login)/.test(action)) return "bg-green-100 text-green-700";
  return "bg-blue-100 text-blue-700";
};

const PAGE_SIZE = 30;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("");
  const [actors, setActors] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const requestId = useRef(0);

  const fetchLogs = useCallback(async () => {
    const id = ++requestId.current;
    setFetching(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), entity });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (actor) params.set("actor", actor);
      const res = await fetch(`/api/admin/audit?${params}`);
      const d = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(d.error || "Failed to load audit log");
      setLogs(d.logs || []);
      setActors(d.actors || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
    } catch (err) {
      if (id === requestId.current) toast.error(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      if (id === requestId.current) {
        setFetching(false);
        setInitialLoading(false);
      }
    }
  }, [page, entity, debouncedSearch, from, to, actor]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({ all: "1", entity });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (actor) params.set("actor", actor);
      const res = await fetch(`/api/admin/audit?${params}`);
      const d = await res.json();
      if (!res.ok) throw new Error();
      downloadCsv(
        `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        ["When", "Admin", "Email", "Action", "Area", "Reference", "Details"],
        (d.logs as AuditLogItem[]).map((l) => [
          new Date(l.createdAt).toISOString(),
          l.actor?.name ?? "system",
          l.actor?.email ?? "",
          l.action,
          l.entity,
          l.entityId ?? "",
          l.summary,
        ])
      );
    } catch {
      toast.error("Export failed");
    }
  };

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Who changed what — refunds, price and stock edits, status changes, role changes and more. Kept for one year.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search action, admin, details..."
            value={search}
            onChange={(e) => reset(() => setSearch(e.target.value))}
            className="pl-9"
          />
        </div>
        <select
          value={entity}
          onChange={(e) => reset(() => setEntity(e.target.value))}
          className="rounded-lg border bg-background px-3 text-sm"
          aria-label="Filter by area"
        >
          {ENTITIES.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          value={actor}
          onChange={(e) => reset(() => setActor(e.target.value))}
          className="rounded-lg border bg-background px-3 text-sm"
          aria-label="Filter by admin"
        >
          <option value="">Every admin</option>
          <option value="system">System (automatic)</option>
          {actors.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="w-36" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} className="w-36" />
        </div>
        <Button variant="outline" size="sm" className="h-10" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <History className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No activity found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log._id} className="border-0 shadow-sm">
              <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      by {log.actor?.name || log.actor?.email || "system"}
                    </span>
                    {ENTITY_LINKS[log.entity] && (
                      <Link href={ENTITY_LINKS[log.entity]} className="text-xs text-emerald-700 hover:underline">
                        {log.entity}
                        {log.entityId ? ` ${log.entityId.slice(-6).toUpperCase()}` : ""} →
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 break-words text-sm text-foreground">{log.summary}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("en-IN", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={fetching} />
    </div>
  );
}
