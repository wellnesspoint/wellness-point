import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";

export async function GET() {
    const admin = await verifyAdminToken();

    if (!admin) {
        return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
        authenticated: true,
        user: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            adminRole: admin.adminRole,
        },
    });
}
