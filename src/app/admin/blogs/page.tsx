"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, X, FileText } from "lucide-react";
import toast from "react-hot-toast";

interface Blog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
}

const emptyBlog = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  tags: "",
  isPublished: true,
};

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBlog);
  const [saving, setSaving] = useState(false);

  const fetchBlogs = async () => {
    try {
      const res = await fetch("/api/admin/blogs");
      const data = await res.json();
      setBlogs(data.blogs || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleAdd = () => {
    setForm(emptyBlog);
    setEditId(null);
    setShowForm(true);
  };

  const handleEdit = (blog: Blog) => {
    setForm({
      title: blog.title,
      excerpt: blog.excerpt,
      content: blog.content,
      coverImage: blog.coverImage || "",
      tags: blog.tags.join(", "),
      isPublished: blog.isPublished,
    });
    setEditId(blog._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    try {
      const res = await fetch(`/api/admin/blogs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBlogs((prev) => prev.filter((b) => b._id !== id));
      toast.success("Blog deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.error("Title and content are required");
      return;
    }

    const payload = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      isPublished: form.isPublished,
    };

    setSaving(true);
    try {
      const url = editId ? `/api/admin/blogs/${editId}` : "/api/admin/blogs";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(editId ? "Blog updated" : "Blog created");
      setShowForm(false);
      setEditId(null);
      setForm(emptyBlog);
      fetchBlogs();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Blogs</h1>
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
          Blogs ({blogs.length})
        </h1>
        {!showForm && (
          <Button variant="wellness" onClick={handleAdd}>
            <Plus className="mr-1 h-4 w-4" /> Add Blog
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              {editId ? "Edit Blog" : "New Blog"}
            </CardTitle>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Excerpt</Label>
                <Textarea
                  value={form.excerpt}
                  onChange={(e) =>
                    setForm({ ...form, excerpt: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div>
                <Label>Content *</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                  rows={8}
                />
              </div>
              <div>
                <Label>Cover Image URL</Label>
                <Input
                  value={form.coverImage}
                  onChange={(e) =>
                    setForm({ ...form, coverImage: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Tags (comma separated)</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm({ ...form, isPublished: e.target.checked })
                  }
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="isPublished" className="mb-0 cursor-pointer">
                  Published
                </Label>
              </div>
              <div>
                <Button type="submit" variant="wellness" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editId
                    ? "Update Blog"
                    : "Create Blog"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {blogs.length === 0 && !showForm ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No blog posts yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {blogs.map((blog) => (
            <Card key={blog._id} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  {blog.coverImage ? (
                    <img
                      src={blog.coverImage}
                      alt={blog.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FileText className="h-6 w-6 text-muted" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {blog.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(blog.createdAt).toLocaleDateString("en-IN")}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        blog.isPublished
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {blog.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(blog)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-muted-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(blog._id)}
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
