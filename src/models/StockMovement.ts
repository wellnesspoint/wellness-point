import mongoose, { Document, Schema, Model } from "mongoose";

export type StockReason = "order" | "cancel" | "refund" | "admin_edit" | "restock";

export interface IStockMovement extends Document {
  product: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  variantName?: string;
  /** signed change: negative = stock left, positive = stock added */
  delta: number;
  reason: StockReason;
  order?: mongoose.Types.ObjectId;
  actorName?: string;
  /** stock level after the change, when known */
  balance?: number;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId },
    variantName: { type: String },
    delta: { type: Number, required: true },
    reason: {
      type: String,
      enum: ["order", "cancel", "refund", "admin_edit", "restock"],
      required: true,
    },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    actorName: { type: String },
    balance: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ product: 1, createdAt: -1 });

const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", stockMovementSchema);

export default StockMovement;
