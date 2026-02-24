import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CTASection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-wellness-700 to-wellness-900 p-10 text-center text-white shadow-2xl sm:p-16">
          {/* Decorative elements */}
          <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-wellness-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-wellness-400/20 blur-3xl" />

          <div className="relative z-10">
            <h2 className="mb-4 font-heading text-3xl font-bold sm:text-4xl">
              Start Your Wellness Journey Today
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-lg text-wellness-200">
              Join thousands who have transformed their health with our premium
              natural supplements.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="bg-white text-wellness-800 hover:bg-wellness-50 hover:text-wellness-800"
                asChild
              >
                <Link href="/shop" className="flex items-center gap-2">
                  Explore Products
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                className="border-2 border-white bg-transparent text-white hover:bg-white hover:text-wellness-800"
                asChild
              >
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
