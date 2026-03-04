import { NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import User from "@/models/User";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";
import mongoose from "mongoose";

/**
 * GET /api/admin/2fa/setup
 * Generate a new TOTP secret and QR code for the admin to scan.
 */
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    // Generate a new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });

    const totp = new OTPAuth.TOTP({
      issuer: "Wellness Point Admin",
      label: session.user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the secret using $set with strict:false to bypass model cache issues
    const updated = await User.findByIdAndUpdate(
      session.user.id,
      { $set: { twoFactorSecret: secret.base32 } },
      { new: true, strict: false }
    );
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      qrCode: qrCodeUrl,
      secret: secret.base32, // manual entry fallback
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return NextResponse.json(
      { error: "Failed to set up 2FA" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/2fa/setup
 * Verify the TOTP code and enable 2FA. Also generates backup codes.
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

    // Use native collection to bypass Mongoose model cache issues with select:false fields
    const user = await mongoose.connection.db!
      .collection("users")
      .findOne(
        { _id: new mongoose.Types.ObjectId(session.user.id) },
        { projection: { twoFactorSecret: 1, email: 1 } }
      );
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "2FA setup not initiated. Generate a QR code first." },
        { status: 400 }
      );
    }

    // Verify the code
    const totp = new OTPAuth.TOTP({
      issuer: "Wellness Point Admin",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    // Generate 8 backup codes
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }

    // Hash backup codes for storage
    const hashedCodes = backupCodes.map((c) =>
      crypto.createHash("sha256").update(c).digest("hex")
    );

    // Use $set with strict:false to reliably persist select:false fields
    await User.findByIdAndUpdate(
      session.user.id,
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorBackupCodes: hashedCodes,
        },
      },
      { strict: false }
    );

    return NextResponse.json({
      message: "2FA enabled successfully!",
      backupCodes, // Return plain codes only once — user must save them
    });
  } catch (error) {
    console.error("2FA enable error:", error);
    return NextResponse.json(
      { error: "Failed to enable 2FA" },
      { status: 500 }
    );
  }
}
