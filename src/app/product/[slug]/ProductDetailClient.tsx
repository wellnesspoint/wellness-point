"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Heart,
  ShoppingCart,
  Star,
  Minus,
  Plus,
  Check,
  Truck,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/store/cart";
import { formatPrice, getDiscountPercentage } from "@/lib/utils";
import toast from "react-hot-toast";

interface ProductDetailClientProps {
  product: {
    _id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription: string;
    price: number;
    discountPrice?: number;
    images: string[];
    ingredients: string[];
    benefits: string[];
    usage: string;
    stock: number;
    rating: number;
    reviewCount: number;
  };
}

export default function ProductDetailClient({
  product,
}: ProductDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const hasDiscount =
    product.discountPrice && product.discountPrice < product.price;
  const discountPercent = hasDiscount
    ? getDiscountPercentage(product.price, product.discountPrice!)
    : 0;
  const effectivePrice = hasDiscount ? product.discountPrice! : product.price;

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
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
    }
    toast.success(`${product.name} added to cart`);
    openCart();
  };

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-b from-wellness-50 to-white">
              {hasDiscount && (
                <Badge className="absolute left-4 top-4 z-10 bg-red-500 text-white">
                  -{discountPercent}% OFF
                </Badge>
              )}
              <Image
                src={product.images[selectedImage] || "/images/placeholder.jpg"}
                alt={product.name}
                fill
                className="object-contain p-8"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            </div>
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-all ${
                      i === selectedImage
                        ? "border-wellness-600 shadow-md"
                        : "border-gray-200 hover:border-wellness-300"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} - view ${i + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-2 text-muted-foreground">{product.shortDescription}</p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(product.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-muted text-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                ({product.reviewCount} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-wellness-700">
                {formatPrice(effectivePrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(product.price)}
                  </span>
                  <Badge variant="success">Save {discountPercent}%</Badge>
                </>
              )}
            </div>

            <Separator />

            {/* Stock */}
            <div className="flex items-center gap-2">
              {product.stock > 0 ? (
                <>
                  <Check className="h-4 w-4 text-wellness-600" />
                  <span className="text-sm font-medium text-wellness-700">
                    In Stock ({product.stock} available)
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-red-500">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Quantity + Cart */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex items-center rounded-lg border">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 text-muted-foreground hover:text-foreground"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[48px] text-center font-medium">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity(Math.min(product.stock, quantity + 1))
                  }
                  className="px-4 py-3 text-muted-foreground hover:text-foreground"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                variant="wellness"
                size="lg"
                className="flex-1"
                onClick={handleAddToCart}
                disabled={product.stock === 0}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart — {formatPrice(effectivePrice * quantity)}
              </Button>

              <Button variant="outline" size="icon" className="h-12 w-12 shrink-0">
                <Heart className="h-5 w-5" />
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 rounded-xl bg-wellness-50 p-4">
              <div className="flex flex-col items-center gap-1 text-center">
                <Truck className="h-5 w-5 text-wellness-600" />
                <span className="text-xs font-medium text-foreground">
                  Free Shipping
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <ShieldCheck className="h-5 w-5 text-wellness-600" />
                <span className="text-xs font-medium text-foreground">
                  Lab Tested
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <RotateCcw className="h-5 w-5 text-wellness-600" />
                <span className="text-xs font-medium text-foreground">
                  30-Day Returns
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start border-b bg-transparent p-0">
              <TabsTrigger
                value="description"
                className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
              >
                Description
              </TabsTrigger>
              <TabsTrigger
                value="ingredients"
                className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
              >
                Ingredients
              </TabsTrigger>
              <TabsTrigger
                value="benefits"
                className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
              >
                Benefits
              </TabsTrigger>
              <TabsTrigger
                value="usage"
                className="rounded-none border-b-2 border-transparent px-6 py-3 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
              >
                How to Use
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <div className="prose max-w-none text-muted-foreground">
                <p className="whitespace-pre-line">{product.description}</p>
              </div>
            </TabsContent>

            <TabsContent value="ingredients" className="mt-6">
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.ingredients.map((ingredient, i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-wellness-600" />
                    {ingredient}
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="benefits" className="mt-6">
              <ul className="grid gap-3 sm:grid-cols-2">
                {product.benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-wellness-50 p-3"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-wellness-600" />
                    <span className="text-sm text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="usage" className="mt-6">
              <div className="rounded-lg bg-wellness-50 p-6">
                <p className="text-foreground whitespace-pre-line">{product.usage}</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
