import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const subscriber = await NewsletterSubscriber.findOne({
      email: email.toLowerCase(),
    });

    if (!subscriber) {
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribed?status=not-found", req.url)
      );
    }

    await NewsletterSubscriber.findByIdAndDelete(subscriber._id);

    return NextResponse.redirect(
      new URL("/newsletter/unsubscribed", req.url)
    );
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
