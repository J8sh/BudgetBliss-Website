import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials, clientIp } from "@/lib/auth/authorize";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "Authentication code", type: "text" },
      },
      authorize(credentials, request) {
        return authorizeCredentials(credentials, clientIp(request));
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
