import HeroSection from "@/components/home/HeroSection";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import BenefitsSection from "@/components/home/BenefitsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQPreview from "@/components/home/FAQPreview";
import NewsletterSection from "@/components/home/NewsletterSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturedProducts />
      <BenefitsSection />
      <TestimonialsSection />
      <FAQPreview />
      <NewsletterSection />
    </>
  );
}
