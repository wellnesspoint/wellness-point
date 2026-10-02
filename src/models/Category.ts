import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * Store categories. Products reference a category by its *name* (Product.category
 * is a plain string, as it was before this model existed), so renaming or deleting
 * a category here updates the products that use it.
 */
export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 300 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Category: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>("Category", categorySchema);

export default Category;
