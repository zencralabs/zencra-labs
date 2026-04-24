/**
 * Zencra Labs — Next.js Instrumentation
 *
 * Next.js calls register() exactly once per server boot, before any request
 * is served. This is the canonical place to run startup validation.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run env validation on the Node.js runtime (not in Edge workers).
  // The "nodejs" runtime has access to process.env and the full Node API.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupEnvCheck } = await import("./src/lib/env/validateEnv");
    runStartupEnvCheck();
  }
}
