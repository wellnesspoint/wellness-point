"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  Search,
  Trash2,
  Send,
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
} from "lucide-react";
import Pagination, { useDebounced } from "@/components/admin/Pagination";
import { downloadCsv } from "@/lib/csv";
import { AUDIENCES, AUDIENCE_LABELS, type Audience } from "@/lib/newsletter-audiences";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

interface Campaign {
  _id: string;
  subject: string;
  status: "scheduled" | "sending" | "done" | "failed" | "cancelled";
  scheduledAt?: string;
  audience?: Audience;
  total: number;
  sent: number;
  failed: number;
  createdBy?: string;
  createdAt: string;
}

interface Subscriber {
  _id: string;
  email: string;
  isActive: boolean;
  subscribedAt: string;
}

export default function AdminNewsletterPage() {
  const confirm = useConfirm();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "unsubscribed">("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1, limit: 25 });
  const [counts, setCounts] = useState({ all: 0, active: 0, unsubscribed: 0 });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [audience, setAudience] = useState<Audience>("all");
  const [scheduleAt, setScheduleAt] = useState(""); // datetime-local value; empty = send now

  const activeCount = counts.active;

  // Send history. Sending runs in the background, so poll while any campaign is in progress.
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const anySending = campaigns.some((c) => c.status === "sending");

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/newsletter/campaigns");
      if (!res.ok) return;
      const d = await res.json();
      setCampaigns(d.campaigns || []);
    } catch {
      // history is informational
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!anySending) return;
    const t = setInterval(loadCampaigns, 3000);
    return () => clearInterval(t);
  }, [anySending, loadCampaigns]);

  const buildQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ status: statusFilter, ...extra });
      if (debouncedSearch.trim()) p.set("q", debouncedSearch.trim());
      return p.toString();
    },
    [statusFilter, debouncedSearch]
  );

  const fetchSubscribers = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/newsletter?${buildQuery({ page: String(page) })}`);
      const d = await res.json();
      if (!res.ok) throw new Error();
      setSubscribers(d.subscribers || []);
      setCounts(d.counts);
      setMeta({ total: d.total, pages: d.pages, limit: d.limit });
      setChecked(new Set());
    } catch {
      toast.error("Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }, [buildQuery, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const filtered = subscribers;

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (action: "delete" | "unsubscribe" | "resubscribe") => {
    if (checked.size === 0) return;
    if (action === "delete" && !(await confirm(`Delete ${checked.size} subscriber(s)?`))) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/newsletter/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checked], action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(`${d.affected} subscriber(s) updated`);
      await fetchSubscribers();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/admin/newsletter?${buildQuery({ all: "1" })}`);
      const d = await res.json();
      if (!res.ok) throw new Error();
      downloadCsv(
        `subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Email", "Status", "Subscribed"],
        (d.subscribers as Subscriber[]).map((x) => [
          x.email,
          x.isActive !== false ? "Active" : "Unsubscribed",
          x.subscribedAt ? new Date(x.subscribedAt).toISOString().slice(0, 10) : "",
        ])
      );
    } catch {
      toast.error("Export failed");
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!(await confirm(`Delete ${email} from newsletter?`))) return;
    try {
      const res = await fetch("/api/admin/newsletter", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Subscriber deleted");
        fetchSubscribers();
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    let scheduledAt: string | undefined;
    if (scheduleAt) {
      const when = new Date(scheduleAt);
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) {
        toast.error("Pick a time in the future");
        return;
      }
      scheduledAt = when.toISOString();
    }

    if (
      !(await confirm(
        scheduledAt
          ? `Schedule this newsletter (${AUDIENCE_LABELS[audience]}) for ${new Date(scheduledAt).toLocaleString("en-IN")}? It is sent by the daily job, at its first run after that time.`
          : audience === "all"
            ? `Send this newsletter to ${activeCount} active subscriber${activeCount !== 1 ? "s" : ""}?`
            : `Send this newsletter now to: ${AUDIENCE_LABELS[audience]}?`,
        { danger: false, confirmLabel: scheduledAt ? "Schedule" : "Send newsletter", title: scheduledAt ? "Schedule newsletter" : "Send newsletter" }
      ))
    )
      return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), audience, scheduledAt }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Newsletter is being sent");
        loadCampaigns();
        setSubject("");
        setBody("");
        setScheduleAt("");
        setComposeOpen(false);
        setPreview(false);
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Newsletter Subscribers</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Newsletter ({counts.all})
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposeOpen(!composeOpen)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <Send className="h-4 w-4" />
            Compose
            {composeOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Compose Section */}
      {composeOpen && (
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <h2 className="text-lg font-semibold text-foreground">
              Compose Newsletter
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="nl-audience" className="mb-1 block text-sm font-medium text-foreground">Audience</label>
                <select
                  id="nl-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  disabled={sending}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeCount} active subscriber{activeCount !== 1 ? "s" : ""} in total.
                </p>
              </div>
              <div>
                <label htmlFor="nl-when" className="mb-1 block text-sm font-medium text-foreground">
                  Send later <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="nl-when"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  disabled={sending}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave empty to send now. Scheduled newsletters go out in the daily job (9:00 AM IST), at its first run after the time you pick.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. New Arrivals This Week!"
                disabled={sending}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Body{" "}
                <span className="font-normal text-muted-foreground">
                  (plain text — newlines become line breaks)
                </span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                disabled={sending}
                placeholder="Write your newsletter content here..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Preview */}
            {preview && body.trim() && (
              <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Preview
                </p>
                <h3 className="mb-2 text-lg font-semibold text-emerald-800">
                  {subject || "(No subject)"}
                </h3>
                <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                  {body}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Sending..." : "Send Newsletter"}
              </button>

              <button
                onClick={() => setPreview(!preview)}
                disabled={!body.trim()}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                <Eye className="h-4 w-4" />
                {preview ? "Hide Preview" : "Preview"}
              </button>

              <button
                onClick={() => {
                  setComposeOpen(false);
                  setPreview(false);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "unsubscribed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f
                  ? "bg-wellness-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
          <button
            onClick={exportCsv}
            className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
          <span className="px-1 font-medium">{checked.size} selected</span>
          <button disabled={bulkBusy} onClick={() => bulk("unsubscribe")} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Unsubscribe</button>
          <button disabled={bulkBusy} onClick={() => bulk("resubscribe")} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Resubscribe</button>
          <button disabled={bulkBusy} onClick={() => bulk("delete")} className="rounded-lg border px-3 py-1.5 text-red-600 hover:bg-red-50">Delete</button>
          <button onClick={() => setChecked(new Set())} className="rounded-lg px-3 py-1.5 hover:bg-accent">Clear</button>
        </div>
      )}

      {/* Subscriber Table */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Mail className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No subscribers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="w-8 pb-3">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((x) => checked.has(x._id))}
                    onChange={() =>
                      setChecked(
                        filtered.every((x) => checked.has(x._id))
                          ? new Set()
                          : new Set(filtered.map((x) => x._id))
                      )
                    }
                    aria-label="Select all subscribers on this page"
                    className="h-4 w-4"
                  />
                </th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Subscribed</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((sub) => (
                <tr key={sub._id} className="hover:bg-accent">
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={checked.has(sub._id)}
                      onChange={() => toggleChecked(sub._id)}
                      aria-label={`Select ${sub.email}`}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="py-3 font-medium text-foreground">
                    {sub.email}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        sub.isActive !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {sub.isActive !== false ? "Active" : "Unsubscribed"}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {new Date(sub.subscribedAt || sub._id).toLocaleDateString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      }
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDelete(sub._id, sub.email)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Delete subscriber"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pages={meta.pages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={setPage}
      />

      {/* Send history */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <h2 className="mb-3 text-base font-semibold text-foreground">Send history</h2>
          {campaigns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No newsletters sent yet</p>
          ) : (
            <ul className="divide-y">
              {campaigns.map((c) => {
                const done = c.sent + c.failed;
                const pct = c.total > 0 ? Math.min(100, Math.round((done / c.total) * 100)) : 0;
                return (
                  <li key={c._id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{c.subject}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.status === "done"
                            ? "bg-green-100 text-green-700"
                            : c.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : c.status === "scheduled"
                                ? "bg-amber-100 text-amber-800"
                                : c.status === "cancelled"
                                  ? "bg-gray-100 text-gray-600"
                                  : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {c.status === "sending"
                          ? `Sending… ${pct}%`
                          : c.status === "done"
                            ? "Sent"
                            : c.status === "scheduled"
                              ? "Scheduled"
                              : c.status === "cancelled"
                                ? "Cancelled"
                                : "Failed"}
                      </span>
                    </div>
                    {c.status === "scheduled" && c.scheduledAt && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-amber-800">
                          Goes out after {new Date(c.scheduledAt).toLocaleString("en-IN")}
                          {c.audience && c.audience !== "all" ? ` · ${AUDIENCE_LABELS[c.audience]}` : ""}
                        </span>
                        <button
                          className="rounded border px-2 py-0.5 hover:bg-accent"
                          onClick={async () => {
                            if (!(await confirm("Cancel this scheduled newsletter?"))) return;
                            const res = await fetch("/api/admin/newsletter/campaigns", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: c._id, action: "cancel" }),
                            });
                            const d = await res.json().catch(() => ({}));
                            if (res.ok) toast.success("Cancelled");
                            else toast.error(d.error || "Could not cancel");
                            loadCampaigns();
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                      {c.createdBy ? ` · by ${c.createdBy}` : ""} · {c.sent} delivered
                      {c.failed > 0 ? `, ${c.failed} failed` : ""} of {c.total}
                    </p>
                    {c.status === "sending" && (
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
