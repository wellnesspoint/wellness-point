"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("You're subscribed! Welcome aboard.");
        setEmail("");
      } else {
        toast.error(data.error || "Something went wrong");
      }
    } catch {
      toast.error("Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-wellness-700 via-wellness-800 to-wellness-900 py-14">
      {/* Decorative blobs */}
      <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-wellness-500/15 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-accent-400/10 blur-3xl" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <Mail className="h-7 w-7 text-wellness-200" />
          </div>

          {/* Headline */}
          <h2 className="mb-3 font-heading text-3xl font-bold text-white sm:text-4xl">
            Start Your Wellness Journey Today
          </h2>
          <p className="mb-2 text-lg text-wellness-100">
            Join thousands who have transformed their health with our premium
            natural supplements.
          </p>
          <p className="mb-8 text-sm text-wellness-300">
            Get wellness tips, product updates, and exclusive offers delivered
            to your inbox.
          </p>

          {/* Subscribe Form */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 border-wellness-500/30 bg-white/10 text-white placeholder:text-wellness-300 focus-visible:ring-white"
            />
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="bg-white text-wellness-800 hover:bg-wellness-50 font-semibold"
            >
              {loading ? (
                "Subscribing..."
              ) : (
                <span className="flex items-center gap-2">
                  Subscribe
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-4 text-xs text-wellness-300/80">
            No spam, ever. Unsubscribe anytime.
          </p>

          {/* Trust statement */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs text-wellness-200/70">
            <span>Made in India</span>
            <span className="text-wellness-500">•</span>
            <span>Secure Payments</span>
            <span className="text-wellness-500">•</span>
            <span>Quality Assured</span>
          </div>
        </div>
      </div>
    </section>
  );
}
