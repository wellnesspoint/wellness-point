"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, X, FileText, Upload, ImageIcon } from "lucide-react";
import { cloudinaryUrl } from "@/lib/utils";
import toast from "react-hot-toast";

interface Blog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  images: string[];
  tags: string[];
  isPublished: boolean;
  publishAt?: string;
  createdAt: string;
}

// ISO -> value for <input type="datetime-local"> in the browser's timezone
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyBlog = {
  title: "",
  excerpt: "",
  content: "",
  coverImage: "",
  images: [] as string[],
  tags: "",
  isPublished: true,
  publishAt: "", // datetime-local; empty = publish immediately
};

export default function AdminBlogsPage() {
  const confirm = useConfirm();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBlog);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
      images: blog.images || [],
      tags: blog.tags.join(", "),
      isPublished: blog.isPublished,
      publishAt: blog.publishAt ? toLocalInput(blog.publishAt) : "",
    });
    setEditId(blog._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this blog post?"))) return;
    try {
      const res = await fetch(`/api/admin/blogs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBlogs((prev) => prev.filter((b) => b._id !== id));
      toast.success("Blog deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const uploadImages = async (files: FileList): Promise<string[]> => {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    formData.append("folder", "blogs");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.urls || [];
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await uploadImages(files);
      if (urls.length > 0) {
        setForm((prev) => ({ ...prev, coverImage: urls[0] }));
        toast.success("Cover image uploaded");
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (form.images.length + files.length > 3) {
      toast.error("Maximum 3 gallery images allowed");
      return;
    }
    setUploading(true);
    try {
      const urls = await uploadImages(files);
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      toast.success("Images uploaded");
    } catch {
      toast.error("Failed to upload images");
    } finally {
      setUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removeGalleryImage = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.error("Title and content are required");
      return;
    }
    if (!form.coverImage) {
      toast.error("Cover image is required");
      return;
    }

    const payload = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      images: form.images,
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      isPublished: form.isPublished,
      // "" clears a schedule on edit
      publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : "",
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

              {/* Cover Image Upload */}
              <div>
                <Label>Cover Image *</Label>
                {form.coverImage ? (
                  <div className="relative mt-2 inline-block">
                    <img
                      src={form.coverImage}
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                      alt="Cover"
                      className="h-40 w-full max-w-sm rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, coverImage: "" })}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-sm text-muted-foreground transition-colors hover:border-wellness-400 hover:text-wellness-600">
                    <Upload className="h-5 w-5" />
                    {uploading ? "Uploading..." : "Click to upload cover image"}
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>

              {/* Gallery Images Upload */}
              <div>
                <Label>Gallery Images (up to 3)</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img}
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                        alt={`Gallery ${idx + 1}`}
                        className="h-24 w-24 rounded-lg border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(idx)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {form.images.length < 3 && (
                    <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-wellness-400 hover:text-wellness-600">
                      <ImageIcon className="h-6 w-6" />
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleGalleryUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
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
              {form.isPublished && (
                <div>
                  <Label htmlFor="publishAt">Schedule (optional)</Label>
                  <Input
                    id="publishAt"
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                    className="max-w-xs"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Leave empty to go live now. A future date keeps the post hidden until then.
                  </p>
                </div>
              )}
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
                      src={cloudinaryUrl(blog.coverImage, 160)}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
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
                      className={`rounded-full px-2 py-0.5 font-medium ${blog.isPublished
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {!blog.isPublished
                        ? "Draft"
                        : blog.publishAt && new Date(blog.publishAt) > new Date()
                          ? `Scheduled ${new Date(blog.publishAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "Published"}
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
