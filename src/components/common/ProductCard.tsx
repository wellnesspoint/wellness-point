"use client";

import React, { useState, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  isWishlisted?: boolean;
  onWishlistChange?: () => void;
}

function ProductCard({ product, isWishlisted = false, onWishlistChange }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const router = useRouter();
  const { data: session } = useSession();
  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [wishLoading, setWishLoading] = useState(false);

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

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      toast.error("Please sign in to add to wishlist");
      router.push("/login");
      return;
    }
    if (wishLoading) return;
    setWishLoading(true);
    try {
      await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product._id }),
      });
      setWishlisted(!wishlisted);
      toast.success(wishlisted ? "Removed from wishlist" : "Added to wishlist");
      onWishlistChange?.();
    } catch {
      toast.error("Failed to update wishlist");
    } finally {
      setWishLoading(false);
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
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
    router.push("/checkout");
  };

  return (
    <Card className="group relative flex flex-col overflow-hidden border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Wishlist Button */}
      <button
        onClick={handleWishlist}
        disabled={wishLoading}
        className={`absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2.5 shadow-sm backdrop-blur-sm transition-all hover:bg-background ${wishlisted ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          }`}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart className={`h-5 w-5 ${wishlisted ? "fill-red-500" : ""}`} />
      </button>

      {/* Image */}
      <Link href={`/product/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-wellness-50 to-white">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Rating row */}
        <div className="mb-2 flex items-center gap-2">
          <Badge className="rounded-md bg-wellness-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {product.rating.toFixed(1)} <Star className="ml-0.5 inline h-2.5 w-2.5 fill-white" />
          </Badge>
          <span className="text-xs text-muted-foreground">
            {product.reviewCount} reviews
          </span>
        </div>

        {/* Product Name */}
        <Link href={`/product/${product.slug}`}>
          <h3 className="mb-2 font-heading text-sm font-semibold leading-snug text-card-foreground transition-colors group-hover:text-wellness-600 line-clamp-2">
            {product.name}
          </h3>
        </Link>

        {/* Price row */}
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold text-foreground">
            {formatPrice(hasDiscount ? product.discountPrice! : product.price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)}
              </span>
              <span className="text-sm font-semibold text-wellness-600">
                {discountPercent}% off
              </span>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="mt-auto space-y-2">
          {/* Add to Cart – outline button */}
          <Button
            variant="outline"
            className="w-full border-wellness-600 text-wellness-700 hover:bg-wellness-50"
            onClick={handleAddToCart}
            disabled={product.stock === 0}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>

          {/* Buy Now – solid button */}
          <Button
            variant="wellness"
            className="w-full"
            onClick={handleBuyNow}
            disabled={product.stock === 0}
          >
            Buy Now
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default memo(ProductCard);

