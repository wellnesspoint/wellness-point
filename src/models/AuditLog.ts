import mongoose, { Document, Schema, Model } from "mongoose";

export interface IAuditLog extends Document {
  actor: { id?: string; name?: string; email?: string };
  /** dotted verb, e.g. "order.refund", "product.update" */
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      id: { type: String },
      name: { type: String },
      email: { type: String },
    },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    summary: { type: String, required: true, maxlength: 500 },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
// Keep a year of history.
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;
