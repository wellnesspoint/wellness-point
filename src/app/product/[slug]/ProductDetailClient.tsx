"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Heart,
  ShoppingCart,
  Star,
  Minus,
  Plus,
  Check,
  Truck,
  ShieldCheck,
  Zap,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/store/cart";
import { formatPrice, getDiscountPercentage } from "@/lib/utils";
import { FALLBACK_IMAGE } from "@/lib/constants";
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
    variants?: { _id: string; name: string; price: number; discountPrice?: number; stock: number; isActive?: boolean }[];
  };
}

export default function ProductDetailClient({
  product,
}: ProductDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  // Variants (size/flavour): only active ones are offered; the first in stock is preselected.
  const variants = (product.variants ?? []).filter((v) => v.isActive !== false);
  const [variantId, setVariantId] = useState<string | undefined>(
    () => (variants.find((v) => v.stock > 0) ?? variants[0])?._id
  );
  const variant = variants.find((v) => v._id === variantId);
  // Tracks which image indices failed to load (e.g. a dead hotlinked URL) so
  // they can fall back to a placeholder instead of a broken-image icon.
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const markFailed = (i: number) => setFailedImages((prev) => ({ ...prev, [i]: true }));
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const router = useRouter();
  const { data: session } = useSession();

  // Reviews state
  interface Review {
    _id: string;
    name: string;
    rating: number;
    comment: string;
    createdAt: string;
  }
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews?productId=${product._id}`)
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => { })
      .finally(() => setReviewsLoading(false));
  }, [product._id]);

  // What is on sale right now: the chosen variant, or the product itself.
  const sellable = variant ?? product;
  const stock = sellable.stock;
  const hasDiscount =
    sellable.discountPrice && sellable.discountPrice < sellable.price;
  const discountPercent = hasDiscount
    ? getDiscountPercentage(sellable.price, sellable.discountPrice!)
    : 0;
  const effectivePrice = hasDiscount ? sellable.discountPrice! : sellable.price;
  const cartLine = () => ({
    _id: product._id,
    ...(variant && { variantId: variant._id, variantName: variant.name }),
    name: product.name,
    slug: product.slug,
    price: sellable.price,
    discountPrice: sellable.discountPrice,
    image: product.images[0],
    quantity: 1,
    stock,
  });

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) addItem(cartLine());
    toast.success(`${product.name}${variant ? ` (${variant.name})` : ""} added to cart`);
    openCart();
  };

  const handleBuyNow = () => {
    addItem(cartLine());
    router.push("/checkout");
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      toast.error("Please login to submit a review");
      router.push("/login");
      return;
    }
    if (!reviewForm.comment.trim()) {
      toast.error("Please write a comment");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product._id,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }
      toast.success("Review submitted! It will appear after admin approval.");
      setReviewForm({ rating: 5, comment: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="py-8 pb-28 md:pb-8">
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
                src={
                  failedImages[selectedImage] || !product.images[selectedImage]
                    ? FALLBACK_IMAGE
                    : product.images[selectedImage]
                }
                alt={product.name}
                fill
                unoptimized={failedImages[selectedImage] || !product.images[selectedImage]}
                className="object-contain p-8"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                onError={() => markFailed(selectedImage)}
              />
            </div>
            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-all ${i === selectedImage
                        ? "border-wellness-600 shadow-md"
                        : "border-gray-200 hover:border-wellness-300"
                      }`}
                  >
                    <Image
                      src={failedImages[i] || !img ? FALLBACK_IMAGE : img}
                      alt={`${product.name} - view ${i + 1}`}
                      fill
                      unoptimized={failedImages[i] || !img}
                      className="object-contain p-2"
                      sizes="80px"
                      onError={() => markFailed(i)}
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
                    className={`h-5 w-5 ${i < Math.round(product.rating)
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
                    {formatPrice(sellable.price)}
                  </span>
                  <Badge variant="success">Save {discountPercent}%</Badge>
                </>
              )}
            </div>

            {variants.length > 0 && (
              <div role="radiogroup" aria-label="Choose an option" className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Option{variant ? `: ${variant.name}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const selected = v._id === variantId;
                    const out = v.stock <= 0;
                    return (
                      <button
                        key={v._id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setVariantId(v._id);
                          setQuantity(1);
                        }}
                        className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                          selected
                            ? "border-wellness-600 bg-wellness-50 text-wellness-800 ring-1 ring-wellness-600"
                            : "border-border bg-card text-foreground hover:bg-accent"
                        } ${out ? "opacity-50 line-through" : ""}`}
                      >
                        {v.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Stock */}
            <div className="flex items-center gap-2">
              {stock > 0 ? (
                <>
                  <Check className="h-4 w-4 text-wellness-600" />
                  <span className="text-sm font-medium text-wellness-700">
                    In Stock ({stock} available)
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
                    setQuantity(Math.min(stock, quantity + 1))
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
                disabled={stock === 0}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Add to Cart — {formatPrice(effectivePrice * quantity)}
              </Button>

              <Button
                size="lg"
                className="flex-1 bg-wellness-800 text-white hover:bg-wellness-900"
                onClick={handleBuyNow}
                disabled={stock === 0}
              >
                <Zap className="mr-2 h-5 w-5" />
                Buy Now
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
                <ShieldCheck className="h-5 w-5 text-wellness-600" />
                <span className="text-xs font-medium text-foreground">
                  No Refund/Exchange
                </span>
              </div>
            </div>

            {/* Policy Notice */}
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <p className="font-semibold">Policy:</p>
              <p>No COD • No Exchange or Replacement • No Refund</p>
            </div>
          </div>
        </div>

        {/* Detailed Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="description" className="w-full">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="w-max sm:w-full justify-start border-b bg-transparent p-0">
                <TabsTrigger
                  value="description"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm sm:px-6 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
                >
                  Description
                </TabsTrigger>
                <TabsTrigger
                  value="ingredients"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm sm:px-6 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
                >
                  Ingredients
                </TabsTrigger>
                <TabsTrigger
                  value="benefits"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm sm:px-6 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
                >
                  Benefits
                </TabsTrigger>
                <TabsTrigger
                  value="usage"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm sm:px-6 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
                >
                  How to Use
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm sm:px-6 data-[state=active]:border-wellness-600 data-[state=active]:bg-transparent"
                >
                  Reviews ({product.reviewCount})
                </TabsTrigger>
              </TabsList>
            </div>

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

            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-8">
                {/* Review Summary */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-foreground">{product.rating.toFixed(1)}</div>
                    <div className="flex gap-0.5 justify-center mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(product.rating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-muted text-muted"
                            }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{product.reviewCount} reviews</p>
                  </div>
                </div>

                <Separator />

                {/* Reviews List */}
                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-wellness-200 border-t-wellness-600" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="py-8 text-center">
                    <Star className="mx-auto mb-2 h-10 w-10 text-muted" />
                    <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review._id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wellness-100 text-wellness-700">
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{review.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(review.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-muted text-muted"
                                  }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Write a Review */}
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-foreground">Write a Review</h3>
                  {session ? (
                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <div>
                        <Label>Rating</Label>
                        <div className="flex gap-1 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setReviewForm({ ...reviewForm, rating: i + 1 })}
                              className="p-0.5 transition-transform hover:scale-110"
                            >
                              <Star
                                className={`h-8 w-8 ${i < reviewForm.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-muted text-muted hover:fill-yellow-200 hover:text-yellow-200"
                                  }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Your Review</Label>
                        <Textarea
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                          placeholder="Share your experience with this product..."
                          rows={4}
                          className="mt-1"
                        />
                      </div>
                      <Button type="submit" variant="wellness" disabled={submittingReview}>
                        <Send className="mr-2 h-4 w-4" />
                        {submittingReview ? "Submitting..." : "Submit Review"}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <p className="text-muted-foreground">
                        Please{" "}
                        <button
                          onClick={() => router.push("/login")}
                          className="font-medium text-wellness-600 underline hover:text-wellness-700"
                        >
                          log in
                        </button>{" "}
                        to write a review.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Phones: keep the buy button within thumb reach while scrolling */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none text-wellness-700">{formatPrice(effectivePrice * quantity)}</p>
            {variant && <p className="mt-1 truncate text-xs text-muted-foreground">{variant.name}</p>}
          </div>
          <Button
            variant="wellness"
            size="lg"
            className="h-12 flex-1"
            onClick={handleAddToCart}
            disabled={stock === 0}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            {stock === 0 ? "Out of stock" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}
