import mongoose, { Document, Schema, Model } from "mongoose";

export interface INewsletterCampaign extends Document {
  subject: string;
  body: string;
  /** "scheduled" waits for the cron job at `scheduledAt`; "cancelled" is a scheduled one withdrawn */
  status: "scheduled" | "sending" | "done" | "failed" | "cancelled";
  audience?: "all" | "customers" | "non_customers" | "recent";
  scheduledAt?: Date;
  total: number;
  sent: number;
  failed: number;
  createdBy?: string;
  finishedAt?: Date;
  createdAt: Date;
}

const campaignSchema = new Schema<INewsletterCampaign>(
  {
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 20000 },
    status: { type: String, enum: ["scheduled", "sending", "done", "failed", "cancelled"], default: "sending" },
    audience: { type: String, enum: ["all", "customers", "non_customers", "recent"], default: "all" },
    scheduledAt: { type: Date },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    createdBy: { type: String },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ status: 1, scheduledAt: 1 });

const NewsletterCampaign: Model<INewsletterCampaign> =
  mongoose.models.NewsletterCampaign ||
  mongoose.model<INewsletterCampaign>("NewsletterCampaign", campaignSchema);

export default NewsletterCampaign;
