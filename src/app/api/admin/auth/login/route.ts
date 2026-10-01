import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { signAdminToken, getAdminCookieName, signPending2FAToken } from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
    try {
        // Rate limit: 5 login attempts per 15 minutes per IP
        const ip = getClientIp(req);
        const { success: withinLimit } = await rateLimit(`admin-login:${ip}`, {
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

        // Per-account limit too, so rotating IPs can't brute-force one admin.
        const { success: accountWithinLimit } = await rateLimit(
            `admin-login-user:${String(email).toLowerCase()}`,
            { limit: 10, windowMs: 15 * 60 * 1000 }
        );
        if (!accountWithinLimit) {
            return NextResponse.json(
                { error: "Too many login attempts. Please try again in 15 minutes." },
                { status: 429 }
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

        // Check if 2FA is enabled (and not bypassed via env)
        // The bypass flag is a dev convenience only — it is ignored in
        // production so a forgotten env var can never silently disable 2FA.
        const bypass2FA =
            process.env.DISABLE_ADMIN_2FA === "true" && process.env.NODE_ENV !== "production";
        if (user.twoFactorEnabled && !bypass2FA) {
            // Return a short-lived pending token — client must verify TOTP next
            const pendingToken = signPending2FAToken({
                id: user._id.toString(),
                email: user.email,
                name: user.name,
            });

            return NextResponse.json({
                requires2FA: true,
                pendingToken,
            });
        }

        // Sign JWT
        const token = signAdminToken({
            id: user._id.toString(),
            email: user.email,
            name: user.name,
        });

        await logAudit(
            { user: { id: user._id.toString(), name: user.name, email: user.email } },
            { action: "admin.login", entity: "admin", entityId: user._id.toString(), summary: `${user.email} signed in`, meta: { ip } }
        );

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
