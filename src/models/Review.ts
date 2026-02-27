import mongoose, { Document, Schema, Model } from "mongoose";

export interface IReview extends Document {
  product: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  rating: number;
  title: string;
  content: string;
  isApproved: boolean;
  adminReply?: string;
  adminRepliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    isApproved: { type: Boolean, default: false },
    adminReply: { type: String, trim: true, maxlength: 1000 },
    adminRepliedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ product: 1, isApproved: 1 });

const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", reviewSchema);

export default Review;
