import mongoose, { Document, Schema, Model } from "mongoose";

/**
 * A purchasable option of a product (size, flavour...). When a product has
 * variants, `Product.stock` is kept equal to the sum of its variants' stock and
 * `price`/`discountPrice` mirror the cheapest active variant (the "from" price),
 * so lists, alerts and storefront cards keep working unchanged.
 */
export interface IProductVariant {
  _id: mongoose.Types.ObjectId;
  name: string;
  sku?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  isActive: boolean;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  discountPrice?: number;
  images: string[];
  ingredients: string[];
  benefits: string[];
  usage: string;
  stock: number;
  /** alert (dashboard + email) when stock falls to this level or below */
  lowStockThreshold?: number;
  lowStockAlertedAt?: Date;
  /** soft delete: archived products are hidden everywhere but keep their reviews */
  archivedAt?: Date;
  sku?: string;
  weight?: number;
  gst?: number;
  category?: string;
  tags?: string[];
  variants?: IProductVariant[];
  isFeatured: boolean;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IProductVariant>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  sku: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0 },
  stock: { type: Number, required: true, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
});

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    shortDescription: { type: String, required: true, maxlength: 200 },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0 },
    images: [{ type: String, required: true }],
    ingredients: [{ type: String }],
    benefits: [{ type: String }],
    usage: { type: String },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 10 },
    lowStockAlertedAt: { type: Date },
    archivedAt: { type: Date },
    sku: { type: String, trim: true },
    weight: { type: Number, min: 0 },
    gst: { type: Number, min: 0, max: 100, default: 18 },
    category: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    variants: { type: [variantSchema], default: undefined },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    metaTitle: { type: String },
    metaDescription: { type: String },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });

const Product: Model<IProduct> =
  mongoose.models.Product ||
  mongoose.model<IProduct>("Product", productSchema);

export default Product;
