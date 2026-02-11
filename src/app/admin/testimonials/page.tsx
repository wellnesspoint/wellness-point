"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  X,
  MessageSquare,
  Star,
  CheckCircle,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface Testimonial {
  _id: string;
  name: string;
  role: string;
  image: string;
  content: string;
  rating: number;
  isApproved: boolean;
}

const emptyForm = {
  name: "",
  role: "",
  image: "",
  content: "",
  rating: "5",
  isApproved: true,
};

export default function AdminTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchTestimonials = async () => {
    try {
      const res = await fetch("/api/admin/testimonials");
      const data = await res.json();
      setTestimonials(data.testimonials || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const toggleApproved = async (id: string, isApproved: boolean) => {
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: !isApproved }),
      });
      if (!res.ok) throw new Error();
      setTestimonials((prev) =>
        prev.map((t) =>
          t._id === id ? { ...t, isApproved: !isApproved } : t
        )
      );
      toast.success(isApproved ? "Testimonial hidden" : "Testimonial approved");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setTestimonials((prev) => prev.filter((t) => t._id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.content) {
      toast.error("Name and content required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          rating: Number(form.rating),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Testimonial added");
      setShowForm(false);
      setForm(emptyForm);
      fetchTestimonials();
    } catch {
      toast.error("Failed to add");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Testimonials</h1>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Testimonials ({testimonials.length})
        </h1>
        {!showForm && (
          <Button variant="wellness" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">New Testimonial</CardTitle>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Role / Title</Label>
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Fitness Enthusiast"
                />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                />
              </div>
              <div>
                <Label>Rating (1-5)</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Content *</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Button type="submit" variant="wellness" disabled={saving}>
                  {saving ? "Saving..." : "Add Testimonial"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {testimonials.length === 0 && !showForm ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No testimonials yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {testimonials.map((t) => (
            <Card key={t._id} className="border-0 shadow-sm">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                  {t.image ? (
                    <img
                      src={t.image}
                      alt={t.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                      {t.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t.name}
                    </p>
                    {t.role && (
                      <span className="text-xs text-muted-foreground">{t.role}</span>
                    )}
                  </div>
                  <div className="my-1 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < t.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {t.content}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => toggleApproved(t._id, t.isApproved)}
                    className={`rounded-lg p-2 ${
                      t.isApproved
                        ? "text-green-500 hover:bg-green-50"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                    title={t.isApproved ? "Hide" : "Approve"}
                  >
                    {t.isApproved ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(t._id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
