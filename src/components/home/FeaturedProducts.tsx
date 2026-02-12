"use client";

import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/common/ProductCard";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products?limit=50");
        const data = await res.json();
        setProducts(data.products || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600 dark:text-wellness-400">
            Our Products
          </span>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Our Supplements
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Carefully crafted supplements designed to support your wellness
            journey with the purest natural ingredients.
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
            {products.map((product) => (
              <div key={product._id} className="w-[260px] flex-shrink-0 sm:w-[280px]">
                <ProductCard product={product} />
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
    </section>
  );
}
