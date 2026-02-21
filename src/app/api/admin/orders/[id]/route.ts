import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import Order from "@/models/Order";

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

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    ).populate("user", "name email");

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

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
