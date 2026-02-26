import mongoose, { Document, Schema, Model } from "mongoose";

export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  images: string[];
  author: string;
  tags: string[];
  isPublished: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const blogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    excerpt: { type: String, required: true, maxlength: 300 },
    content: { type: String, required: true },
    coverImage: { type: String, required: true },
    images: [{ type: String }],
    author: { type: String, default: "Wellness Point" },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    metaTitle: { type: String },
    metaDescription: { type: String },
  },
  {
    timestamps: true,
  }
);

blogSchema.index({ slug: 1 });
blogSchema.index({ isPublished: 1, createdAt: -1 });

const Blog: Model<IBlog> =
  mongoose.models.Blog || mongoose.model<IBlog>("Blog", blogSchema);

export default Blog;
