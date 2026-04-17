/**
 * Centralized, validated environment configuration.
 * Import `env` from this module — never use process.env directly in app code.
 *
 * Uses lazy getters so env vars are read at access time (runtime), not at module
 * load time (which would cause build failures when env vars aren't set).
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  get nodeEnv() {
    return optionalEnv("NODE_ENV", "development") as "development" | "production" | "test";
  },
  get mongodbUri() {
    return requireEnv("MONGODB_URI");
  },
  get anthropicApiKey() {
    return requireEnv("ANTHROPIC_API_KEY");
  },
  get adminEmail() {
    return requireEnv("ADMIN_EMAIL");
  },
  get adminPassword() {
    return requireEnv("ADMIN_PASSWORD");
  },
  get nextauthSecret() {
    return requireEnv("NEXTAUTH_SECRET");
  },
  get nextauthUrl() {
    return optionalEnv("NEXTAUTH_URL", "http://localhost:3000");
  },
  get isDev() {
    return optionalEnv("NODE_ENV", "development") === "development";
  },
  get isProd() {
    return process.env["NODE_ENV"] === "production";
  },
  get isTest() {
    return process.env["NODE_ENV"] === "test";
  },
} as const;
