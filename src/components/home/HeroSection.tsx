import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden gradient-hero">
      {/* Decorative blobs */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-wellness-300/20 blur-3xl dark:bg-wellness-500/10" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-wellness-200/30 blur-3xl dark:bg-wellness-600/10" />

      <div className="container relative mx-auto flex min-h-[85vh] flex-col items-center justify-center px-4 py-20 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-wellness-100 px-4 py-1.5 text-sm font-medium text-wellness-800 dark:bg-wellness-900/50 dark:text-wellness-300">
          <Sparkles className="h-4 w-4" />
          Trusted by 10,000+ happy customers
        </div>

        {/* Heading */}
        <h1 className="mb-6 max-w-4xl font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          Nourish Your Body,{" "}
          <span className="bg-gradient-to-r from-wellness-600 to-wellness-400 bg-clip-text text-transparent">
            Elevate Your Life
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Premium food supplements crafted with 100% natural ingredients,
          scientifically formulated for whole-body wellness. Start your health
          journey today.
        </p>

        {/* CTA */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button variant="wellness" size="lg" asChild>
            <Link href="/shop" className="flex items-center gap-2">
              Shop Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="border-wellness-600 text-wellness-700 hover:bg-wellness-50 dark:border-wellness-400 dark:text-wellness-400 dark:hover:bg-wellness-900/50">
            <Link href="/about">Learn More</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-wellness-500" />
            100% Natural
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-wellness-500" />
            Lab Tested
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-wellness-500" />
            Free Shipping
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-wellness-500" />
            Prepaid Only
          </div>
        </div>
      </div>
    </section>
  );
}
