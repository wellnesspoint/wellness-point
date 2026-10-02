import { NextRequest, NextResponse } from "next/server";
import * as OTPAuth from "otpauth";
import crypto from "crypto";
import mongoose from "mongoose";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/2fa/backup-codes  { code }
 * Replaces the admin's backup codes with a fresh set (the old ones stop working).
 * Needs a current authenticator code (a backup code is not accepted here, so a
 * stolen backup code cannot be used to mint more). Returns the plain codes once.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("self", "manage");
    if (!session) return unauthorizedResponse();

    const { code: rawCode } = await req.json().catch(() => ({}));
    const code = typeof rawCode === "string" ? rawCode.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app" }, { status: 400 });
    }

    const { success } = await rateLimit(`admin-2fa-backup:${session.user.id}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!success) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    await connectDB();
    const users = mongoose.connection.db!.collection("users");
    const user = await users.findOne(
      { _id: new mongoose.Types.ObjectId(session.user.id) },
      { projection: { twoFactorSecret: 1, twoFactorEnabled: 1, email: 1 } }
    );
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: "Turn on 2FA first" }, { status: 400 });
    }

    const totp = new OTPAuth.TOTP({
      issuer: "Wellness Point Admin",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });
    if (totp.validate({ token: code, window: 1 }) === null) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    await users.updateOne(
      { _id: user._id },
      { $set: { twoFactorBackupCodes: backupCodes.map((c) => crypto.createHash("sha256").update(c).digest("hex")) } }
    );

    await logAudit(session, {
      action: "admin.2fa_backup_codes",
      entity: "admin",
      entityId: session.user.id,
      summary: `${session.user.email} generated new 2FA backup codes`,
    });
    return NextResponse.json({ backupCodes });
  } catch (error) {
    console.error("2FA backup codes error:", error);
    return NextResponse.json({ error: "Failed to generate backup codes" }, { status: 500 });
  }
}
