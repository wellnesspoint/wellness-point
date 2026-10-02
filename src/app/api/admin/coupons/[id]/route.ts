import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Coupon from "@/models/Coupon";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parseCoupon } from "@/lib/coupon-input";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("coupons", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid coupon id" }, { status: 400 });
    }

    const parsed = parseCoupon(await req.json().catch(() => null), false);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();
    const existing = await Coupon.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    // Percent cap must hold for the effective (existing + new) type and value.
    const type = (parsed.data.type as string) ?? existing.type;
    const value = (parsed.data.value as number) ?? existing.value;
    if (type === "percent" && value > 100) {
      return NextResponse.json({ error: "A percentage discount can't exceed 100" }, { status: 400 });
    }

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    );

    await logAudit(session, {
      action: "coupon.update",
      entity: "coupon",
      entityId: id,
      summary: `Updated coupon ${existing.code} (${Object.keys(parsed.data).join(", ")})`,
      meta: { changes: parsed.data },
    });
    return NextResponse.json({ coupon });
  } catch (error: any) {
    console.error("Admin coupon update error:", error);
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("coupons", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid coupon id" }, { status: 400 });
    }

    await connectDB();
    // Past orders keep their couponCode/discount snapshot, so deleting is safe.
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    await logAudit(session, {
      action: "coupon.delete",
      entity: "coupon",
      entityId: id,
      summary: `Deleted coupon ${coupon.code}`,
    });
    return NextResponse.json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("Admin coupon delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
