import mongoose, { Document, Schema, Model } from "mongoose";

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress?: {
    fullName: string;
    email?: string;
    phone: string;
    street: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus: "processing" | "confirmed" | "shipped" | "delivered" | "cancelled";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  stockRestored?: boolean;
  couponCode?: string;
  tracking?: { courier?: string; trackingNumber?: string; trackingUrl?: string };
  statusHistory?: {
    field: "orderStatus" | "paymentStatus";
    from?: string;
    to: string;
    by?: string;
    at: Date;
  }[];
  /** When an abandoned-checkout reminder email was sent. */
  reminderSentAt?: Date;
  /** Admin-only notes thread (the legacy `notes` string is kept for system messages). */
  internalNotes?: { text: string; by?: string; at: Date }[];
  /** Partial refunds issued through Razorpay (a full refund sets paymentStatus "refunded"). */
  refunds?: { amount: number; razorpayRefundId?: string; reason?: string; by?: string; at: Date }[];
  refundedAmount?: number;
  finalizing?: boolean;
  finalizingAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
});

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    // Not required at the schema level: an order is created (paymentStatus "pending")
    // before the shipping address is known — it's filled in once payment is verified.
    shippingAddress: {
      fullName: { type: String },
      email: { type: String },
      phone: { type: String },
      street: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
    },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["processing", "confirmed", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
    // Unique + sparse: every order created via /api/payment/create-order gets one,
    // and uniqueness is what prevents a single Razorpay payment from being
    // "verified" more than once to mint duplicate orders / double-decrement stock.
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    // Set once stock has been returned to inventory for a cancelled/refunded order,
    // so admin re-saves (or repeated status transitions) never double-restore it.
    stockRestored: { type: Boolean, default: false },
    couponCode: { type: String, uppercase: true, trim: true },
    tracking: {
      courier: { type: String, trim: true, maxlength: 80 },
      trackingNumber: { type: String, trim: true, maxlength: 80 },
      trackingUrl: { type: String, trim: true, maxlength: 500 },
    },
    // Append-only trail of admin status changes (who/when).
    statusHistory: [
      {
        _id: false,
        field: { type: String, enum: ["orderStatus", "paymentStatus"], required: true },
        from: { type: String },
        to: { type: String, required: true },
        by: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    reminderSentAt: { type: Date },
    internalNotes: [
      {
        _id: false,
        text: { type: String, required: true, maxlength: 1000 },
        by: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    refunds: [
      {
        _id: false,
        amount: { type: Number, required: true, min: 0 },
        razorpayRefundId: { type: String },
        reason: { type: String, maxlength: 200 },
        by: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
    refundedAmount: { type: Number, default: 0, min: 0 },
    // Short-lived claim taken while a payment is being finalized, so verify and
    // the webhook can never both process the same order.
    finalizing: { type: Boolean, default: false },
    finalizingAt: { type: Date },
    notes: { type: String, maxlength: 2000 },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ couponCode: 1, paymentStatus: 1 }, { sparse: true });
// Abandoned checkouts (a "pending" order is created before payment) are
// purged after 7 days instead of accumulating forever. Paid/failed/refunded
// orders are never touched (partial filter).
orderSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { paymentStatus: "pending" } }
);

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);

export default Order;
