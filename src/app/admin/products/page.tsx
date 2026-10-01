"use client";

import { useConfirm } from "@/components/admin/ConfirmProvider";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Pagination, { useDebounced } from "@/components/admin/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Package,
  Search,
  Upload,
  Archive,
  ArchiveRestore,
  History,
} from "lucide-react";
import toast from "react-hot-toast";

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  images: string[];
  ingredients: string[];
  benefits: string[];
  usage: string;
  stock: number;
  lowStockThreshold?: number;
  archivedAt?: string;
  sku?: string;
  weight?: number;
  gst?: number;
  isFeatured: boolean;
  isActive: boolean;
  category?: string;
}

const emptyProduct = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  images: "" as string,
  ingredients: "",
  benefits: "",
  usage: "",
  stock: "",
  lowStockThreshold: "10",
  sku: "",
  weight: "",
  gst: "18",
  isFeatured: false,
  isActive: true,
  category: "",
};

const PAGE_SIZE = 24;

const PRODUCT_FILTERS: { value: string; label: string; params: Record<string, string> }[] = [
  { value: "all", label: "All products", params: {} },
  { value: "active", label: "Active", params: { status: "active" } },
  { value: "inactive", label: "Inactive", params: { status: "inactive" } },
  { value: "low", label: "Low stock", params: { stock: "low" } },
  { value: "out", label: "Out of stock", params: { stock: "out" } },
  { value: "archived", label: "Archived", params: { status: "archived" } },
];

export default function AdminProductsPage() {
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const requestId = useRef(0);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchProducts = useCallback(async () => {
    const id = ++requestId.current;
    setFetching(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(PRODUCT_FILTERS.find((f) => f.value === filter)?.params ?? {}),
      });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      if (id !== requestId.current) return; // a newer request superseded this one
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      if (id === requestId.current) {
        toast.error(err instanceof Error ? err.message : "Failed to load products");
      }
    } finally {
      if (id === requestId.current) {
        setFetching(false);
        setLoading(false);
      }
    }
  }, [page, filter, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAdd = () => {
    setForm(emptyProduct);
    setEditId(null);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setShowForm(true);
  };

  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      discountPrice: product.discountPrice ? String(product.discountPrice) : "",
      images: "",
      ingredients: product.ingredients.join(", "),
      benefits: product.benefits.join(", "),
      usage: product.usage || "",
      stock: String(product.stock),
      lowStockThreshold: String(product.lowStockThreshold ?? 10),
      sku: product.sku || "",
      weight: product.weight ? String(product.weight) : "",
      gst: product.gst !== undefined ? String(product.gst) : "18",
      isFeatured: product.isFeatured,
      isActive: product.isActive !== false,
      category: product.category || "",
    });
    setEditId(product._id);
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages(product.images || []);
    setShowForm(true);
  };

  // Delete = archive (soft delete): hidden from the store, reviews kept, restorable.
  const handleArchive = async (id: string) => {
    if (!(await confirm("Archive this product? It will be hidden from the store (reviews are kept) and you can restore it later."))) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to archive");
      toast.success("Product archived");
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to restore");
      toast.success("Product restored (inactive) — activate it when ready");
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore");
    }
  };

  const handleDeleteForever = async (id: string, name: string) => {
    if (!(await confirm(`Permanently delete "${name}" and all of its reviews? This cannot be undone.`))) return;
    try {
      const res = await fetch(`/api/admin/products/${id}?permanent=1`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to delete");
      toast.success("Product deleted permanently");
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Stock history (inline panel under a product)
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { _id: string; delta: number; reason: string; actorName?: string; balance?: number; createdAt: string }[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleHistory = async (id: string) => {
    if (historyFor === id) {
      setHistoryFor(null);
      return;
    }
    setHistoryFor(id);
    setHistory([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/stock-history`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load history");
      setHistory(d.movements || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length + imageFiles.length + files.length;
    if (totalImages > 5) {
      toast.error("Maximum 5 images allowed per product");
      return;
    }
    setImageFiles((prev) => [...prev, ...files]);
    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      toast.error("Name and price are required");
      return;
    }

    if (existingImages.length === 0 && imageFiles.length === 0) {
      toast.error("Please add at least one product image");
      return;
    }

    setSaving(true);

    try {
      // Upload new images if any
      let uploadedUrls: string[] = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        const formData = new FormData();
        imageFiles.forEach((file) => formData.append("files", file));

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error || "Failed to upload images");
        }

        const uploadData = await uploadRes.json();
        uploadedUrls = uploadData.urls;
        setUploading(false);
      }

      const allImages = [...existingImages, ...uploadedUrls];

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined,
        images: allImages,
        ingredients: form.ingredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        benefits: form.benefits
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        usage: form.usage,
        stock: Number(form.stock) || 0,
        lowStockThreshold: form.lowStockThreshold === "" ? 10 : Number(form.lowStockThreshold),
        sku: form.sku || undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        gst: form.gst ? Number(form.gst) : 18,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
        category: form.category,
      };

      const url = editId
        ? `/api/admin/products/${editId}`
        : "/api/admin/products";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save product");
      }
      toast.success(editId ? "Product updated" : "Product created");
      setShowForm(false);
      setEditId(null);
      setForm(emptyProduct);
      setImageFiles([]);
      setImagePreviews([]);
      setExistingImages([]);
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  // Search/filter/paging happen on the server; `products` is already the visible page.
  const filtered = products;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Products</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Products ({total})
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border bg-background px-3 text-sm"
            aria-label="Filter products"
          >
            {PRODUCT_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          {!showForm && (
            <Button variant="wellness" onClick={handleAdd}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              {editId ? "Edit Product" : "New Product"}
            </CardTitle>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="rounded-lg p-1.5 hover:bg-accent"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Product Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Discount Price (₹)</Label>
                <Input
                  type="number"
                  value={form.discountPrice}
                  onChange={(e) =>
                    setForm({ ...form, discountPrice: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div>
                <Label>Low-stock alert at</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Admins are emailed once when stock falls to this level.
                </p>
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  placeholder="e.g. Vitamins, Protein"
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. WP-VIT-001"
                />
              </div>
              <div>
                <Label>Weight (grams)</Label>
                <Input
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <Label>GST / Tax (%)</Label>
                <Input
                  type="number"
                  value={form.gst}
                  onChange={(e) => setForm({ ...form, gst: e.target.value })}
                  placeholder="18"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Product Images (max 5)</Label>
                <div className="mt-2 space-y-3">
                  {/* Existing images */}
                  {existingImages.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {existingImages.map((img, idx) => (
                        <div key={`existing-${idx}`} className="relative group">
                          <img
                            src={img}
                            alt={`Product image ${idx + 1}`}
                            className="h-20 w-20 rounded-lg object-cover border"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(idx)}
                            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-sm"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New image previews */}
                  {imagePreviews.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {imagePreviews.map((preview, idx) => (
                        <div key={`new-${idx}`} className="relative group">
                          <img
                            src={preview}
                            alt={`New image ${idx + 1}`}
                            className="h-20 w-20 rounded-lg object-cover border border-wellness-300"
                          />
                          <button
                            type="button"
                            onClick={() => removeNewImage(idx)}
                            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1.5 text-white shadow-sm"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  {existingImages.length + imageFiles.length < 5 && (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground hover:border-wellness-400 hover:text-wellness-600 transition-colors">
                      <Upload className="h-5 w-5" />
                      <span>Click to upload images ({existingImages.length + imageFiles.length}/5)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Ingredients (comma separated)</Label>
                <Input
                  value={form.ingredients}
                  onChange={(e) =>
                    setForm({ ...form, ingredients: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Benefits (comma separated)</Label>
                <Input
                  value={form.benefits}
                  onChange={(e) =>
                    setForm({ ...form, benefits: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Usage Instructions</Label>
                <Textarea
                  value={form.usage}
                  onChange={(e) => setForm({ ...form, usage: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={form.isFeatured}
                  onChange={(e) =>
                    setForm({ ...form, isFeatured: e.target.checked })
                  }
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="isFeatured" className="mb-0 cursor-pointer">
                  Featured Product
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="isActive" className="mb-0 cursor-pointer">
                  Active (visible in store)
                </Label>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" variant="wellness" disabled={saving}>
                  {saving
                    ? uploading
                      ? "Uploading images..."
                      : "Saving..."
                    : editId
                    ? "Update Product"
                    : "Create Product"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Product List */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Package className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">
              {search || filter !== "all" ? "No products match your filters" : "No products yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => (
            <Card key={product._id} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-6 w-6 text-muted" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {product.name}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-wellness-700">
                      ₹{product.discountPrice && product.discountPrice < product.price ? product.discountPrice : product.price}
                    </span>
                    {product.discountPrice && product.discountPrice < product.price && (
                      <span className="text-muted-foreground line-through text-xs">
                        ₹{product.price}
                      </span>
                    )}
                    <span className={`text-xs ${product.stock <= (product.lowStockThreshold ?? 10) ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      {product.stock <= 0 ? "Out of Stock" : product.stock <= (product.lowStockThreshold ?? 10) ? `Low: ${product.stock}` : `Stock: ${product.stock}`}
                    </span>
                    {product.archivedAt && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        Archived
                      </span>
                    )}
                    {product.isFeatured && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                        Featured
                      </span>
                    )}
                    {product.isActive === false && !product.archivedAt && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleHistory(product._id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                    title="Stock history"
                    aria-label="Stock history"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  {product.archivedAt ? (
                    <>
                      <button
                        onClick={() => handleRestore(product._id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                        title="Restore"
                        aria-label="Restore"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteForever(product._id, product.name)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                        title="Delete permanently"
                        aria-label="Delete permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(product)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-muted-foreground"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleArchive(product._id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                        title="Archive"
                        aria-label="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
              {historyFor === product._id && (
                <div className="border-t px-4 pb-4 pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Stock history (latest 50)</p>
                  {loadingHistory ? (
                    <Skeleton className="h-10 w-full rounded" />
                  ) : history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No stock changes recorded yet.</p>
                  ) : (
                    <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                      {history.map((m) => (
                        <li key={m._id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1">
                          <span>
                            <span className={`font-semibold ${m.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                              {m.delta > 0 ? `+${m.delta}` : m.delta}
                            </span>{" "}
                            <span className="capitalize">{m.reason.replace("_", " ")}</span>
                            {m.actorName ? ` · ${m.actorName}` : ""}
                            {m.balance !== undefined ? ` · now ${m.balance}` : ""}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        disabled={fetching}
      />
    </div>
  );
}
