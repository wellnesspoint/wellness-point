import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ShippingSettings from "@/models/ShippingSettings";

/**
 * GET /api/shipping — public endpoint for shipping settings.
 * Used by checkout page to display correct shipping rates.
 */
export async function GET() {
  try {
    await connectDB();
    let settings = await ShippingSettings.findOne().lean();

    if (!settings) {
      // Return sensible defaults if admin hasn't configured yet
      settings = {
        flatRate: 50,
        freeShippingThreshold: 499,
        enableFreeShipping: true,
        estimatedDays: 5,
        estimatedDaysMax: 7,
        shippingNote: "Ships within 2-3 business days",
      } as any;
    }

    return NextResponse.json({
      flatRate: settings.flatRate,
      freeShippingThreshold: settings.freeShippingThreshold,
      enableFreeShipping: settings.enableFreeShipping,
      estimatedDays: settings.estimatedDays,
      estimatedDaysMax: settings.estimatedDaysMax,
      shippingNote: settings.shippingNote,
    });
  } catch (error) {
    console.error("Shipping settings public GET error:", error);
    return NextResponse.json(
      { flatRate: 50, freeShippingThreshold: 499, enableFreeShipping: true },
      { status: 200 }
    );
  }
}
