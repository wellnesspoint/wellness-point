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
  Pencil,
  Trash2,
  X,
  Package,
  Search,
  Upload,
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
  sku: "",
  weight: "",
  gst: "18",
  isFeatured: false,
  isActive: true,
  category: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setProducts((prev) => prev.filter((p) => p._id !== id));
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete");
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
      if (!res.ok) throw new Error();
      toast.success(editId ? "Product updated" : "Product created");
      setShowForm(false);
      setEditId(null);
      setForm(emptyProduct);
      setImageFiles([]);
      setImagePreviews([]);
      setExistingImages([]);
      fetchProducts();
    } catch {
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
          Products ({products.length})
        </h1>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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
              {search ? "No products match your search" : "No products yet"}
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
                      ₹{product.price}
                    </span>
                    {product.discountPrice && (
                      <span className="text-muted-foreground line-through text-xs">
                        ₹{product.discountPrice}
                      </span>
                    )}
                    <span className={`text-xs ${product.stock <= 10 ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                      {product.stock <= 0 ? "Out of Stock" : product.stock <= 10 ? `Low: ${product.stock}` : `Stock: ${product.stock}`}
                    </span>
                    {product.isFeatured && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                        Featured
                      </span>
                    )}
                    {product.isActive === false && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(product)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-muted-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product._id)}
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
