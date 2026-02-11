export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: "user" | "admin";
}

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "user" | "admin";
  }
}
