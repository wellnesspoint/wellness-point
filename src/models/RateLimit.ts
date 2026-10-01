import mongoose, { Schema, Model } from "mongoose";

export interface IRateLimit {
  _id: string;
  count: number;
  resetAt: Date;
}

// One document per limiter key. The TTL index removes a document once its
// window has ended, so the collection stays tiny.
const rateLimitSchema = new Schema<IRateLimit>(
  {
    _id: { type: String },
    count: { type: Number, required: true },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false }
);

rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit ||
  mongoose.model<IRateLimit>("RateLimit", rateLimitSchema);

export default RateLimit;
