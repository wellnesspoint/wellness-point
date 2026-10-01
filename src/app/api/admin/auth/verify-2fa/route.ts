import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import * as OTPAuth from "otpauth";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  verifyPending2FAToken,
  signAdminToken,
  getAdminCookieName,
} from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/auth/verify-2fa
 * Verify the TOTP code after credential login.
 * Body: { pendingToken: string, code: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per 5 minutes per IP
    const ip = getClientIp(req);
    const { success: withinLimit } = await rateLimit(`admin-2fa:${ip}`, {
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 5 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pendingToken = body.pendingToken;
    const code: string = typeof body.code === "string" ? body.code.trim() : "";

    if (!pendingToken || typeof pendingToken !== "string" || !code) {
      return NextResponse.json(
        { error: "Token and verification code are required" },
        { status: 400 }
      );
    }

    // Verify the pending 2FA token
    const pending = verifyPending2FAToken(pendingToken);
    if (!pending) {
      return NextResponse.json(
        { error: "Session expired. Please login again." },
        { status: 401 }
      );
    }

    // Also limit per ACCOUNT, not just per IP — a pending token is valid for 5
    // minutes, and an attacker rotating IPs must not get unlimited TOTP guesses.
    const { success: accountWithinLimit } = await rateLimit(`admin-2fa-user:${pending.id}`, {
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (!accountWithinLimit) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 5 minutes." },
        { status: 429 }
      );
    }

    await connectDB();

    // Use native collection to bypass Mongoose model cache issues
    const user = await mongoose.connection.db!
      .collection("users")
      .findOne(
        { _id: new mongoose.Types.ObjectId(pending.id) },
        { projection: { twoFactorSecret: 1, twoFactorBackupCodes: 1, twoFactorEnabled: 1, email: 1 } }
      );
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA is not configured for this account" },
        { status: 400 }
      );
    }

    let isValid = false;
    let usedBackupCode = false;

    // Try TOTP code first
    const totp = new OTPAuth.TOTP({
      issuer: "Wellness Point Admin",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta !== null) {
      isValid = true;
    }

    // Try backup code if TOTP didn't match
    if (!isValid && user.twoFactorBackupCodes?.length) {
      const hashedInput = crypto
        .createHash("sha256")
        .update(code.toUpperCase())
        .digest("hex");

      if (user.twoFactorBackupCodes.includes(hashedInput)) {
        // Consume the code with an atomic $pull that only matches while the
        // code is still present — two parallel requests with the same code
        // can't both succeed (the second sees modifiedCount === 0).
        const consumed = await mongoose.connection.db!
          .collection("users")
          .updateOne(
            {
              _id: new mongoose.Types.ObjectId(pending.id),
              twoFactorBackupCodes: hashedInput,
            },
            { $pull: { twoFactorBackupCodes: hashedInput } as any }
          );
        if (consumed.modifiedCount === 1) {
          isValid = true;
          usedBackupCode = true;
          user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(
            (c: string) => c !== hashedInput
          );
        }
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 401 }
      );
    }

    // 2FA verified — issue the full admin JWT
    const token = signAdminToken({
      id: pending.id,
      email: pending.email,
      name: pending.name,
    });

    await logAudit(
      { user: { id: pending.id, name: pending.name, email: pending.email } },
      {
        action: "admin.login",
        entity: "admin",
        entityId: pending.id,
        summary: `${pending.email} signed in with 2FA${usedBackupCode ? " (backup code)" : ""}`,
        meta: { ip },
      }
    );

    const response = NextResponse.json({
      success: true,
      user: { name: pending.name, email: pending.email },
      ...(usedBackupCode && {
        warning: `Backup code used. ${user.twoFactorBackupCodes?.length ?? 0} remaining.`,
      }),
    });

    response.cookies.set(getAdminCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error("2FA verification error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
