import HeroSection from "@/components/home/HeroSection";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import BenefitsSection from "@/components/home/BenefitsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQPreview from "@/components/home/FAQPreview";
import NewsletterSection from "@/components/home/NewsletterSection";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Testimonial from "@/models/Testimonial";

// ISR: regenerate homepage every 5 minutes
export const revalidate = 300;

export default async function HomePage() {
  await connectDB();

  const [products, testimonials] = await Promise.all([
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
  ]);

  const serializedProducts = JSON.parse(JSON.stringify(products));
  const serializedTestimonials = JSON.parse(JSON.stringify(testimonials));

  return (
    <>
      <HeroSection />
      <FeaturedProducts initialProducts={serializedProducts} />
      <BenefitsSection />
      <TestimonialsSection initialTestimonials={serializedTestimonials} />
      <FAQPreview />
      <NewsletterSection />
    </>
  );
}
