import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wellness-point";

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db!;

    // --- Admin User ---
    const usersCol = db.collection("users");
    const existingAdmin = await usersCol.findOne({ email: "admin@wellness-point.in" });
    if (!existingAdmin) {
      const hashedPw = await bcrypt.hash("admin123", 12);
      await usersCol.insertOne({
        name: "Admin",
        email: "admin@wellness-point.in",
        password: hashedPw,
        role: "admin",
        provider: "credentials",
        isActive: true,
        emailVerified: true,
        addresses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("✓ Admin user created (admin@wellness-point.in / admin123)");
    } else {
      console.log("✓ Admin user already exists");
    }

    // --- Products ---
    const productsCol = db.collection("products");
    const productCount = await productsCol.countDocuments();
    if (productCount === 0) {
      const products = [
        {
          name: "Organic Ashwagandha Capsules",
          slug: "organic-ashwagandha-capsules",
          description:
            "Premium organic Ashwagandha (Withania somnifera) capsules for stress relief, improved energy levels, and enhanced cognitive function. Made from highest quality KSM-66 root extract.",
          shortDescription: "KSM-66 Ashwagandha for stress relief, energy & cognitive support.",
          price: 899,
          discountPrice: 699,
          images: [
            "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600",
          ],
          ingredients: ["KSM-66 Ashwagandha Root Extract 600mg", "Vegetarian Capsule Shell", "Rice Flour"],
          benefits: [
            "Reduces stress & anxiety",
            "Boosts energy & stamina",
            "Supports brain function",
            "Enhances immunity",
          ],
          usage: "Take 1 capsule twice daily with water after meals.",
          stock: 150,
          isFeatured: true,
          isActive: true,
          category: "Herbs",
          rating: 4.7,
          reviewCount: 234,
          metaTitle: "Organic Ashwagandha Capsules | Wellness Point",
          metaDescription: "Buy premium KSM-66 Ashwagandha capsules for stress relief and energy.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Whey Protein Isolate – Chocolate",
          slug: "whey-protein-isolate-chocolate",
          description:
            "Ultra-pure Whey Protein Isolate with 27g protein per serving. Zero added sugar, fast absorbing, and perfect for post-workout recovery. Rich chocolate flavor.",
          shortDescription: "27g protein per scoop, zero sugar, rich chocolate flavor.",
          price: 2499,
          discountPrice: 1999,
          images: [
            "https://images.unsplash.com/photo-1693996045300-521e9d08cabc?w=600",
          ],
          ingredients: ["Whey Protein Isolate", "Cocoa Powder", "Natural Flavors", "Stevia"],
          benefits: [
            "27g protein per serving",
            "Lean muscle building",
            "Fast absorption",
            "Zero added sugar",
          ],
          usage: "Mix 1 scoop (30g) with 200ml cold water or milk. Shake well.",
          stock: 80,
          isFeatured: true,
          isActive: true,
          category: "Protein",
          rating: 4.8,
          reviewCount: 512,
          metaTitle: "Whey Protein Isolate Chocolate | Wellness Point",
          metaDescription: "Premium whey protein isolate with 27g protein per scoop. Buy now!",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Omega-3 Fish Oil Softgels",
          slug: "omega-3-fish-oil-softgels",
          description:
            "Triple strength Omega-3 fish oil softgels with 1000mg EPA & DHA per serving. Sourced from deep-sea wild-caught fish, molecularly distilled for purity.",
          shortDescription: "Triple strength EPA & DHA from wild-caught fish.",
          price: 1199,
          discountPrice: 949,
          images: [
            "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600",
          ],
          ingredients: ["Fish Oil Concentrate", "Gelatin", "Glycerin", "Vitamin E"],
          benefits: [
            "Heart health support",
            "Brain & eye health",
            "Joint mobility",
            "Anti-inflammatory",
          ],
          usage: "Take 2 softgels daily with meals.",
          stock: 200,
          isFeatured: true,
          isActive: true,
          category: "Vitamins",
          rating: 4.5,
          reviewCount: 178,
          metaTitle: "Omega-3 Fish Oil Softgels | Wellness Point",
          metaDescription: "Triple strength Omega-3 fish oil for heart and brain health.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Multivitamin Daily Tablets",
          slug: "multivitamin-daily-tablets",
          description:
            "Complete daily multivitamin with 23 essential vitamins and minerals. Includes Vitamin D3, B12, Iron, Zinc, and antioxidants for overall health and wellness.",
          shortDescription: "23 essential vitamins & minerals for daily wellness.",
          price: 599,
          discountPrice: 499,
          images: [
            "https://images.unsplash.com/photo-1550572017-edd951b55104?w=600",
          ],
          ingredients: ["Vitamin A", "Vitamin C", "Vitamin D3", "Vitamin E", "B-Complex", "Iron", "Zinc", "Selenium"],
          benefits: [
            "Fills nutritional gaps",
            "Boosts immunity",
            "Energy metabolism",
            "Antioxidant protection",
          ],
          usage: "Take 1 tablet daily with breakfast.",
          stock: 300,
          isFeatured: true,
          isActive: true,
          category: "Vitamins",
          rating: 4.6,
          reviewCount: 392,
          metaTitle: "Multivitamin Daily Tablets | Wellness Point",
          metaDescription: "Complete daily multivitamin with 23 essential vitamins and minerals.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Plant-Based Collagen Builder",
          slug: "plant-based-collagen-builder",
          description:
            "Vegan collagen-boosting formula with Vitamin C, Hyaluronic Acid, and Bamboo Silica. Supports skin elasticity, hair strength, and joint health naturally.",
          shortDescription: "Vegan collagen booster for skin, hair & joints.",
          price: 1399,
          images: [
            "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600",
          ],
          ingredients: ["Vitamin C", "Hyaluronic Acid", "Bamboo Silica Extract", "Biotin", "Zinc"],
          benefits: [
            "Glowing skin",
            "Stronger hair & nails",
            "Joint support",
            "100% plant-based",
          ],
          usage: "Take 2 capsules daily with water.",
          stock: 120,
          isFeatured: false,
          isActive: true,
          category: "Beauty",
          rating: 4.4,
          reviewCount: 98,
          metaTitle: "Plant-Based Collagen Builder | Wellness Point",
          metaDescription: "Vegan collagen builder for skin, hair, and joints.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Probiotic 50 Billion CFU",
          slug: "probiotic-50-billion-cfu",
          description:
            "Advanced probiotic supplement with 16 strains and 50 billion CFU per capsule. Supports digestive health, immune function, and gut-brain connection.",
          shortDescription: "16-strain probiotic with 50 billion CFU per capsule.",
          price: 1599,
          discountPrice: 1299,
          images: [
            "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=600",
          ],
          ingredients: ["Lactobacillus Acidophilus", "Bifidobacterium Lactis", "Prebiotic FOS", "Delayed-Release Capsule"],
          benefits: [
            "Gut health",
            "Better digestion",
            "Immune support",
            "Mood balance",
          ],
          usage: "Take 1 capsule daily on an empty stomach.",
          stock: 90,
          isFeatured: false,
          isActive: true,
          category: "Gut Health",
          rating: 4.3,
          reviewCount: 145,
          metaTitle: "Probiotic 50 Billion CFU | Wellness Point",
          metaDescription: "Advanced 16-strain probiotic for gut health and immunity.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await productsCol.insertMany(products);
      console.log(`✓ ${products.length} products seeded`);
    } else {
      console.log(`✓ ${productCount} products already exist`);
    }

    // --- Testimonials ---
    const testimonialsCol = db.collection("testimonials");
    const testimCount = await testimonialsCol.countDocuments();
    if (testimCount === 0) {
      const testimonials = [
        {
          name: "Priya Sharma",
          role: "Yoga Instructor",
          image: "",
          content:
            "I've been using Wellness Point's Ashwagandha for 3 months and the difference in my stress levels is remarkable. Finally sleeping well and feeling energized throughout the day!",
          rating: 5,
          isApproved: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Rahul Mehta",
          role: "Fitness Enthusiast",
          image: "",
          content:
            "The whey protein quality is top-notch. Mixes smoothly, tastes great, and I've seen real gains in my workouts. Best protein brand in India, hands down.",
          rating: 5,
          isApproved: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Ananya Desai",
          role: "Working Professional",
          image: "",
          content:
            "The multivitamins have become an essential part of my daily routine. I feel more energetic and haven't fallen sick in months. Great value for money!",
          rating: 4,
          isApproved: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Dr. Vikram Patel",
          role: "Nutritionist",
          image: "",
          content:
            "I recommend Wellness Point to all my clients. Their products are scientifically formulated, transparently labeled, and use high-quality ingredients. Truly a brand I trust.",
          rating: 5,
          isApproved: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await testimonialsCol.insertMany(testimonials);
      console.log(`✓ ${testimonials.length} testimonials seeded`);
    } else {
      console.log(`✓ ${testimCount} testimonials already exist`);
    }

    // --- Blogs ---
    const blogsCol = db.collection("blogs");
    const blogCount = await blogsCol.countDocuments();
    if (blogCount === 0) {
      const blogs = [
        {
          title: "5 Science-Backed Benefits of Ashwagandha",
          slug: "5-science-backed-benefits-of-ashwagandha",
          excerpt:
            "Discover how this ancient Ayurvedic herb can reduce stress, boost brain function, and improve overall well-being.",
          content:
            "Ashwagandha (Withania somnifera) has been used in Ayurvedic medicine for over 3,000 years. Modern science is now validating many of its traditional uses.\n\n## 1. Reduces Stress and Anxiety\nMultiple clinical studies have shown that ashwagandha can significantly reduce cortisol levels and perceived stress.\n\n## 2. Enhances Brain Function\nResearch shows improved memory, reaction time, and information processing in supplementing individuals.\n\n## 3. Boosts Physical Performance\nAthletes supplementing with ashwagandha showed improved VO2 max and exercise performance.\n\n## 4. Supports Immune Health\nAshwagandha enhances natural killer cell activity and overall immune function.\n\n## 5. Improves Sleep Quality\nStudies demonstrate that ashwagandha root extract can improve sleep quality and help manage insomnia.",
          coverImage:
            "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800",
          tags: ["Ashwagandha", "Ayurveda", "Stress Relief", "Supplements"],
          isPublished: true,
          metaTitle: "5 Science-Backed Benefits of Ashwagandha | Wellness Point Blog",
          metaDescription: "Learn about the proven benefits of Ashwagandha supported by modern science.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          title: "The Complete Guide to Choosing a Protein Powder",
          slug: "complete-guide-choosing-protein-powder",
          excerpt:
            "Whey isolate, concentrate, or plant-based? Learn how to pick the right protein powder for your fitness goals.",
          content:
            "Protein supplements are one of the most popular categories in the wellness industry. Here's everything you need to know.\n\n## Types of Protein Powders\n\n### Whey Protein Isolate\nHighest protein concentration (90%+), minimal lactose and fat. Ideal for lean muscle building.\n\n### Whey Concentrate\nMore affordable option with 70-80% protein. Contains more natural fats and carbs.\n\n### Plant-Based Protein\nMade from pea, rice, hemp, or soy. Great for vegans and those with dairy sensitivity.\n\n## How Much Protein Do You Need?\nGeneral guideline: 1.6-2.2g per kg of body weight for active individuals.\n\n## When to Take Protein\nPost-workout (within 30 minutes), between meals, or before bed for overnight muscle recovery.",
          coverImage:
            "https://images.unsplash.com/photo-1593095948071-474c5cc2c4d8?w=800",
          tags: ["Protein", "Fitness", "Nutrition", "Guide"],
          isPublished: true,
          metaTitle: "Complete Guide to Choosing Protein Powder | Wellness Point Blog",
          metaDescription: "Everything you need to know about picking the right protein powder.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await blogsCol.insertMany(blogs);
      console.log(`✓ ${blogs.length} blog posts seeded`);
    } else {
      console.log(`✓ ${blogCount} blog posts already exist`);
    }

    console.log("\n🌿 Seed complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

seed();
