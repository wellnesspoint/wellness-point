import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import Wishlist from "@/models/Wishlist";
import Review from "@/models/Review";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const user = await User.findById(id).select("-password").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const orders = await Order.find({ user: id })
      .sort({ createdAt: -1 })
      .lean();

    const totalSpent = orders
      .filter((o: any) => o.paymentStatus === "paid")
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    return NextResponse.json({
      user: { ...user, orderCount: orders.length, totalSpent },
      orders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

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

    if (body.isActive !== undefined) {
      updateFields.isActive = body.isActive;
    }

    if (body.role) {
      updateFields.role = body.role;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "admin") {
      return NextResponse.json(
        { error: "Cannot delete admin users" },
        { status: 403 }
      );
    }

    // Cascade delete all user-related data
    await Promise.all([
      Wishlist.deleteMany({ user: id }),
      Review.deleteMany({ user: id }),
    ]);

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
