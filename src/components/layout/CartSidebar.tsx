"use client";

import { lineKey } from "@/lib/variants";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore, CartItem } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FALLBACK_IMAGE } from "@/lib/constants";

export default function CartSidebar() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, getSubtotal } =
    useCartStore();

  const subtotal = getSubtotal();
  const shipping = subtotal > 0 ? (subtotal >= 999 ? 0 : 99) : 0;
  const total = subtotal + shipping;

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeCart}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-wellness-600" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Your Cart ({items.length})
            </h2>
          </div>
          <button
            onClick={closeCart}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground/30" />
              <p className="mb-2 text-lg font-medium text-foreground">
                Your cart is empty
              </p>
              <p className="mb-6 text-sm text-muted-foreground">
                Discover our wellness products and start your journey.
              </p>
              <Button variant="wellness" onClick={closeCart} asChild>
                <Link href="/shop">Browse Products</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <CartItemCard
                  key={lineKey(item._id, item.variantId)}
                  item={item}
                  onRemove={() => removeItem(lineKey(item._id, item.variantId))}
                  onUpdateQuantity={(qty) => updateQuantity(lineKey(item._id, item.variantId), qty)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-6 py-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-medium text-foreground">
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-wellness-600">
                  Free shipping on orders above {formatPrice(999)}
                </p>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="text-wellness-600">{formatPrice(total)}</span>
              </div>
            </div>
            <Button
              variant="wellness"
              size="lg"
              className="mt-4 w-full"
              onClick={closeCart}
              asChild
            >
              <Link href="/checkout" className="flex items-center gap-2">
                Checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (qty: number) => void;
}) {
  const effectivePrice = item.discountPrice || item.price;
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex gap-3 rounded-xl border border-border p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image
          src={imgError || !item.image ? FALLBACK_IMAGE : item.image}
          alt={item.name}
          fill
          unoptimized={imgError || !item.image}
          className="object-cover"
          sizes="80px"
          onError={() => setImgError(true)}
        />
      </div>
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex justify-between">
          <Link
            href={`/product/${item.slug}`}
            className="text-sm font-medium text-foreground hover:text-wellness-600"
          >
            {item.name}
            {item.variantName && (
              <span className="block text-xs font-normal text-muted-foreground">{item.variantName}</span>
            )}
          </Link>
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500"
            aria-label={`Remove ${item.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg border border-border">
            <button
              onClick={() => onUpdateQuantity(item.quantity - 1)}
              className="p-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[24px] text-center text-sm font-medium text-foreground">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              disabled={item.quantity >= item.stock}
              className="p-2.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-sm font-semibold text-wellness-600">
            {formatPrice(effectivePrice * item.quantity)}
          </span>
        </div>
      </div>
    </div>
  );
}
