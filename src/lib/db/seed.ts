import bcrypt from "bcryptjs";
import { env } from "@/lib/config";
import { logger } from "@/lib/logger";
import { User } from "@/lib/models/User";

const DEFAULT_PASSWORD = "changeme123";

/**
 * Seeds the admin user on first startup. Idempotent — safe to call on every app start.
 * Reads credentials from ADMIN_EMAIL and ADMIN_PASSWORD env vars.
 */
export async function seedAdminUser(): Promise<void> {
  try {
    const existing = await User.findOne({ email: env.adminEmail }).select("_id").lean();
    if (existing) {
      logger.debug({ email: env.adminEmail }, "Admin user already exists, skipping seed");
      return;
    }

    if (env.adminPassword === DEFAULT_PASSWORD && env.isProd) {
      logger.warn(
        { email: env.adminEmail },
        "SECURITY WARNING: Admin password is the default. Change ADMIN_PASSWORD before going to production.",
      );
    }

    const passwordHash = await bcrypt.hash(env.adminPassword, 12);

    await User.create({
      email: env.adminEmail,
      passwordHash,
      dashboardLayout: [],
      theme: "system",
    });

    logger.info({ email: env.adminEmail }, "Admin user seeded successfully");
  } catch (err) {
    logger.error({ error: err }, "Failed to seed admin user");
    throw err;
  }
}
