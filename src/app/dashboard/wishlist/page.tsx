"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FALLBACK_IMAGE } from "@/lib/constants";
import { useCartStore } from "@/store/cart";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface WishlistProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice?: number;
  images: string[];
  stock: number;
}

export default function WishlistPage() {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const fetchWishlist = async () => {
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const removeFromWishlist = async (productId: string) => {
    try {
      await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      setProducts((prev) => prev.filter((p) => p._id !== productId));
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleAddToCart = (product: WishlistProduct) => {
    if ((product as { variants?: unknown[] }).variants?.length) {
      toast("Choose an option on the product page first");
      router.push(`/product/${product.slug}`);
      return;
    }
    addItem({
      _id: product._id,
      name: product.name,
      price: product.discountPrice || product.price,
      image: product.images?.[0] || "/placeholder.jpg",
      slug: product.slug,
      quantity: 1,
      stock: product.stock || 10,
    });
    toast.success("Added to cart");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">My Wishlist</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">
        My Wishlist{" "}
        {products.length > 0 && (
          <span className="text-base font-normal text-muted-foreground">
            ({products.length})
          </span>
        )}
      </h1>

      {products.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Heart className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="mb-1 text-muted-foreground">Your wishlist is empty</p>
            <Link
              href="/shop"
              className="text-sm font-medium text-wellness-600 hover:text-wellness-700"
            >
              Browse Products →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const hasDiscount =
              product.discountPrice && product.discountPrice < product.price;
            return (
              <Card
                key={product._id}
                className="group overflow-hidden border-0 shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/product/${product.slug}`}>
                  <div className="relative aspect-square bg-muted">
                    <img
                      src={product.images?.[0] || FALLBACK_IMAGE}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                    {hasDiscount && (
                      <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                        {Math.round(
                          ((product.price - product.discountPrice!) /
                            product.price) *
                            100
                        )}
                        % OFF
                      </span>
                    )}
                  </div>
                </Link>
                <CardContent className="p-4">
                  <Link href={`/product/${product.slug}`}>
                    <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-foreground hover:text-wellness-600">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg font-bold text-wellness-700">
                      ₹{(product.discountPrice || product.price).toLocaleString("en-IN")}
                    </span>
                    {hasDiscount && (
                      <span className="text-sm text-muted-foreground line-through">
                        ₹{product.price.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="wellness"
                      className="flex-1"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.stock === 0}
                    >
                      <ShoppingCart className="mr-1 h-4 w-4" />
                      {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFromWishlist(product._id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
