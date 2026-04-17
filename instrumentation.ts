/**
 * Next.js instrumentation file — runs once at server startup (not at build time).
 * Used for DB connection and admin user seeding.
 * https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  // Only run on the server (not in edge runtime or browser)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initApp } = await import("@/lib/startup");
    await initApp();
  }
}
