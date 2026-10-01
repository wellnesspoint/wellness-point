import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Contact from "@/models/Contact";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 contact submissions per 15 minutes per IP
    const ip = getClientIp(req);
    const { success: withinLimit } = await rateLimit(`contact:${ip}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !phone || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (![name, email, phone, subject, message].every((v) => typeof v === "string")) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (!isValidEmail(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (!/^[+\d][\d\s-]{6,19}$/.test(phone.trim())) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    if (
      name.trim().length > 100 ||
      email.trim().length > 200 ||
      subject.trim().length > 200 ||
      message.trim().length > 5000
    ) {
      return NextResponse.json(
        { error: "One or more fields are too long" },
        { status: 400 }
      );
    }

    await connectDB();

    await Contact.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: "new",
    });

    return NextResponse.json(
      { message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
