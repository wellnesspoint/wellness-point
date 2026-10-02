"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import { useEffect, useState, useCallback } from "react";
import Pagination, { useDebounced } from "@/components/admin/Pagination";
import { downloadCsv } from "@/lib/csv";
import {
  MessageSquare,
  Mail,
  Eye,
  Trash2,
  Send,
  ArrowLeft,
  RefreshCw,
  Search,
  Archive,
  CheckCircle,
  Clock,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { CONTACT_REPLIES, fillReply } from "@/lib/canned-replies";

interface Contact {
  _id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  adminReply?: string;
  adminRepliedAt?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  assignedTo?: { id: string; name?: string; email?: string };
  internalNotes?: { text: string; by?: string; at: string }[];
  createdAt: string;
}

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function ContactsPage() {
  const confirm = useConfirm();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [filter, setFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assignees, setAssignees] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1, limit: 20 });
  const [statusCounts, setStatusCounts] = useState({ all: 0, new: 0, read: 0, replied: 0, archived: 0 });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const buildQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const p = new URLSearchParams({ status: filter, ...extra });
      if (debouncedSearch.trim()) p.set("q", debouncedSearch.trim());
      if (assigneeFilter) p.set("assignee", assigneeFilter);
      if (priorityFilter) p.set("priority", priorityFilter);
      return p.toString();
    },
    [filter, debouncedSearch, assigneeFilter, priorityFilter]
  );

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/contacts?${buildQuery({ page: String(page) })}`);
      const json = await res.json();
      if (!res.ok) throw new Error();
      setContacts(json.contacts || []);
      setStatusCounts(json.counts);
      setAssignees(json.assignees || []);
      setMeta({ total: json.total, pages: json.pages, limit: json.limit });
      setChecked(new Set());
    } catch (err) {
      console.error("Failed to load contacts:", err);
      toast.error("Failed to load messages");
    }
    setLoading(false);
  }, [buildQuery, page]);

  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch, assigneeFilter, priorityFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Priority / assignment / internal note on one message; keeps the open message and the list in sync.
  const updateContact = async (id: string, patch: Record<string, unknown>, okMsg?: string) => {
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      setContacts((prev) => prev.map((c) => (c._id === id ? json.contact : c)));
      setSelected((cur) => (cur && cur._id === id ? json.contact : cur));
      if (okMsg) toast.success(okMsg);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      return false;
    }
  };

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (action: "read" | "new" | "archived" | "delete") => {
    if (checked.size === 0) return;
    if (action === "delete" && !(await confirm(`Delete ${checked.size} message(s) permanently?`))) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checked], action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`${json.affected} message(s) updated`);
      await fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`/api/admin/contacts?${buildQuery({ all: "1" })}`);
      const json = await res.json();
      if (!res.ok) throw new Error();
      downloadCsv(
        `contact-messages-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Date", "Name", "Email", "Phone", "Subject", "Message", "Status", "Reply"],
        (json.contacts as Contact[]).map((c) => [
          new Date(c.createdAt).toISOString().slice(0, 10),
          c.name, c.email, c.phone, c.subject, c.message, c.status, c.adminReply ?? "",
        ])
      );
    } catch {
      toast.error("Export failed");
    }
  };

  const markAsRead = async (contact: Contact) => {
    if (contact.status === "new") {
      try {
        await fetch(`/api/admin/contacts/${contact._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "read" }),
        });
        setContacts((prev) =>
          prev.map((c) =>
            c._id === contact._id ? { ...c, status: "read" } : c
          )
        );
        setStatusCounts((n) => ({ ...n, new: Math.max(0, n.new - 1), read: n.read + 1 }));
      } catch (err) {
        console.error("Mark read error:", err);
      }
    }
  };

  const viewContact = (contact: Contact) => {
    setSelected(contact);
    setReplyText("");
    markAsRead(contact);
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/contacts/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply: replyText.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setContacts((prev) =>
          prev.map((c) =>
            c._id === selected._id ? json.contact : c
          )
        );
        toast.success("Reply sent!");
        setSelected(null);
        fetchContacts();
      }
    } catch (err) {
      console.error("Reply error:", err);
    }
    setSending(false);
  };

  const handleArchive = async (id: string) => {
    try {
      await fetch(`/api/admin/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      setContacts((prev) =>
        prev.map((c) =>
          c._id === id ? { ...c, status: "archived" as const } : c
        )
      );
      if (selected?._id === id) setSelected(null);
      fetchContacts();
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this query permanently?"))) return;
    try {
      await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
      if (selected?._id === id) setSelected(null);
      fetchContacts();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filtered = contacts;

  const statusColors: Record<string, string> = {
    new: "bg-red-100 text-red-700",
    read: "bg-blue-100 text-blue-700",
    replied: "bg-emerald-100 text-emerald-700",
    archived: "bg-gray-100 text-gray-600",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    new: <Clock className="h-3 w-3" />,
    read: <Eye className="h-3 w-3" />,
    replied: <CheckCircle className="h-3 w-3" />,
    archived: <Archive className="h-3 w-3" />,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Detail View
  if (selected) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => setSelected(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Queries
        </Button>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-foreground text-xl">
                  {selected.subject}
                </CardTitle>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${statusColors[selected.status]}`}
                  >
                    {statusIcons[selected.status]}
                    {selected.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selected.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchive(selected._id)}
                >
                  <Archive className="h-4 w-4 mr-1" /> Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selected._id)}
                  className="border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sender Info */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">From:</span>
                <span className="text-foreground font-medium">{selected.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <a
                  href={`mailto:${selected.email}`}
                  className="text-emerald-600 hover:underline"
                >
                  {selected.email}
                </a>
              </div>
              {selected.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">📞</span>
                  <a
                    href={`tel:${selected.phone}`}
                    className="text-emerald-600 hover:underline"
                  >
                    {selected.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Message
              </h3>
              <div className="bg-muted rounded-lg p-4 text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </div>
            </div>

            {/* Admin Reply (existing) */}
            {selected.adminReply && (
              <div>
                <h3 className="text-sm font-medium text-emerald-600 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Your Reply
                  {selected.adminRepliedAt && (
                    <span className="text-xs text-muted-foreground font-normal">
                      — {new Date(selected.adminRepliedAt).toLocaleString()}
                    </span>
                  )}
                </h3>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                  {selected.adminReply}
                </div>
              </div>
            )}

            {/* Handling: priority, owner, internal notes (never shown to the customer) */}
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-medium text-foreground">Handling</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Priority
                  <select
                    value={selected.priority ?? "normal"}
                    onChange={(e) => updateContact(selected._id, { priority: e.target.value }, "Priority updated")}
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                  >
                    {["low", "normal", "high", "urgent"].map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Assigned to
                  <select
                    value={selected.assignedTo?.id ?? ""}
                    onChange={(e) => updateContact(selected._id, { assignedTo: e.target.value || null }, e.target.value ? "Assigned" : "Unassigned")}
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">Nobody</option>
                    {assignees.map((a) => (
                      <option key={a._id} value={a._id}>{a.name || a.email}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Internal notes (staff only)</p>
                {(selected.internalNotes ?? []).length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {selected.internalNotes!.map((n, i) => (
                      <li key={i} className="rounded bg-yellow-50 px-3 py-1.5 text-sm text-foreground">
                        {n.text}
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {n.by ?? "staff"} · {new Date(n.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    value={noteText}
                    maxLength={1000}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note for your team..."
                    aria-label="Internal note"
                  />
                  <Button
                    variant="outline"
                    disabled={!noteText.trim()}
                    onClick={async () => {
                      if (await updateContact(selected._id, { note: noteText.trim() }, "Note added")) setNoteText("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Reply Form — only show if not already replied */}
            {selected.status !== "replied" && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Send className="h-4 w-4" />
                Write Reply
              </h3>
              <select
                value=""
                onChange={(e) => {
                  const t = CONTACT_REPLIES.find((r) => r.label === e.target.value);
                  if (t) setReplyText(fillReply(t.text, selected.name));
                }}
                className="mb-2 w-full rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground sm:w-auto"
                aria-label="Insert a saved reply"
              >
                <option value="">Insert a saved reply…</option>
                {CONTACT_REPLIES.map((r) => (
                  <option key={r.label} value={r.label}>{r.label}</option>
                ))}
              </select>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here... This will be emailed to the customer."
                className="resize-none mb-3"
                rows={5}
              />
              <div className="flex items-center justify-end">
                <Button
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {sending ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-emerald-500" />
            Contact Us
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customer messages from the Contact Us page
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline">
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button onClick={fetchContacts} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["all", "new", "read", "replied", "archived"] as const).map((s) => (
          <Card
            key={s}
            className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${
              filter === s ? "ring-2 ring-emerald-500 bg-emerald-50" : ""
            }`}
            onClick={() => setFilter(s)}
          >
            <CardContent className="pt-3 pb-3 px-4 text-center">
              <p
                className={`text-xl font-bold ${
                  s === "new"
                    ? "text-red-600"
                    : s === "replied"
                    ? "text-emerald-600"
                    : "text-foreground"
                }`}
              >
                {statusCounts[s]}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{s}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or subject..."
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
          aria-label="Filter by assignee"
        >
          <option value="">Everyone&apos;s messages</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((a) => (
            <option key={a._id} value={a._id}>{a.name || a.email}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3 text-sm"
          aria-label="Filter by priority"
        >
          <option value="">Any priority</option>
          {["urgent", "high", "normal", "low"].map((p) => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
          <span className="px-1 font-medium">{checked.size} selected</span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("read")}>Mark read</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("new")}>Mark unread</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("archived")}>Archive</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("delete")}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Clear</Button>
        </div>
      )}

      {/* Query List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No contact queries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <Card
              key={contact._id}
              className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-all ${
                contact.status === "new" ? "border-l-2 border-l-red-500" : ""
              }`}
              onClick={() => viewContact(contact)}
            >
              <CardContent className="py-4 px-4">
                <div className="flex items-start justify-between gap-4">
                  <input
                    type="checkbox"
                    checked={checked.has(contact._id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleChecked(contact._id)}
                    className="mt-1 h-4 w-4 shrink-0"
                    aria-label={`Select message from ${contact.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3
                        className={`text-sm truncate ${
                          contact.status === "new"
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {contact.subject}
                      </h3>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${statusColors[contact.status]}`}
                      >
                        {statusIcons[contact.status]}
                        {contact.status}
                      </span>
                      {contact.priority && contact.priority !== "normal" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_STYLE[contact.priority]}`}>
                          {contact.priority}
                        </span>
                      )}
                      {contact.assignedTo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 bg-purple-50 text-purple-700">
                          {contact.assignedTo.name || contact.assignedTo.email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{contact.name}</span>
                      <span>·</span>
                      <span>{contact.email}</span>
                      {contact.phone && (
                        <>
                          <span>·</span>
                          <span>{contact.phone}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {contact.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(contact._id);
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pages={meta.pages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={setPage}
      />
    </div>
  );
}
