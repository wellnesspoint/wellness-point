import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Product from "@/models/Product";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const body = await request.json();
    const updateFields: any = {};

    if (body.orderStatus) {
      const validStatuses = ["processing", "confirmed", "shipped", "delivered", "cancelled"];
      if (!validStatuses.includes(body.orderStatus)) {
        return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      }
      updateFields.orderStatus = body.orderStatus;
    }

    if (body.paymentStatus) {
      const validPayment = ["pending", "paid", "failed", "refunded"];
      if (!validPayment.includes(body.paymentStatus)) {
        return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
      }
      updateFields.paymentStatus = body.paymentStatus;
    }

    if (body.notes !== undefined) {
      updateFields.notes = body.notes;
    }

    // Load the current order first — stock must only be restored ONCE, on
    // the transition INTO cancelled/refunded, never on every save while it
    // stays in that state (e.g. an admin editing notes on an already
    // cancelled order shouldn't re-credit stock a second time).
    const existing = await Order.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const enteringCancelled =
      updateFields.orderStatus === "cancelled" && existing.orderStatus !== "cancelled";
    const enteringRefunded =
      updateFields.paymentStatus === "refunded" && existing.paymentStatus !== "refunded";

    if ((enteringCancelled || enteringRefunded) && !existing.stockRestored) {
      for (const item of existing.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }
      updateFields.stockRestored = true;
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    ).populate("user", "name email");

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const order = await Order.findById(id).populate("user", "name email");
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}
