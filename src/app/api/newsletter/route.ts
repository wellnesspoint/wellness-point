import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import { isValidEmail, sanitizeInput } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await NewsletterSubscriber.findOne({
      email: email.toLowerCase(),
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json(
          { error: "You're already subscribed!" },
          { status: 409 }
        );
      }
      existing.isActive = true;
      await existing.save();
      return NextResponse.json({ message: "Welcome back! You've been resubscribed." });
    }

    await NewsletterSubscriber.create({
      email: sanitizeInput(email).toLowerCase(),
    });

    return NextResponse.json(
      { message: "Successfully subscribed!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Newsletter error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}
