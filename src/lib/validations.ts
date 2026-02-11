import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and a number"
    ),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(3, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export const addressSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  street: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Valid 6-digit pincode is required"),
  isDefault: z.boolean().optional(),
});

export const newsletterSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  shortDescription: z.string().max(200, "Short description max 200 characters"),
  price: z.number().positive("Price must be positive"),
  discountPrice: z.number().positive().optional(),
  images: z.array(z.string().url()).min(1, "At least one image is required"),
  ingredients: z.array(z.string()),
  benefits: z.array(z.string()),
  usage: z.string(),
  stock: z.number().int().min(0),
  isFeatured: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;
export type ProductInput = z.infer<typeof productSchema>;
