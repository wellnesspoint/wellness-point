import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { createShipment, isShiprocketConfigured, ShiprocketError } from "@/lib/shiprocket";

interface Props {
  params: Promise<{ id: string }>;
}

/** GET — is Shiprocket set up, and does this order already have a shipment? */
export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("orders", "view");
    if (!session) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await connectDB();
    const order = await Order.findById(id).select("shipment").lean();
    return NextResponse.json({
      configured: isShiprocketConfigured(),
      shipment: order?.shipment?.shipmentId ? order.shipment : null,
    });
  } catch (error) {
    console.error("Shipment status error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST — create the Shiprocket shipment for a paid, not-cancelled order and save the
 * courier / AWB / tracking link on it. Safe against double clicks: the order is claimed
 * first, and the claim is released if Shiprocket fails so the admin can retry.
 */
export async function POST(_req: NextRequest, { params }: Props) {
  let claimedId: string | null = null;
  try {
    const session = await checkAdmin("orders", "manage");
    if (!session) return unauthorizedResponse();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    if (!isShiprocketConfigured()) {
      return NextResponse.json(
        { error: "Shiprocket is not set up. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the environment." },
        { status: 503 }
      );
    }

    await connectDB();
    const existing = await Order.findById(id).select("paymentStatus orderStatus").lean();
    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (existing.paymentStatus !== "paid") {
      return NextResponse.json({ error: "Only paid orders can be shipped" }, { status: 400 });
    }
    if (existing.orderStatus === "cancelled") {
      return NextResponse.json({ error: "This order is cancelled" }, { status: 400 });
    }

    // Claim: only one request can move an order without a shipment into "creating".
    const order = await Order.findOneAndUpdate(
      { _id: id, "shipment.provider": { $exists: false } },
      { $set: { shipment: { provider: "shiprocket", creating: true } } },
      { new: true }
    );
    if (!order) {
      return NextResponse.json({ error: "This order already has a shipment" }, { status: 409 });
    }
    claimedId = id;

    // Parcel weight from the products (stored in grams); falls back to the configured default.
    const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } })
      .select("weight")
      .lean();
    const grams = new Map(products.map((p) => [String(p._id), p.weight ?? 0]));
    const totalKg =
      order.items.reduce((sum, i) => sum + (grams.get(String(i.product)) ?? 0) * i.quantity, 0) / 1000;

    const created = await createShipment(
      {
        _id: String(order._id),
        createdAt: order.createdAt,
        items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
        shippingAddress: order.shippingAddress,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
      },
      totalKg
    );

    const update: Record<string, unknown> = {
      shipment: {
        provider: "shiprocket",
        orderId: created.shiprocketOrderId,
        shipmentId: created.shipmentId,
        awb: created.awb,
        createdAt: new Date(),
      },
    };
    if (created.awb) {
      update.tracking = {
        courier: created.courier || "Shiprocket",
        trackingNumber: created.awb,
        trackingUrl: created.trackingUrl,
      };
    }
    await Order.updateOne({ _id: id }, { $set: update });
    claimedId = null;

    await logAudit(session, {
      action: "order.shipment",
      entity: "order",
      entityId: id,
      summary: created.awb
        ? `Created Shiprocket shipment (${created.courier ?? "courier"}, AWB ${created.awb})`
        : "Created Shiprocket shipment; no courier assigned yet, finish it in Shiprocket",
    });
    return NextResponse.json({
      shipment: created,
      message: created.awb
        ? `Shipment created with ${created.courier ?? "a courier"}. AWB ${created.awb}.`
        : "Shipment created in Shiprocket, but no courier could be assigned automatically. Open it in Shiprocket to pick one.",
    });
  } catch (error) {
    if (claimedId) {
      // Release the claim so the admin can try again.
      await Order.updateOne({ _id: claimedId, "shipment.creating": true }, { $unset: { shipment: "" } }).catch(() => {});
    }
    if (error instanceof ShiprocketError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Create shipment error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
