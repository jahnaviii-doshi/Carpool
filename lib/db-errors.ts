/**
 * Postgres errors raised on purpose by our SQL functions carry messages that
 * are written for users. Anything else is shown as a generic message so
 * internals never leak to the browser.
 */
const USER_FACING = new Set(["22023", "54000", "P0002"]);

export function userMessage(
  error: { code?: string; message?: string } | null,
  fallback = "Something went wrong. Please try again.",
) {
  if (!error) return fallback;
  if (error.code && USER_FACING.has(error.code) && error.message) {
    return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
  }
  return fallback;
}
