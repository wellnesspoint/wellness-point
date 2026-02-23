import React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const highlights = [
  "Founded with a passion for natural wellness",
  "Products sourced from trusted organic farms",
  "Formulated by certified nutritionists",
  "GMP-certified manufacturing process",
  "Over 10,000 satisfied customers across India",
  "FSSAI approved and lab-tested for purity",
];

export default function BrandStorySection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: visual */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-wellness-100 to-wellness-200 p-1">
              <div className="rounded-[calc(1.5rem-4px)] bg-gradient-to-br from-wellness-50 to-white p-10 sm:p-14">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-wellness-500 to-wellness-700 shadow-xl">
                    <span className="text-3xl font-bold text-white">W</span>
                  </div>
                  <h3 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                    Wellness Point
                  </h3>
                  <p className="mt-2 text-sm font-medium text-wellness-600">
                    Your Trusted Wellness Partner
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {["Natural", "Organic", "Lab-Tested", "FSSAI Approved"].map(
                      (badge) => (
                        <span
                          key={badge}
                          className="rounded-full bg-wellness-100 px-4 py-1.5 text-xs font-semibold text-wellness-700"
                        >
                          {badge}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative blobs */}
            <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-full bg-wellness-300/20 blur-2xl" />
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-wellness-200/30 blur-2xl" />
          </div>

          {/* Right: content */}
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
              Our Story
            </span>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Why Wellness Point?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              At Wellness Point, we believe that true wellness starts with what
              you put in your body. Our journey began with a simple mission — to
              make premium, natural health supplements accessible to everyone
              across India.
            </p>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Every product is carefully crafted with ethically sourced
              ingredients, backed by science, and tested for purity. We&apos;re
              not just a brand — we&apos;re your wellness partner.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {highlights.map((item, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-wellness-500" />
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Button variant="wellness" size="lg" asChild>
                <Link href="/about" className="flex items-center gap-2">
                  Learn More About Us
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
