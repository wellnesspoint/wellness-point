import React from "react";
import type { Metadata } from "next";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import ShopGrid from "./ShopGrid";

// ISR: regenerate shop page every 5 minutes
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Explore our collection of premium natural supplements, crafted for your whole-body wellness.",
};

export default async function ShopPage() {
  await connectDB();
  const products = await Product.find({ isActive: true })
    .select("name slug price discountPrice images shortDescription rating reviewCount stock")
    .sort({ createdAt: -1 })
    .lean();

  const serialized = JSON.parse(JSON.stringify(products));

  return (
    <div className="gradient-wellness min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Our Products
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Explore our collection of premium natural supplements, crafted for
            your whole-body wellness.
          </p>
        </div>
        <ShopGrid products={serialized} />
      </div>
    </div>
  );
}
