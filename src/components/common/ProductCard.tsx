"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useCartStore } from "@/store/cart";
import { formatPrice, getDiscountPercentage } from "@/lib/utils";
import toast from "react-hot-toast";

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    discountPrice?: number;
    images: string[];
    shortDescription: string;
    rating: number;
    reviewCount: number;
    stock: number;
  };
  onWishlist?: () => void;
}

export default function ProductCard({ product, onWishlist }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const discountPercent = hasDiscount
    ? getDiscountPercentage(product.price, product.discountPrice!)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      discountPrice: product.discountPrice,
      image: product.images[0],
      quantity: 1,
      stock: product.stock,
    });
    toast.success(`${product.name} added to cart`);
    openCart();
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onWishlist?.();
    toast.success("Added to wishlist");
  };

  return (
    <Card className="group relative overflow-hidden border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Discount Badge */}
      {hasDiscount && (
        <Badge className="absolute left-3 top-3 z-10 bg-red-500 text-white">
          -{discountPercent}%
        </Badge>
      )}

      {/* Wishlist Button */}
      <button
        onClick={handleWishlist}
        className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2 text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-background hover:text-red-500"
        aria-label="Add to wishlist"
      >
        <Heart className="h-4 w-4" />
      </button>

      {/* Image */}
      <Link href={`/product/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-wellness-50 to-white dark:from-wellness-950/50 dark:to-card">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="space-y-2 p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-heading text-base font-semibold text-card-foreground transition-colors group-hover:text-wellness-600 dark:group-hover:text-wellness-400 line-clamp-1">
            {product.name}
          </h3>
        </Link>

        <p className="text-xs text-muted-foreground line-clamp-2">
          {product.shortDescription}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < Math.round(product.rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-muted text-muted"
              }`}
            />
          ))}
          <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
        </div>

        {/* Price + Cart */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-wellness-600 dark:text-wellness-400">
              {formatPrice(hasDiscount ? product.discountPrice! : product.price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
          <Button
            variant="wellness"
            size="icon"
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="h-9 w-9 rounded-full"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
