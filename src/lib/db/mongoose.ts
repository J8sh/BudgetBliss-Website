import mongoose from "mongoose";
import { env } from "@/lib/config";
import { logger } from "@/lib/logger";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

declare global {
  var __mongooseConnection: Promise<typeof mongoose> | undefined;
}

async function createConnection(attempt = 1): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info({ uri: env.mongodbUri.replace(/\/\/.*@/, "//***@") }, "MongoDB connected");
    return conn;
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      logger.error({ attempt, error: err }, "MongoDB connection failed after max retries");
      throw err;
    }
    logger.warn({ attempt, retryIn: RETRY_DELAY_MS }, "MongoDB connection failed, retrying...");
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return createConnection(attempt + 1);
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  // Already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // In production, use a module-level promise to avoid creating multiple connections
  // across serverless invocations. In development, reuse the global to survive HMR.
  if (!global.__mongooseConnection) {
    global.__mongooseConnection = createConnection();
  }

  return global.__mongooseConnection;
}
