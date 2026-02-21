import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ShippingSettings from "@/models/ShippingSettings";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

// GET /api/admin/shipping — get shipping settings
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    let settings = await ShippingSettings.findOne();

    // Create default if none exists
    if (!settings) {
      settings = await ShippingSettings.create({
        flatRate: 50,
        freeShippingThreshold: 499,
        enableFreeShipping: true,
        estimatedDays: 5,
        estimatedDaysMax: 7,
        shippingNote: "Ships within 2-3 business days",
        zones: [],
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Shipping settings GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT /api/admin/shipping — update shipping settings
export async function PUT(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    await connectDB();

    let settings = await ShippingSettings.findOne();
    if (!settings) {
      settings = await ShippingSettings.create(body);
    } else {
      Object.assign(settings, body);
      await settings.save();
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Shipping settings PUT error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
