import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      return NextResponse.redirect(
        new URL("/login?error=invalid-verification", req.url)
      );
    }

    await connectDB();

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // First find user by email and token (without expiry check)
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerifyToken: hashedToken,
    });

    if (!user) {
      // Check if user is already verified
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser?.emailVerified) {
        return NextResponse.redirect(
          new URL("/login?verified=true", req.url)
        );
      }
      return NextResponse.redirect(
        new URL("/login?error=invalid-verification", req.url)
      );
    }

    // Check expiry separately for a clearer error
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return NextResponse.redirect(
        new URL("/login?error=expired-verification", req.url)
      );
    }

    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    return NextResponse.redirect(
      new URL("/login?verified=true", req.url)
    );
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.redirect(
      new URL("/login?error=verification-failed", req.url)
    );
  }
}
