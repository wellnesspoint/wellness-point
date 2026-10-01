import mongoose, { Document, Schema, Model } from "mongoose";

export interface INewsletterCampaign extends Document {
  subject: string;
  body: string;
  status: "sending" | "done" | "failed";
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
    status: { type: String, enum: ["sending", "done", "failed"], default: "sending" },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    createdBy: { type: String },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

campaignSchema.index({ createdAt: -1 });

const NewsletterCampaign: Model<INewsletterCampaign> =
  mongoose.models.NewsletterCampaign ||
  mongoose.model<INewsletterCampaign>("NewsletterCampaign", campaignSchema);

export default NewsletterCampaign;
