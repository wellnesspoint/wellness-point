"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Star,
  Check,
  X,
  Trash2,
  MessageSquare,
  Search,
  Reply,
  Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

interface Review {
  _id: string;
  product: { _id: string; name: string; slug: string; images: string[] };
  name: string;
  email: string;
  rating: number;
  title: string;
  content: string;
  isApproved: boolean;
  adminReply?: string;
  adminRepliedAt?: string;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/admin/reviews");
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: true }),
      });
      if (!res.ok) throw new Error();
      setReviews((prev) =>
        prev.map((r) => (r._id === id ? { ...r, isApproved: true } : r))
      );
      toast.success("Review approved");
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: false }),
      });
      if (!res.ok) throw new Error();
      setReviews((prev) =>
        prev.map((r) => (r._id === id ? { ...r, isApproved: false } : r))
      );
      toast.success("Review rejected");
    } catch {
      toast.error("Failed to reject");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setReviews((prev) => prev.filter((r) => r._id !== id));
      toast.success("Review deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleReply = async (id: string) => {
    if (!replyText.trim()) {
      toast.error("Reply cannot be empty");
      return;
    }
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply: replyText.trim() }),
      });
      if (!res.ok) throw new Error();
      setReviews((prev) =>
        prev.map((r) =>
          r._id === id
            ? { ...r, adminReply: replyText.trim(), adminRepliedAt: new Date().toISOString() }
            : r
        )
      );
      setReplyingTo(null);
      setReplyText("");
      toast.success("Reply posted");
    } catch {
      toast.error("Failed to post reply");
    }
  };

  const filtered = reviews
    .filter((r) => {
      if (filter === "pending") return !r.isApproved;
      if (filter === "approved") return r.isApproved;
      return true;
    })
    .filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.product?.name?.toLowerCase().includes(search.toLowerCase())
    );

  const pendingCount = reviews.filter((r) => !r.isApproved).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Reviews</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Reviews ({reviews.length})
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-yellow-100 px-2.5 py-0.5 text-sm font-medium text-yellow-700">
              {pendingCount} pending
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reviews..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-wellness-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No reviews found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((review) => (
            <Card key={review._id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">
                        {review.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {review.email}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          review.isApproved
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {review.isApproved ? "Approved" : "Pending"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        on{" "}
                        <span className="font-medium text-foreground">
                          {review.product?.name || "Deleted Product"}
                        </span>
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {review.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {review.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(review.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>

                    {/* Admin Reply */}
                    {review.adminReply && (
                      <div className="mt-2 rounded-lg bg-emerald-50 p-3 border-l-2 border-emerald-500">
                        <p className="text-xs font-semibold text-emerald-700 mb-0.5">
                          Admin Reply
                        </p>
                        <p className="text-sm text-foreground">{review.adminReply}</p>
                      </div>
                    )}

                    {/* Reply Form */}
                    {replyingTo === review._id && (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write your reply..."
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="wellness"
                            onClick={() => handleReply(review._id)}
                          >
                            <Send className="mr-1 h-3 w-3" /> Send Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setReplyingTo(null); setReplyText(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!review.isApproved && (
                      <button
                        onClick={() => handleApprove(review._id)}
                        className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {review.isApproved && (
                      <button
                        onClick={() => handleReject(review._id)}
                        className="rounded-lg p-2 text-yellow-600 hover:bg-yellow-50"
                        title="Unapprove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setReplyingTo(review._id);
                        setReplyText(review.adminReply || "");
                      }}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="Reply"
                    >
                      <Reply className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(review._id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
