"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/common/ProductCard";

interface ShopGridProps {
  products: any[];
  categories?: string[];
}

type Sort = "newest" | "price-asc" | "price-desc" | "rating";

const effectivePrice = (p: any) =>
  p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;

export default function ShopGrid({ products, categories = [] }: ShopGridProps) {
  const { data: session } = useSession();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<Sort>("newest");

  const fetchWishlist = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json();
      const ids = (data.products || []).map((p: any) => p._id || p);
      setWishlistIds(new Set(ids));
    } catch {}
  }, [session]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const visible = useMemo(() => {
    const list = category ? products.filter((p) => p.category === category) : [...products];
    if (sort === "price-asc") list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    else if (sort === "price-desc") list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    else if (sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
  }, [products, category, sort]);

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-16 text-center">
        <p className="text-lg text-muted-foreground">
          No products available yet. Check back soon!
        </p>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-wellness-600 bg-wellness-600 text-white"
        : "border-border bg-card text-muted-foreground hover:bg-accent"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {categories.length > 0 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Product categories">
            <button role="tab" aria-selected={category === ""} className={chip(category === "")} onClick={() => setCategory("")}>
              All
            </button>
            {categories.map((c) => (
              <button key={c} role="tab" aria-selected={category === c} className={chip(category === c)} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-10 rounded-lg border bg-card px-3 text-sm text-foreground"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          No products in this category yet.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              isWishlisted={wishlistIds.has(product._id)}
              onWishlistChange={fetchWishlist}
            />
          ))}
        </div>
      )}
    </div>
  );
}
