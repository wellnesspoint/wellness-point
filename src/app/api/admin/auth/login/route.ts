import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { signAdminToken, getAdminCookieName } from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 5 login attempts per 15 minutes per IP
        const ip = getClientIp(req);
        const { success: withinLimit } = rateLimit(`admin-login:${ip}`, {
            limit: 5,
            windowMs: 15 * 60 * 1000,
        });
        if (!withinLimit) {
            return NextResponse.json(
                { error: "Too many login attempts. Please try again in 15 minutes." },
                { status: 429 }
            );
        }

        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        await connectDB();

        const user = await User.findOne({ email }).select("+password").lean();

        if (!user || !user.password) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        if (user.role !== "admin") {
            return NextResponse.json(
                { error: "Invalid admin credentials" },
                { status: 403 }
            );
        }

        if (!user.isActive) {
            return NextResponse.json(
                { error: "Account has been deactivated" },
                { status: 403 }
            );
        }

        // Sign JWT
        const token = signAdminToken({
            id: user._id.toString(),
            email: user.email,
            name: user.name,
        });

        // Set cookie
        const response = NextResponse.json({
            success: true,
            user: { name: user.name, email: user.email },
        });

        response.cookies.set(getAdminCookieName(), token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        return response;
    } catch (error) {
        console.error("Admin login error:", error);
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        );
    }
}
