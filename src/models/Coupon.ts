import mongoose, { Document, Schema, Model } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  description?: string;
  type: "percent" | "fixed";
  /** percent: 1-100, fixed: rupees */
  value: number;
  /** minimum cart subtotal (₹) for the code to apply; 0 = none */
  minOrder: number;
  /** cap for percent coupons (₹); 0 = no cap */
  maxDiscount: number;
  /** total paid uses allowed across all customers; 0 = unlimited */
  usageLimit: number;
  /** uses allowed per customer; 0 = unlimited */
  perUserLimit: number;
  startsAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_-]{3,30}$/,
    },
    description: { type: String, trim: true, maxlength: 200 },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", couponSchema);

export default Coupon;
