import React from "react";
import { cloudinaryUrl } from "@/lib/utils";
import Link from "next/link";

export interface PublicBanner {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  position: "hero" | "promo" | "sidebar";
}

function BannerCard({ banner, tall }: { banner: PublicBanner; tall?: boolean }) {
  const content = (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-wellness-50 shadow-sm ${
        tall ? "aspect-[16/6]" : "aspect-[16/7]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cloudinaryUrl(banner.imageUrl, 1200)}
        decoding="async"
        alt={banner.title}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4 sm:p-6">
        <p className="font-heading text-lg font-bold text-white sm:text-2xl">{banner.title}</p>
        {banner.subtitle && <p className="mt-1 text-sm text-white/90">{banner.subtitle}</p>}
      </div>
    </div>
  );

  if (!banner.linkUrl) return content;
  return banner.linkUrl.startsWith("/") ? (
    <Link href={banner.linkUrl}>{content}</Link>
  ) : (
    <a href={banner.linkUrl} rel="noopener noreferrer">
      {content}
    </a>
  );
}

/** Admin-managed banners (Admin → Marketing): "hero" stacked full-width, "promo" in a grid. */
export default function PromoBanners({ banners }: { banners: PublicBanner[] }) {
  const hero = banners.filter((b) => b.position === "hero");
  const promo = banners.filter((b) => b.position === "promo");
  if (hero.length === 0 && promo.length === 0) return null;

  return (
    <section className="container mx-auto space-y-4 px-4 py-6">
      {hero.map((b) => (
        <BannerCard key={b._id} banner={b} tall />
      ))}
      {promo.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {promo.map((b) => (
            <BannerCard key={b._id} banner={b} />
          ))}
        </div>
      )}
    </section>
  );
}
