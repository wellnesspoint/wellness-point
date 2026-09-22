"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

interface Subscriber {
  _id: string;
  email: string;
  isActive: boolean;
  subscribedAt: string;
}

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  const activeCount = subscribers.filter((s) => s.isActive !== false).length;

  useEffect(() => {
    fetch("/api/admin/newsletter")
      .then((r) => r.json())
      .then((d) => setSubscribers(d.subscribers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = subscribers.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete ${email} from newsletter?`)) return;
    try {
      const res = await fetch("/api/admin/newsletter", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSubscribers((prev) => prev.filter((s) => s._id !== id));
        toast.success("Subscriber deleted");
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

    if (
      !confirm(
        `Send this newsletter to ${activeCount} active subscriber${activeCount !== 1 ? "s" : ""}?`
      )
    )
      return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Newsletter sent!");
        setSubject("");
        setBody("");
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
          Newsletter ({subscribers.length})
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
            <p className="text-sm text-muted-foreground">
              Will be sent to {activeCount} active subscriber
              {activeCount !== 1 ? "s" : ""} via Zoho SMTP.
            </p>

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

      {/* Search */}
      <div className="relative sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search emails..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Subscribed</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((sub, idx) => (
                <tr key={sub._id} className="hover:bg-accent">
                  <td className="py-3 text-muted-foreground">{idx + 1}</td>
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
    </div>
  );
}
