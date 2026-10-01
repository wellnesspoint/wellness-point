import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { sanitizeInput } from "@/lib/utils";

const PHONE_RE = /^[+\d][\d\s-]{6,19}$/;
const MAX_ADDRESSES = 5;

/** Validate + sanitize one address; returns null when it's malformed. */
function cleanAddress(a: any) {
  if (!a || typeof a !== "object") return null;
  const str = (v: unknown, max: number, required = true) => {
    if (typeof v !== "string") return required ? null : "";
    const t = sanitizeInput(v);
    if (required && !t) return null;
    return t.length > max ? null : t;
  };
  const fullName = str(a.fullName, 100);
  const phone = typeof a.phone === "string" && PHONE_RE.test(a.phone.trim()) ? a.phone.trim() : null;
  const street = str(a.street, 200);
  const addressLine2 = str(a.addressLine2, 200, false);
  const city = str(a.city, 100);
  const state = str(a.state, 100);
  const pincode = typeof a.pincode === "string" && /^\d{6}$/.test(a.pincode.trim()) ? a.pincode.trim() : null;
  if (fullName === null || phone === null || street === null || addressLine2 === null ||
      city === null || state === null || pincode === null) return null;
  return { fullName, phone, street, addressLine2, city, state, pincode, isDefault: !!a.isDefault };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById((session.user as any).id).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image,
        addresses: user.addresses,
        provider: user.provider,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, addresses } = body;

    await connectDB();

    const updateData: any = {};

    if (name !== undefined && name !== "") {
      if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      updateData.name = sanitizeInput(name);
    }

    if (phone !== undefined && phone !== "") {
      if (typeof phone !== "string" || !PHONE_RE.test(phone.trim())) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }
      updateData.phone = phone.trim();
    }

    if (addresses !== undefined) {
      if (!Array.isArray(addresses) || addresses.length > MAX_ADDRESSES) {
        return NextResponse.json({ error: "Invalid addresses" }, { status: 400 });
      }
      const cleaned = [];
      for (const a of addresses) {
        const result = cleanAddress(a);
        if (!result) {
          return NextResponse.json({ error: "Invalid address details" }, { status: 400 });
        }
        cleaned.push(result);
      }
      updateData.addresses = cleaned;
    }

    const user = await User.findByIdAndUpdate(
      (session.user as any).id,
      updateData,
      { new: true }
    ).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        addresses: user.addresses,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
