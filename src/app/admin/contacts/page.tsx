"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import { useEffect, useState, useCallback } from "react";
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
  createdAt: string;
}

export default function ContactsPage() {
  const confirm = useConfirm();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contacts");
      const json = await res.json();
      setContacts(json.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

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
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this query permanently?"))) return;
    try {
      await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const statusCounts = {
    all: contacts.length,
    new: contacts.filter((c) => c.status === "new").length,
    read: contacts.filter((c) => c.status === "read").length,
    replied: contacts.filter((c) => c.status === "replied").length,
    archived: contacts.filter((c) => c.status === "archived").length,
  };

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
        <Button
          onClick={fetchContacts}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
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
    </div>
  );
}
