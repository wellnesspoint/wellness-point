import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    const token = req.nextUrl.searchParams.get("token");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Only links we generated (signed per address) can unsubscribe someone.
    if (!token || !verifyUnsubscribeToken(email, token)) {
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribed?status=invalid", req.url)
      );
    }

    await connectDB();

    // Soft-unsubscribe (isActive=false) rather than deleting, so the address
    // can still re-subscribe later through the normal signup flow.
    const result = await NewsletterSubscriber.updateOne(
      { email: email.toLowerCase() },
      { $set: { isActive: false } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribed?status=not-found", req.url)
      );
    }

    return NextResponse.redirect(new URL("/newsletter/unsubscribed", req.url));
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
