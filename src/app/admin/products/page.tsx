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
  isFeatured: boolean;
  category?: string;
}

const emptyProduct = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  images: "",
  ingredients: "",
  benefits: "",
  usage: "",
  stock: "",
  isFeatured: false,
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
    setShowForm(true);
  };

  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      discountPrice: product.discountPrice ? String(product.discountPrice) : "",
      images: product.images.join(", "),
      ingredients: product.ingredients.join(", "),
      benefits: product.benefits.join(", "),
      usage: product.usage || "",
      stock: String(product.stock),
      isFeatured: product.isFeatured,
      category: product.category || "",
    });
    setEditId(product._id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      toast.error("Name and price are required");
      return;
    }

    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined,
      images: form.images
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
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
      isFeatured: form.isFeatured,
      category: form.category,
    };

    setSaving(true);
    try {
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
              <div className="sm:col-span-2">
                <Label>Image URLs (comma separated)</Label>
                <Input
                  value={form.images}
                  onChange={(e) => setForm({ ...form, images: e.target.value })}
                  placeholder="https://... , https://..."
                />
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
              <div className="sm:col-span-2">
                <Button type="submit" variant="wellness" disabled={saving}>
                  {saving
                    ? "Saving..."
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
                    <span className="text-xs text-muted-foreground">
                      Stock: {product.stock}
                    </span>
                    {product.isFeatured && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                        Featured
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
