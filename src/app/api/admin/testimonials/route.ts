import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Testimonial from "@/models/Testimonial";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

export async function GET() {
  try {
    const session = await checkAdmin("content", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const testimonials = await Testimonial.find().sort({ createdAt: -1 }).limit(500).lean();
    return NextResponse.json({ testimonials });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const { name, role, image, content, rating, isApproved } = body;

    if (!name || !content || !rating) {
      return NextResponse.json(
        { error: "Name, content, and rating are required" },
        { status: 400 }
      );
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: "Rating must be 1 to 5" }, { status: 400 });
    }

    await connectDB();

    const testimonial = await Testimonial.create({
      name,
      role,
      image,
      content,
      rating: ratingNum,
      isApproved: isApproved ?? true,
    });

    return NextResponse.json(
      { message: "Testimonial created", testimonial },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
