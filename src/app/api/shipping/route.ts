import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ShippingSettings from "@/models/ShippingSettings";
import { DEFAULT_SHIPPING } from "@/lib/shipping";

/**
 * GET /api/shipping — public endpoint for shipping settings.
 * Used by checkout page to display correct shipping rates.
 */
export async function GET() {
  try {
    await connectDB();
    type ShippingConfig = { flatRate: number; freeShippingThreshold: number; enableFreeShipping: boolean; estimatedDays: number; estimatedDaysMax: number; shippingNote: string; zones?: { name?: string; states: string[]; rate: number; estimatedDays?: number }[] };
    const raw = await ShippingSettings.findOne().lean() as ShippingConfig | null;

    const settings: ShippingConfig = raw ?? {
      ...DEFAULT_SHIPPING,
      estimatedDays: 5,
      estimatedDaysMax: 7,
      shippingNote: "Ships within 2-3 business days",
    };

    return NextResponse.json({
      flatRate: settings.flatRate,
      freeShippingThreshold: settings.freeShippingThreshold,
      enableFreeShipping: settings.enableFreeShipping,
      estimatedDays: settings.estimatedDays,
      estimatedDaysMax: settings.estimatedDaysMax,
      shippingNote: settings.shippingNote,
      zones: (settings.zones ?? []).map((z) => ({
        name: z.name,
        states: z.states,
        rate: z.rate,
        estimatedDays: z.estimatedDays,
      })),
    });
  } catch (error) {
    console.error("Shipping settings public GET error:", error);
    return NextResponse.json(
      DEFAULT_SHIPPING,
      { status: 200 }
    );
  }
}
