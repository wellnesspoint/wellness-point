import connectDB from "./db";
import AuditLog from "@/models/AuditLog";

interface AdminSession {
  user: { id: string; name?: string; email?: string };
}

export interface AuditEntry {
  /** dotted verb, e.g. "order.refund" */
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  meta?: Record<string, unknown>;
}

/**
 * Record an admin action. Never throws: an audit-write failure must not
 * block (or fail) the action it describes, but it is logged loudly.
 */
export async function logAudit(session: AdminSession | null, entry: AuditEntry): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      actor: {
        id: session?.user.id,
        name: session?.user.name,
        email: session?.user.email,
      },
      ...entry,
      summary: entry.summary.slice(0, 500),
    });
  } catch (err) {
    console.error("Audit log write failed:", entry.action, err);
  }
}

/** { field: [before, after] } for the fields that actually changed. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    if (JSON.stringify(before[f]) !== JSON.stringify(after[f])) {
      changes[f] = [before[f], after[f]];
    }
  }
  return changes;
}
