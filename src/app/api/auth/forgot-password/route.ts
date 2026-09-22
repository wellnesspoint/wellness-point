import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sendPasswordResetEmail, sendOAuthAccountNotice } from "@/lib/email";
import { isValidEmail } from "@/lib/utils";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const GENERIC_MESSAGE =
  "If an account with that email exists, we've sent instructions to it.";

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

    // Check if user exists with any provider first
    const anyUser = await User.findOne({ email: email.toLowerCase() });

    if (!anyUser) {
      // Generic response — don't reveal whether this email is registered.
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    // If the user signed up via Google/Facebook, they can't reset a password.
    // Tell THEM via email, not via the API response — returning a distinct
    // error here would let an attacker enumerate which emails are
    // registered (and by which provider) by watching the response differ.
    if (anyUser.provider !== "credentials") {
      try {
        await sendOAuthAccountNotice({
          customerName: anyUser.name,
          customerEmail: anyUser.email,
          provider: anyUser.provider,
        });
      } catch (err) {
        console.error("Failed to send OAuth account notice:", err);
      }
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const user = anyUser;

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

    // Send email (await to catch failures)
    try {
      await sendPasswordResetEmail({
        customerName: user.name,
        customerEmail: user.email,
        resetUrl,
      });
    } catch (err) {
      console.error("Failed to send reset email:", err);
      return NextResponse.json(
        { error: "Failed to send reset email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
