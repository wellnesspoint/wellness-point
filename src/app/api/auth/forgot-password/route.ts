import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sendPasswordResetEmail } from "@/lib/email";
import { isValidEmail } from "@/lib/utils";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 requests per 15 min per IP
    const ip = getClientIp(req);
    const { success } = rateLimit(`forgot-password:${ip}`, {
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({
      email: email.toLowerCase(),
      provider: "credentials",
    });

    // Always return success even if user not found (prevents email enumeration)
    if (!user) {
      return NextResponse.json({
        message: "If an account with that email exists, a reset link has been sent.",
      });
    }

    // Generate a secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Send email (non-blocking)
    sendPasswordResetEmail({
      customerName: user.name,
      customerEmail: user.email,
      resetUrl,
    }).catch((err) => console.error("Failed to send reset email:", err));

    return NextResponse.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
