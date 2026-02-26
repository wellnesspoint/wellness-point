"use client";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    setReplyText(contact.adminReply || "");
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
        setSelected(json.contact);
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
    if (!confirm("Delete this query permanently?")) return;
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
    new: "bg-red-500/20 text-red-400",
    read: "bg-blue-500/20 text-blue-400",
    replied: "bg-emerald-500/20 text-emerald-400",
    archived: "bg-gray-500/20 text-gray-400",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    new: <Clock className="h-3 w-3" />,
    read: <Eye className="h-3 w-3" />,
    replied: <CheckCircle className="h-3 w-3" />,
    archived: <Archive className="h-3 w-3" />,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
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
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Queries
        </Button>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-white text-xl">
                  {selected.subject}
                </CardTitle>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${statusColors[selected.status]}`}
                  >
                    {statusIcons[selected.status]}
                    {selected.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(selected.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchive(selected._id)}
                  className="border-slate-600 text-gray-400 hover:text-white"
                >
                  <Archive className="h-4 w-4 mr-1" /> Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selected._id)}
                  className="border-red-600/50 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sender Info */}
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">From:</span>
                <span className="text-white font-medium">{selected.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-gray-400" />
                <a
                  href={`mailto:${selected.email}`}
                  className="text-emerald-400 hover:underline"
                >
                  {selected.email}
                </a>
              </div>
              {selected.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">📞</span>
                  <a
                    href={`tel:${selected.phone}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {selected.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Message
              </h3>
              <div className="bg-slate-700/30 rounded-lg p-4 text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </div>
            </div>

            {/* Admin Reply (existing) */}
            {selected.adminReply && (
              <div>
                <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Your Reply
                  {selected.adminRepliedAt && (
                    <span className="text-xs text-gray-500 font-normal">
                      — {new Date(selected.adminRepliedAt).toLocaleString()}
                    </span>
                  )}
                </h3>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
                  {selected.adminReply}
                </div>
              </div>
            )}

            {/* Reply Form */}
            <div className="border-t border-slate-700 pt-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Send className="h-4 w-4" />
                {selected.adminReply ? "Update Reply" : "Write Reply"}
              </h3>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here... (This will be saved. To email the customer, use the email link above.)"
                className="bg-slate-700 border-slate-600 text-white resize-none mb-3"
                rows={5}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  💡 To email the customer directly, click their email address above.
                </p>
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
                  {sending ? "Saving..." : "Save Reply"}
                </Button>
              </div>
            </div>
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-emerald-400" />
            Contact Queries
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Customer messages from the Contact Us page
          </p>
        </div>
        <Button
          onClick={fetchContacts}
          variant="outline"
          className="border-slate-600 text-gray-400 hover:text-white"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["all", "new", "read", "replied", "archived"] as const).map((s) => (
          <Card
            key={s}
            className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-colors ${
              filter === s ? "border-emerald-500/50 bg-emerald-500/5" : ""
            }`}
            onClick={() => setFilter(s)}
          >
            <CardContent className="pt-3 pb-3 px-4 text-center">
              <p
                className={`text-xl font-bold ${
                  s === "new"
                    ? "text-red-400"
                    : s === "replied"
                    ? "text-emerald-400"
                    : "text-white"
                }`}
              >
                {statusCounts[s]}
              </p>
              <p className="text-xs text-gray-400 capitalize">{s}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or subject..."
          className="bg-slate-800 border-slate-700 text-white pl-10"
        />
      </div>

      {/* Query List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No contact queries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <Card
              key={contact._id}
              className={`bg-slate-800/50 border-slate-700 cursor-pointer hover:border-slate-600 transition-colors ${
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
                            ? "text-white font-semibold"
                            : "text-gray-300"
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
                    <div className="flex items-center gap-2 text-xs text-gray-400">
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
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {contact.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-500">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(contact._id);
                      }}
                      className="h-7 w-7 p-0 text-gray-500 hover:text-red-400"
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
