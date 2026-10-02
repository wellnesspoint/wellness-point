import { NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import User from "@/models/User";
import mongoose from "mongoose";

/**
 * GET /api/admin/2fa/status
 * Check whether 2FA is enabled for the current admin.
 */
export async function GET() {
  try {
    const session = await checkAdmin("self", "manage");
    if (!session) return unauthorizedResponse();

    await connectDB();

    const user = await User.findById(session.user.id).select("twoFactorEnabled");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // How many unused backup codes are left (the codes themselves are hashed and never returned).
    let backupCodesLeft = 0;
    if (user.twoFactorEnabled) {
      const doc = await mongoose.connection.db!
        .collection("users")
        .findOne(
          { _id: new mongoose.Types.ObjectId(session.user.id) },
          { projection: { twoFactorBackupCodes: 1 } }
        );
      backupCodesLeft = doc?.twoFactorBackupCodes?.length ?? 0;
    }

    return NextResponse.json({
      enabled: user.twoFactorEnabled || false,
      backupCodesLeft,
    });
  } catch (error) {
    console.error("2FA status error:", error);
    return NextResponse.json(
      { error: "Failed to check 2FA status" },
      { status: 500 }
    );
  }
}
