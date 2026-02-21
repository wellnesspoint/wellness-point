import mongoose, { Schema, Document } from "mongoose";

export interface IShippingSettings extends Document {
  flatRate: number;
  freeShippingThreshold: number;
  enableFreeShipping: boolean;
  estimatedDays: number;
  estimatedDaysMax: number;
  shippingNote: string;
  zones: {
    name: string;
    states: string[];
    rate: number;
    estimatedDays: number;
  }[];
  updatedAt: Date;
}

const ShippingSettingsSchema = new Schema<IShippingSettings>(
  {
    flatRate: { type: Number, default: 50, min: 0 },
    freeShippingThreshold: { type: Number, default: 499, min: 0 },
    enableFreeShipping: { type: Boolean, default: true },
    estimatedDays: { type: Number, default: 5, min: 1 },
    estimatedDaysMax: { type: Number, default: 7, min: 1 },
    shippingNote: { type: String, default: "Ships within 2-3 business days", trim: true },
    zones: [
      {
        name: { type: String, trim: true },
        states: [{ type: String, trim: true }],
        rate: { type: Number, default: 0, min: 0 },
        estimatedDays: { type: Number, default: 7, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.ShippingSettings ||
  mongoose.model<IShippingSettings>("ShippingSettings", ShippingSettingsSchema);
