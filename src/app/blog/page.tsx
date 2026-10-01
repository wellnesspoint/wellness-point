import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Calendar, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import connectDB from "@/lib/db";
import Blog from "@/models/Blog";
import { publicBlogFilter } from "@/lib/blog-visibility";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Tips, insights, and research on nutrition, wellness, and healthy living from Wellness Point.",
};

export default async function BlogPage() {
  await connectDB();
  const posts = await Blog.find(publicBlogFilter())
    .sort({ createdAt: -1 })
    .select("-content")
    .lean();

  return (
    <div className="gradient-wellness py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Wellness Journal
          </span>
          <h1 className="mt-2 font-heading text-4xl font-bold text-foreground">
            Our Blog
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Tips, insights, and research on nutrition, wellness, and healthy
            living.
          </p>
        </div>

        {posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={String(post._id)} href={`/blog/${post.slug}`}>
                <Card
                  className="group overflow-hidden border-0 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg h-full"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {post.tags?.slice(0, 2).map((tag: string) => (
                        <Badge key={tag} variant="success" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <h2 className="mb-2 font-heading text-lg font-semibold text-card-foreground line-clamp-2 group-hover:text-wellness-600">
                      {post.title}
                    </h2>
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-wellness-600">
                        Read More
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-16 text-center">
            <p className="text-lg text-muted-foreground">
              Blog posts coming soon! Stay tuned.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
