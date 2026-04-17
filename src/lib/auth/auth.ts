import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { logger } from "@/lib/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          logger.warn("Auth attempt with missing credentials");
          return null;
        }

        try {
          await connectDB();

          // Always select passwordHash explicitly (it's excluded by default)
          const user = await User.findOne({ email: credentials.email })
            .select("+passwordHash")
            .lean();

          if (!user) {
            // Constant-time comparison even when user doesn't exist, to prevent timing attacks
            await bcrypt.compare("dummy", "$2b$12$dummyhashtopreventtimingattacks000000000000");
            logger.warn({ email: credentials.email }, "Auth failed: user not found");
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash,
          );

          if (!isValid) {
            logger.warn({ email: credentials.email }, "Auth failed: invalid password");
            return null;
          }

          logger.info({ email: user.email }, "Admin logged in");
          return { id: user._id.toString(), email: user.email };
        } catch (err) {
          logger.error({ error: err }, "Auth error during credential verification");
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token["id"] = user.id;
        token["email"] = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token["id"] as string;
        session.user.email = token["email"] as string;
      }
      return session;
    },
  },
});
