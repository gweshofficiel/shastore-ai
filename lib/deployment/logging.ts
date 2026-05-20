type LogContext = Record<string, unknown>;

function isServerProduction() {
  return process.env.NODE_ENV === "production";
}

function sanitizeContext(context?: LogContext) {
  if (!context) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).filter(([key]) => {
      const normalized = key.toLowerCase();
      return (
        !normalized.includes("secret") &&
        !normalized.includes("token") &&
        !normalized.includes("key") &&
        !normalized.includes("password")
      );
    })
  );
}

export function formatProductionError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: isServerProduction() ? undefined : error.stack
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    name: "UnknownError"
  };
}

export const deploymentLogger = {
  info(message: string, context?: LogContext) {
    if (!isServerProduction()) {
      console.info(`[deployment] ${message}`, sanitizeContext(context));
    }
  },
  warn(message: string, context?: LogContext) {
    console.warn(`[deployment] ${message}`, sanitizeContext(context));
  },
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(`[deployment] ${message}`, {
      error: formatProductionError(error),
      context: sanitizeContext(context)
    });
  }
};
