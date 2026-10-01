import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import connectDB from "./db";
import User from "@/models/User";

const ADMIN_COOKIE = "admin-token";
const EXPIRY = "7d";

// Deliberately isolated from the customer-facing NextAuth session secret:
// admin and customer auth are two independent trust boundaries, and sharing
// a secret means a leak of one compromises both. Falls back to
// NEXTAUTH_SECRET only if ADMIN_JWT_SECRET hasn't been configured yet, so
// existing deployments don't hard-fail before the new env var is set.
function getSecret(): string {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (secret) return secret;

    const fallback = process.env.NEXTAUTH_SECRET;
    if (!fallback) {
        throw new Error("ADMIN_JWT_SECRET (or NEXTAUTH_SECRET as a fallback) must be set. Admin auth cannot function.");
    }
    console.warn(
        "ADMIN_JWT_SECRET is not set — falling back to NEXTAUTH_SECRET. " +
        "Set a dedicated ADMIN_JWT_SECRET so admin sessions don't share a secret with customer sessions."
    );
    return fallback;
}

interface AdminPayload {
    id: string;
    email: string;
    name: string;
    role: "admin";
}

export function signAdminToken(payload: Omit<AdminPayload, "role">): string {
    return jwt.sign({ ...payload, role: "admin" }, getSecret(), { expiresIn: EXPIRY });
}

export async function verifyAdminToken(): Promise<AdminPayload | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(ADMIN_COOKIE)?.value;
        if (!token) return null;

        const decoded = jwt.verify(token, getSecret()) as AdminPayload & { iat?: number };
        if (decoded.role !== "admin") return null;

        // Unlike customer sessions (re-checked every 5 min in the NextAuth jwt
        // callback), this JWT's claims were only true at login time. Without
        // re-checking the DB, a deactivated or demoted admin would keep full
        // access for the token's full 7-day life. This costs one lean query
        // per admin API request, which is acceptable given admin traffic volume.
        await connectDB();
        const dbUser = await User.findById(decoded.id).select("role isActive passwordChangedAt").lean();
        if (!dbUser || dbUser.role !== "admin" || !dbUser.isActive) {
            return null;
        }

        // Sessions issued before a password reset are rejected (customer
        // sessions already do this in lib/auth.ts), so a stolen token doesn't
        // outlive the password change.
        if (
            dbUser.passwordChangedAt &&
            decoded.iat &&
            decoded.iat * 1000 < dbUser.passwordChangedAt.getTime()
        ) {
            return null;
        }

        return decoded;
    } catch {
        return null;
    }
}

export function getAdminCookieName() {
    return ADMIN_COOKIE;
}

// Short-lived token for 2FA pending state (5 minutes)
interface Pending2FAPayload {
    id: string;
    email: string;
    name: string;
    pending2FA: true;
}

export function signPending2FAToken(payload: Omit<Pending2FAPayload, "pending2FA">): string {
    return jwt.sign({ ...payload, pending2FA: true }, getSecret(), { expiresIn: "5m" });
}

export function verifyPending2FAToken(token: string): Pending2FAPayload | null {
    try {
        const decoded = jwt.verify(token, getSecret()) as Pending2FAPayload;
        if (!decoded.pending2FA) return null;
        return decoded;
    } catch {
        return null;
    }
}
