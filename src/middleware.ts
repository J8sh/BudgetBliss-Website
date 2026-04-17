export { auth as middleware } from "@/lib/auth/auth";

export const config = {
  matcher: [
    // Protect all routes except login, static files, and NextAuth internals
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
