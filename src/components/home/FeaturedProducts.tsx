"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/common/ProductCard";

const MAX_CAROUSEL_PRODUCTS = 12;

export default function FeaturedProducts() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

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
    async function fetchProducts() {
      try {
        const res = await fetch(`/api/products?limit=${MAX_CAROUSEL_PRODUCTS}`);
        const data = await res.json();
        setProducts((data.products || []).slice(0, MAX_CAROUSEL_PRODUCTS));
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Infinite loop: render 3 copies and keep scroll centered on the middle copy
  const tripled =
    products.length > 0 ? [...products, ...products, ...products] : [];

  const resetScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || products.length === 0) return;
    const singleSetWidth = el.scrollWidth / 3;
    if (el.scrollLeft >= singleSetWidth * 2) {
      el.scrollLeft -= singleSetWidth;
    }
    if (el.scrollLeft <= 0) {
      el.scrollLeft += singleSetWidth;
    }
  }, [products.length]);

  // On mount / products load, start scroll at the middle copy
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || products.length === 0) return;
    const singleSetWidth = el.scrollWidth / 3;
    el.scrollLeft = singleSetWidth;
  }, [products]);

  // Listen for scroll end to silently reset position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(resetScroll, 60);
    };
    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, [resetScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el || products.length === 0) return;

    const singleSetWidth = el.scrollWidth / 3;
    const scrollAmount = 300;
    const maxScroll = el.scrollWidth - el.clientWidth;

    if (direction === "left" && el.scrollLeft <= scrollAmount) {
      el.scrollLeft += singleSetWidth;
    } else if (
      direction === "right" &&
      el.scrollLeft >= maxScroll - scrollAmount
    ) {
      el.scrollLeft -= singleSetWidth;
    }

    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-14">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-10 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Our Products
          </span>
          <h2 className="mt-2 font-heading text-3xl font-bold text-heading sm:text-4xl">
            Our Best Sellers
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Carefully formulated supplements trusted by our growing community.
          </p>
        </div>
      </div>

      {/* Product Carousel */}
      {loading ? (
        <div className="container mx-auto px-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-4 rounded-xl border p-4">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ) : products.length > 0 ? (
        <div className="relative">
          {/* Left Arrow */}
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-wellness-600 text-white shadow-lg transition-all hover:bg-wellness-700 active:scale-95 sm:left-4"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-wellness-600 text-white shadow-lg transition-all hover:bg-wellness-700 active:scale-95 sm:right-4"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Scrollable Container */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto px-12 pb-4 scrollbar-hide sm:px-16"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {tripled.map((product, idx) => (
              <div
                key={`${product._id}-${idx}`}
                className="w-[240px] flex-shrink-0 sm:w-[280px]"
              >
                <ProductCard
                  product={product}
                  isWishlisted={wishlistIds.has(product._id)}
                  onWishlistChange={fetchWishlist}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4">
          <p className="text-center text-muted-foreground">
            Products coming soon! Check back later.
          </p>
        </div>
      )}

      {/* View All CTA */}
      {!loading && products.length > 0 && (
        <div className="mt-8 text-center">
          <Button variant="outline" asChild className="border-wellness-300 text-wellness-700 hover:bg-wellness-50">
            <Link href="/shop" className="flex items-center gap-2">
              View All Products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
