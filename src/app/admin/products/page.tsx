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
  X,
  Package,
  Search,
  Upload,
  Download,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import { downloadCsv } from "@/lib/csv";
import VariantsEditor, { type VariantForm } from "./VariantsEditor";
import ProductRow from "./ProductRow";
import type { Product } from "./types";
import toast from "react-hot-toast";



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
  tags: "",
  variants: [] as VariantForm[],
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
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((d) => setCategoryNames((d.categories || []).map((c: { name: string }) => c.name)))
      .catch(() => {});
  }, []);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (
    action: string,
    extra: Record<string, unknown> = {},
    confirmMsg?: string
  ) => {
    if (checked.size === 0) return;
    if (confirmMsg && !(await confirm(confirmMsg))) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checked], action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk action failed");
      toast.success(`${data.affected} product(s) updated`);
      setChecked(new Set());
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkPrice = async () => {
    const v = window.prompt("Change price by what percent? (e.g. 10 for +10%, -5 for -5%)");
    if (v === null || v.trim() === "") return;
    await bulk("adjust_price", { percent: Number(v) }, `Change prices of ${checked.size} product(s) by ${v}%?`);
  };

  const bulkCategory = async () => {
    const v = window.prompt("Set category for selected products (leave empty to clear):");
    if (v === null) return;
    await bulk("set_category", { category: v });
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams({
        all: "1",
        ...(PRODUCT_FILTERS.find((f) => f.value === filter)?.params ?? {}),
      });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      downloadCsv(
        `products-${new Date().toISOString().slice(0, 10)}.csv`,
        ["name", "sku", "category", "price", "discountPrice", "stock", "weight", "gst", "status", "description", "image"],
        (data.products as Product[]).map((x) => [
          x.name, x.sku ?? "", x.category ?? "", x.price, x.discountPrice ?? "", x.stock,
          x.weight ?? "", x.gst ?? "",
          x.archivedAt ? "archived" : x.isActive === false ? "inactive" : "active",
          x.description, x.images?.[0] ?? "",
        ])
      );
    } catch {
      toast.error("Export failed");
    }
  };

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
      setChecked(new Set());
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
      tags: (product.tags || []).join(", "),
      variants: (product.variants || []).map((v) => ({
        _id: v._id,
        name: v.name,
        sku: v.sku || "",
        price: String(v.price),
        discountPrice: v.discountPrice ? String(v.discountPrice) : "",
        stock: String(v.stock),
        isActive: v.isActive !== false,
      })),
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
    { _id: string; delta: number; reason: string; variantName?: string; actorName?: string; balance?: number; createdAt: string }[]
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

      const hasVariants = form.variants.length > 0;
      const payload = {
        name: form.name,
        description: form.description,
        // With variants the server derives price/stock from them; the first variant
        // only satisfies the "price is required" check on create.
        price: hasVariants ? Number(form.variants[0].price) : Number(form.price),
        variants: form.variants.map((v) => ({
          _id: v._id,
          name: v.name,
          sku: v.sku || undefined,
          price: Number(v.price),
          discountPrice: v.discountPrice ? Number(v.discountPrice) : undefined,
          stock: Number(v.stock) || 0,
          isActive: v.isActive,
        })),
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
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
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
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:w-64 sm:flex-none">
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
          <Button variant="outline" onClick={exportCsv} title="Export CSV" aria-label="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
          <Link href="/admin/inventory">
            <Button variant="outline" title="Inventory, stock and CSV import" aria-label="Inventory">
              <Boxes className="h-4 w-4" />
            </Button>
          </Link>
          {!showForm && (
            <Button variant="wellness" onClick={handleAdd}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
          <span className="px-1 font-medium">{checked.size} selected</span>
          {filter === "archived" ? (
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("restore")}>Restore</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("activate")}>Activate</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("deactivate")}>Deactivate</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("feature")}>Feature</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("unfeature")}>Unfeature</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkCategory}>Set category</Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkPrice}>Change price %</Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkBusy}
                onClick={() => bulk("archive", {}, `Archive ${checked.size} product(s)? They will be hidden from the store.`)}
              >
                Archive
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Clear</Button>
        </div>
      )}

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
                  value={form.variants.length ? "" : form.price}
                  disabled={form.variants.length > 0}
                  placeholder={form.variants.length ? "Set per variant" : undefined}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Discount Price (₹)</Label>
                <Input
                  type="number"
                  value={form.variants.length ? "" : form.discountPrice}
                  disabled={form.variants.length > 0}
                  placeholder={form.variants.length ? "Set per variant" : undefined}
                  onChange={(e) =>
                    setForm({ ...form, discountPrice: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={form.variants.length ? "" : form.stock}
                  disabled={form.variants.length > 0}
                  placeholder={form.variants.length ? "Total of variants" : undefined}
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
              <VariantsEditor
                variants={form.variants}
                defaultPrice={form.price}
                onChange={(variants) => setForm({ ...form, variants })}
              />
              <div>
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No category</option>
                  {categoryNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {form.category && !categoryNames.includes(form.category) && (
                    <option value={form.category}>{form.category} (not in list)</option>
                  )}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Manage the list under <Link href="/admin/categories" className="underline">Categories</Link>.
                </p>
              </div>
              <div>
                <Label>Tags</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="vegan, gluten-free, bestseller"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Comma separated, up to 15.</p>
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
            <ProductRow
              key={product._id}
              product={product}
              checked={checked.has(product._id)}
              onToggle={() => toggleChecked(product._id)}
              historyOpen={historyFor === product._id}
              history={history}
              loadingHistory={loadingHistory}
              onToggleHistory={() => toggleHistory(product._id)}
              onEdit={() => handleEdit(product)}
              onArchive={() => handleArchive(product._id)}
              onRestore={() => handleRestore(product._id)}
              onDeleteForever={() => handleDeleteForever(product._id, product.name)}
            />
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
