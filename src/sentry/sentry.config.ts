import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn("Sentry DSN not configured. Error tracking will be disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === "development",
    beforeSend(event, hint) {
      if (
        process.env.NODE_ENV === "development" &&
        !process.env.SENTRY_ENABLE_DEV
      ) {
        return null;
      }
      return event;
    },
  });
}
