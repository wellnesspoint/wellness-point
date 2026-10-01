import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import bcrypt from "bcryptjs";
import connectDB from "./db";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        await connectDB();

        const user = await User.findOne({ email: credentials.email }).select(
          "+password"
        );

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        if (!user.isActive) {
          throw new Error("Account has been deactivated");
        }

        // Check email verification for credentials users
        if (!user.emailVerified) {
          throw new Error("Please verify your email before signing in. Check your inbox.");
        }

        // Admin users must use the admin login page (/admin/login)
        if (user.role === "admin") {
          throw new Error("Please use the admin login page");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "facebook") {
        // Facebook can return no email (phone-only accounts / denied scope);
        // User.create would then throw a validation error mid-login.
        if (!user.email) {
          return "/login?error=oauth-no-email";
        }

        await connectDB();

        const existingUser = await User.findOne({ email: user.email });

        if (existingUser) {
          // Block signing in if user has been deactivated
          if (!existingUser.isActive) {
            return false;
          }

          // Don't silently take over an account that signed up a different
          // way (e.g. email/password) just because this OAuth provider
          // *claims* the same email — that would be an account-takeover path
          // if the provider ever hands back an unverified/attacker-supplied
          // email. Google's profile reliably asserts `email_verified`;
          // Facebook's does not, so we never auto-link via Facebook.
          if (existingUser.provider !== account.provider) {
            const emailVerifiedByProvider =
              account.provider === "google" && (profile as any)?.email_verified === true;
            if (!emailVerifiedByProvider) {
              return "/login?error=oauth-email-exists";
            }
          }

          // Auto-verify email for OAuth users
          if (!existingUser.emailVerified) {
            existingUser.emailVerified = true;
            await existingUser.save();
          }
        } else {
          await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            provider: account.provider,
            providerId: account.providerAccountId,
            role: "user",
            emailVerified: true,
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        await connectDB();
        const dbUser = await User.findOne({ email: user.email }).select("_id role isActive").lean();
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.isActive = dbUser.isActive;
          token.lastChecked = Date.now();
        }
      } else if (token.email) {
        // Re-check isActive every 5 minutes instead of on every request
        const FIVE_MINUTES = 5 * 60 * 1000;
        const lastChecked = (token.lastChecked as number) || 0;
        if (Date.now() - lastChecked > FIVE_MINUTES) {
          await connectDB();
          const dbUser = await User.findOne({ email: token.email })
            .select("isActive role passwordChangedAt")
            .lean();
          if (dbUser && !dbUser.isActive) {
            return { ...token, isActive: false };
          }
          // Password was reset after this session was issued → kill the session.
          if (
            dbUser?.passwordChangedAt &&
            typeof token.iat === "number" &&
            token.iat * 1000 < dbUser.passwordChangedAt.getTime()
          ) {
            return { ...token, isActive: false };
          }
          if (dbUser) {
            token.role = dbUser.role;
          }
          token.lastChecked = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.isActive === false) {
        // Return empty session for blocked users
        return { ...session, user: undefined } as any;
      }
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
