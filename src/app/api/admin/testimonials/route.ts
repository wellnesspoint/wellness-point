import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Testimonial from "@/models/Testimonial";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const testimonials = await Testimonial.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ testimonials });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const { name, role, image, content, rating, isApproved } = body;

    if (!name || !content || !rating) {
      return NextResponse.json(
        { error: "Name, content, and rating are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const testimonial = await Testimonial.create({
      name,
      role,
      image,
      content,
      rating,
      isApproved: isApproved ?? true,
    });

    return NextResponse.json(
      { message: "Testimonial created", testimonial },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
