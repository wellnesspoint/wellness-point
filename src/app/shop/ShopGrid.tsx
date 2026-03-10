"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import ProductCard from "@/components/common/ProductCard";

interface ShopGridProps {
  products: any[];
}

export default function ShopGrid({ products }: ShopGridProps) {
  const { data: session } = useSession();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

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

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-16 text-center">
        <p className="text-lg text-muted-foreground">
          No products available yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product._id}
          product={product}
          isWishlisted={wishlistIds.has(product._id)}
          onWishlistChange={fetchWishlist}
        />
      ))}
    </div>
  );
}
