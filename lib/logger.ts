/**
 * Lightweight logging helper.
 *
 * - `debug(...)` is **disabled in production** by default.
 * - To force-enable debug logs in production, set `NEXT_PUBLIC_DEBUG_LOGS=1`.
 *
 * Notes:
 * - This file is safe to import from both server and client components.
 * - Next.js inlines `process.env.NEXT_PUBLIC_*` on the client at build time.
 */
const DEBUG_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_LOGS === '1';

export const log = {
  debug: (...args: unknown[]) => {
    if (!DEBUG_ENABLED) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  },
};

