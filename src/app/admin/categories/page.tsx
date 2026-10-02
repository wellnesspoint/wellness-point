"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tags, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/admin/ConfirmProvider";

interface Category {
  _id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}
interface Unmanaged {
  name: string;
  productCount: number;
}

export default function CategoriesPage() {
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [unmanaged, setUnmanaged] = useState<Unmanaged[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const d = await res.json();
      if (!res.ok) throw new Error();
      setCategories(d.categories || []);
      setUnmanaged(d.unmanaged || []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (url: string, method: string, body?: unknown, okMsg = "Saved") => {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Request failed");
      toast.success(okMsg);
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      return false;
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    const ok = await send(
      "/api/admin/categories",
      "POST",
      { name, description, sortOrder: categories.length },
      "Category added"
    );
    if (ok) {
      setName("");
      setDescription("");
    }
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Tags className="h-7 w-7 text-emerald-500" /> Categories
      </h1>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="cat-name" className="mb-1 block text-sm font-medium">Name</label>
              <Input id="cat-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Protein" />
            </div>
            <div className="flex-1">
              <label htmlFor="cat-desc" className="mb-1 block text-sm font-medium">Description (optional)</label>
              <Input id="cat-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" variant="wellness" disabled={adding || !name.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {unmanaged.length > 0 && (
        <Card className="border-0 bg-amber-50 shadow-sm">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-amber-900">
              Some products use category names that are not in this list yet:
            </p>
            <div className="flex flex-wrap gap-2">
              {unmanaged.map((u) => (
                <button
                  key={u.name}
                  onClick={() => send("/api/admin/categories", "POST", { name: u.name, sortOrder: categories.length }, `Added "${u.name}"`)}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100"
                >
                  + {u.name} ({u.productCount})
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : categories.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">No categories yet</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <Card key={c._id} className={`border-0 shadow-sm ${c.isActive ? "" : "opacity-60"}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                {editId === c._id ? (
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <Input value={editName} maxLength={60} onChange={(e) => setEditName(e.target.value)} aria-label="Category name" />
                    <Input value={editDesc} maxLength={300} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" aria-label="Description" />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.productCount} product{c.productCount !== 1 ? "s" : ""}
                      {c.description ? ` · ${c.description}` : ""}
                      {!c.isActive ? " · hidden from the shop filter" : ""}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    defaultValue={c.sortOrder}
                    className="h-10 w-20"
                    aria-label={`Sort order for ${c.name}`}
                    title="Sort order (lower shows first)"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v !== c.sortOrder) send(`/api/admin/categories/${c._id}`, "PUT", { sortOrder: v });
                    }}
                  />
                  {editId === c._id ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        onClick={async () => {
                          if (await send(`/api/admin/categories/${c._id}`, "PUT", { name: editName, description: editDesc })) setEditId(null);
                        }}
                        aria-label="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-10" onClick={() => setEditId(null)} aria-label="Cancel">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        onClick={() => send(`/api/admin/categories/${c._id}`, "PUT", { isActive: !c.isActive })}
                      >
                        {c.isActive ? "Hide" : "Show"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10"
                        onClick={() => {
                          setEditId(c._id);
                          setEditName(c.name);
                          setEditDesc(c.description ?? "");
                        }}
                        aria-label={`Edit ${c.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 text-red-600"
                        aria-label={`Delete ${c.name}`}
                        onClick={async () => {
                          if (
                            await confirm(
                              `Delete "${c.name}"? ${c.productCount} product(s) will become uncategorised.`
                            )
                          )
                            await send(`/api/admin/categories/${c._id}`, "DELETE", undefined, "Category deleted");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
