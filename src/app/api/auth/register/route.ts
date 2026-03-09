import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sanitizeInput, isValidEmail } from "@/lib/utils";
import { sendEmailVerification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedVerifyToken = crypto
      .createHash("sha256")
      .update(verifyToken)
      .digest("hex");

    const user = await User.create({
      name: sanitizeInput(name),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      provider: "credentials",
      role: "user",
      emailVerified: false,
      emailVerifyToken: hashedVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Send verification email (must await on serverless — function ends after response)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in";
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}&email=${encodeURIComponent(user.email)}`;

    try {
      await sendEmailVerification({
        customerName: user.name,
        customerEmail: user.email,
        verifyUrl,
      });
    } catch (err) {
      console.error("Failed to send verification email:", err);
    }

    return NextResponse.json(
      {
        message: "Account created! Please check your email to verify your account.",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
