import { NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import User from "@/models/User";
import * as OTPAuth from "otpauth";
import crypto from "crypto";
import mongoose from "mongoose";

/**
 * POST /api/admin/2fa/disable
 * Disable 2FA for the admin. Requires a valid TOTP code or backup code.
 * Body: { code: string }
 */
export async function POST(req: Request) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Use native collection to bypass Mongoose model cache issues
    const user = await mongoose.connection.db!
      .collection("users")
      .findOne(
        { _id: new mongoose.Types.ObjectId(session.user.id) },
        { projection: { twoFactorSecret: 1, twoFactorBackupCodes: 1, twoFactorEnabled: 1, email: 1 } }
      );
    if (!user || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: "2FA is not enabled" },
        { status: 400 }
      );
    }

    let isValid = false;

    // Try TOTP code first
    if (user.twoFactorSecret) {
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
    }

    // Try backup code if TOTP didn't match
    if (!isValid && user.twoFactorBackupCodes?.length) {
      const hashedInput = crypto
        .createHash("sha256")
        .update(code.toUpperCase())
        .digest("hex");

      const codeIndex = user.twoFactorBackupCodes.indexOf(hashedInput);
      if (codeIndex !== -1) {
        isValid = true;
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid code. Please enter a valid TOTP or backup code." },
        { status: 400 }
      );
    }

    // Disable 2FA using $unset for select:false fields
    await User.findByIdAndUpdate(
      session.user.id,
      {
        $set: { twoFactorEnabled: false },
        $unset: { twoFactorSecret: 1, twoFactorBackupCodes: 1 },
      },
      { strict: false }
    );

    return NextResponse.json({
      message: "2FA has been disabled successfully.",
    });
  } catch (error) {
    console.error("2FA disable error:", error);
    return NextResponse.json(
      { error: "Failed to disable 2FA" },
      { status: 500 }
    );
  }
}
