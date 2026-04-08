export function logInfo(message: string, details?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[foreman][INFO] ${message}`, details ?? "");
  }
}

export function logError(message: string, error?: unknown) {
  console.error(`[foreman][ERROR] ${message}`, error ?? "");
}
