import HeroSection from "@/components/home/HeroSection";
import PromoBanners from "@/components/home/PromoBanners";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import BenefitsSection from "@/components/home/BenefitsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQPreview from "@/components/home/FAQPreview";
import NewsletterSection from "@/components/home/NewsletterSection";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Testimonial from "@/models/Testimonial";
import Banner from "@/models/Banner";

// ISR: regenerate homepage every 5 minutes
export const revalidate = 300;

export default async function HomePage() {
  await connectDB();

  const now = new Date();
  const [products, testimonials, banners] = await Promise.all([
    Product.find({ isActive: true })
      .select("name slug price discountPrice images shortDescription rating reviewCount stock")
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
    Testimonial.find({ isApproved: true })
      .select("name role content rating")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
    // Active banners inside their optional start/end window (Admin → Marketing).
    Banner.find({
      isActive: true,
      position: { $in: ["hero", "promo"] },
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    })
      .select("title subtitle imageUrl linkUrl position")
      .sort({ position: 1, sortOrder: 1, createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const serializedProducts = JSON.parse(JSON.stringify(products));
  const serializedTestimonials = JSON.parse(JSON.stringify(testimonials));
  const serializedBanners = JSON.parse(JSON.stringify(banners));

  return (
    <>
      <HeroSection />
      <PromoBanners banners={serializedBanners} />
      <FeaturedProducts initialProducts={serializedProducts} />
      <BenefitsSection />
      <TestimonialsSection initialTestimonials={serializedTestimonials} />
      <FAQPreview />
      <NewsletterSection />
    </>
  );
}
