import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "admin-token";
const EXPIRY = "7d";

function getSecret(): string {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error("NEXTAUTH_SECRET environment variable is not set. Admin auth cannot function.");
    }
    return secret;
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

        const decoded = jwt.verify(token, getSecret()) as AdminPayload;
        if (decoded.role !== "admin") return null;

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
