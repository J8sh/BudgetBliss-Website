import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
    serializers: {
      // pino only auto-serializes errors under the key "err"; "error" needs explicit serializer
      error: pino.stdSerializers.err,
      err: pino.stdSerializers.err,
    },
    redact: {
      // Never log secrets
      paths: ["*.password", "*.apiKey", "*.secret", "*.token"],
      censor: "[REDACTED]",
    },
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      })
    : undefined,
);

export type Logger = typeof logger;
