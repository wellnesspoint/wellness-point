import mongoose, { Document, Schema, Model } from "mongoose";

export interface ITestimonial extends Document {
  name: string;
  role?: string;
  image?: string;
  content: string;
  rating: number;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String },
    image: { type: String },
    content: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    isApproved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

testimonialSchema.index({ isApproved: 1, createdAt: -1 });

const Testimonial: Model<ITestimonial> =
  mongoose.models.Testimonial ||
  mongoose.model<ITestimonial>("Testimonial", testimonialSchema);

export default Testimonial;
