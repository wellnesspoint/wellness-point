import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white via-wellness-50/40 to-white">
      {/* Subtle decorative elements */}
      <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-wellness-100/40 blur-[120px]" />
      <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-accent-50/50 blur-[100px]" />

      <div className="container relative mx-auto px-4">
        <div className="grid min-h-[72vh] items-center gap-12 lg:grid-cols-2">
          {/* Left: Content */}
          <div className="flex flex-col justify-center py-16 lg:py-24">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-wellness-200 bg-wellness-50 px-4 py-1.5 text-sm font-medium text-wellness-700">
              <span className="flex h-2 w-2 rounded-full bg-wellness-500" />
              Trusted by 10,000+ customers
            </div>

            <h1 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-heading">Stronger Health.</span>
              <br />
              <span className="bg-gradient-to-r from-wellness-600 to-wellness-500 bg-clip-text text-transparent">
                Smarter Nutrition.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Science-backed supplements designed to support your everyday
              wellness — clean ingredients, quality tested, and made for modern
              lifestyles.
            </p>

            <p className="mt-3 max-w-lg text-sm text-muted-foreground/80">
              Premium nutrition formulated to help you feel better, perform
              better, and live healthier.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="wellness" size="lg" asChild>
                <Link href="/shop" className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Shop Now
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-wellness-300 text-wellness-700 hover:bg-wellness-50"
              >
                <Link href="/shop" className="flex items-center gap-2">
                  Explore Products
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Mini trust indicators */}
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-wellness-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                FSSAI Approved
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-wellness-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Lab Tested
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Made in India
              </div>
            </div>
          </div>

          {/* Right: Visual Element */}
          <div className="relative hidden lg:flex lg:items-center lg:justify-center">
            {/* Large decorative circle */}
            <div className="relative h-[480px] w-[480px]">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-wellness-100 via-wellness-50 to-accent-50 shadow-2xl" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-tl from-wellness-50 to-white shadow-inner" />
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-white shadow-xl p-2">
                  <Image
                    src="/logo.png"
                    alt="Wellness Point Logo"
                    width={140}
                    height={140}
                    className="h-36 w-36 object-contain"
                  />
                </div>
                <p className="mt-4 font-heading text-xl font-bold text-heading">
                  Wellness Point
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your Trusted Wellness Partner
                </p>
                <div className="mt-5 flex gap-2">
                  {["Natural", "Organic", "Lab-Tested"].map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-wellness-100 px-3 py-1 text-xs font-semibold text-wellness-700"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating cards */}
            <div className="absolute -left-4 top-16 rounded-2xl border border-wellness-100 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wellness-100 text-wellness-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-heading">100% Natural</p>
                  <p className="text-[10px] text-muted-foreground">No chemicals or additives</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 bottom-24 rounded-2xl border border-accent-100 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-accent-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-heading">FSSAI Approved</p>
                  <p className="text-[10px] text-muted-foreground">Quality certified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
