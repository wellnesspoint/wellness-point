import mongoose, { Document, Schema, Model } from "mongoose";

export interface ISiteSettings extends Document {
  storeName: string;
  tagline: string;
  location: string;
  gstNo: string;
  supportEmail: string;
  website: string;
  phone?: string;
  /** storefront shows a maintenance page (admin and API keep working) */
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    storeName: { type: String, trim: true, maxlength: 80 },
    tagline: { type: String, trim: true, maxlength: 160 },
    location: { type: String, trim: true, maxlength: 200 },
    gstNo: { type: String, trim: true, uppercase: true, maxlength: 15 },
    supportEmail: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20 },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

const SiteSettings: Model<ISiteSettings> =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettings>("SiteSettings", siteSettingsSchema);

export default SiteSettings;
