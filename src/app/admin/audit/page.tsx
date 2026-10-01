"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { History, Search } from "lucide-react";
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
];

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
      const res = await fetch(`/api/admin/audit?${params}`);
      const d = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(d.error || "Failed to load audit log");
      setLogs(d.logs || []);
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
  }, [page, entity, debouncedSearch, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="w-36" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} className="w-36" />
        </div>
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
