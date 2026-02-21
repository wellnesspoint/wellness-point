import mongoose, { Schema, Document } from "mongoose";

export interface IBanner extends Document {
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  position: "hero" | "promo" | "sidebar";
  isActive: boolean;
  sortOrder: number;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, trim: true },
    position: {
      type: String,
      enum: ["hero", "promo", "sidebar"],
      default: "hero",
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.Banner ||
  mongoose.model<IBanner>("Banner", BannerSchema);
