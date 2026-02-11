"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
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
    <section className="bg-wellness-600 dark:bg-wellness-800 py-16">
      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto max-w-xl">
          <Mail className="mx-auto mb-4 h-10 w-10 text-wellness-200" />
          <h2 className="mb-3 font-heading text-2xl font-bold text-white sm:text-3xl">
            Stay in the Wellness Loop
          </h2>
          <p className="mb-6 text-wellness-100">
            Get wellness tips, product updates, and exclusive offers delivered to
            your inbox.
          </p>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 border-wellness-500 bg-white/10 text-white placeholder:text-wellness-200 focus-visible:ring-white"
            />
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="bg-white text-wellness-700 hover:bg-wellness-50"
            >
              {loading ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-wellness-200">
            No spam, ever. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </section>
  );
}
