import mongoose, { Document, Schema, Model } from "mongoose";

/** A URL redirect managed in Admin → Site (e.g. an old product URL to its new one). */
export interface IRedirect extends Document {
  /** path only, starting with "/", lower-cased, no trailing slash (except "/") */
  from: string;
  /** a path starting with "/" or an https URL */
  to: string;
  permanent: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const redirectSchema = new Schema<IRedirect>(
  {
    from: { type: String, required: true, unique: true, maxlength: 200 },
    to: { type: String, required: true, maxlength: 500 },
    permanent: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Redirect: Model<IRedirect> =
  mongoose.models.Redirect || mongoose.model<IRedirect>("Redirect", redirectSchema);

export default Redirect;
