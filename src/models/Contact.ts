import mongoose, { Schema, Document } from "mongoose";

export interface IContact extends Document {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  adminReply?: string;
  adminRepliedAt?: Date;
  priority?: "low" | "normal" | "high" | "urgent";
  /** teammate handling this message */
  assignedTo?: { id: mongoose.Types.ObjectId; name?: string; email?: string };
  /** staff-only notes, never shown to the customer */
  internalNotes?: { text: string; by?: string; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "read", "replied", "archived"],
      default: "new",
    },
    adminReply: { type: String, trim: true },
    adminRepliedAt: { type: Date },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    assignedTo: {
      id: { type: Schema.Types.ObjectId, ref: "User" },
      name: { type: String },
      email: { type: String },
    },
    internalNotes: [
      {
        text: { type: String, required: true, maxlength: 1000 },
        by: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

ContactSchema.index({ status: 1, createdAt: -1 });
ContactSchema.index({ "assignedTo.id": 1, status: 1 });

export default mongoose.models.Contact ||
  mongoose.model<IContact>("Contact", ContactSchema);
