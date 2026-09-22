import React, { cache } from "react";
import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { stripSiteNameSuffix } from "@/lib/utils";
import { SITE_CONFIG } from "@/lib/constants";

const getProduct = cache(async (slug: string) => {
  await connectDB();
  return Product.findOne({ slug, isActive: true }).lean();
});

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: "Product Not Found" };
  }

  return {
    title: stripSiteNameSuffix(product.metaTitle || product.name, SITE_CONFIG.name),
    description: product.metaDescription || product.shortDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: product.images[0] ? [{ url: product.images[0] }] : [],
      type: "website",
    },
    other: {
      "product:price:amount": String(product.discountPrice || product.price),
      "product:price:currency": "INR",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Product Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            The product you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  const serialized = JSON.parse(JSON.stringify(product));

  // JSON-LD Schema Markup
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.images,
    offers: {
      "@type": "Offer",
      price: product.discountPrice || product.price,
      priceCurrency: "INR",
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    aggregateRating: product.reviewCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient product={serialized} />
    </>
  );
}
