import { connectDB } from "@/lib/db/mongoose";
import { seedAdminUser } from "@/lib/db/seed";
import { logger } from "@/lib/logger";

let initialized = false;

/**
 * Runs once at app startup. Connects to DB and seeds the admin user.
 * Safe to call multiple times — idempotent.
 */
export async function initApp(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    await connectDB();
    await seedAdminUser();
    logger.info("App initialized successfully");
  } catch (err) {
    logger.error({ error: err }, "App initialization failed");
    // Don't throw — let the app start even if DB is temporarily unavailable
  }
}
