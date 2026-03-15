"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { Calendar, ArrowLeft, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface BlogPost {
    _id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage: string;
    images: string[];
    author: string;
    tags: string[];
    createdAt: string;
}

export default function BlogDetailPage() {
    const params = useParams();
    const slug = params?.slug as string;
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (!slug) return;
        async function fetchPost() {
            try {
                const res = await fetch(`/api/blogs/${slug}`);
                if (!res.ok) {
                    setError(true);
                    return;
                }
                const data = await res.json();
                setPost(data.blog);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }
        fetchPost();
    }, [slug]);

    // Build carousel images: cover + gallery images
    const allImages = post
        ? [post.coverImage, ...(post.images || [])].filter(Boolean)
        : [];

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % allImages.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    if (loading) {
        return (
            <div className="gradient-wellness py-16">
                <div className="container mx-auto max-w-3xl px-4">
                    <Skeleton className="mb-6 h-8 w-48" />
                    <Skeleton className="mb-4 aspect-video w-full rounded-xl" />
                    <Skeleton className="mb-2 h-10 w-3/4" />
                    <Skeleton className="mb-6 h-5 w-1/3" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-4 w-full" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="gradient-wellness py-16">
                <div className="container mx-auto max-w-3xl px-4 text-center">
                    <h1 className="mb-4 text-3xl font-bold text-foreground">
                        Blog Post Not Found
                    </h1>
                    <p className="mb-6 text-muted-foreground">
                        The blog post you&apos;re looking for doesn&apos;t exist or has been
                        removed.
                    </p>
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 rounded-lg bg-wellness-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-wellness-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Blog
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="gradient-wellness py-16">
            <div className="container mx-auto max-w-3xl px-4">
                {/* Back link */}
                <Link
                    href="/blog"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-wellness-600 hover:text-wellness-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blog
                </Link>

                {/* Image Carousel */}
                {allImages.length > 0 && (
                    <div className="relative mb-8 overflow-hidden rounded-2xl shadow-lg">
                        <div className="relative aspect-video">
                            <Image
                                src={allImages[currentSlide]}
                                alt={`${post.title} - Image ${currentSlide + 1}`}
                                fill
                                className="object-cover transition-all duration-500"
                                sizes="(max-width: 768px) 100vw, 768px"
                                priority
                            />
                        </div>

                        {/* Navigation arrows (only show if multiple images) */}
                        {allImages.length > 1 && (
                            <>
                                <button
                                    onClick={prevSlide}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                                    aria-label="Previous image"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={nextSlide}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                                    aria-label="Next image"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>

                                {/* Dots indicator */}
                                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                                    {allImages.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentSlide(idx)}
                                            className={`h-2 rounded-full transition-all ${idx === currentSlide
                                                    ? "w-6 bg-white"
                                                    : "w-2 bg-white/50 hover:bg-white/80"
                                                }`}
                                            aria-label={`Go to image ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Tags */}
                {post.tags?.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                            <Badge key={tag} variant="success" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Title */}
                <h1 className="mb-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">
                    {post.title}
                </h1>

                {/* Meta */}
                <div className="mb-8 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        {post.author}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {new Date(post.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })}
                    </div>
                </div>

                {/* Content — sanitized to prevent XSS */}
                <article
                    className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-wellness-600 prose-strong:text-foreground prose-img:rounded-xl"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allowfullscreen", "frameborder", "target"] }) }}
                />
            </div>
        </div>
    );
}
