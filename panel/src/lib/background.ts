/**
 * Work that should not hold up the response (D-270).
 *
 * Inside a request Next's `after()` runs the task once the response has been
 * sent; on Vercel the function stays alive for it (`waitUntil`). Scripts, the
 * cron route's own callers and tests have no request, so there the task simply
 * runs before the call returns — which is also what keeps existing tests, that
 * read the mailbox right after a service call, working unchanged.
 */
import "server-only";
import { after } from "next/server";

export type BackgroundTask = () => Promise<void>;
export type BackgroundRunner = (task: BackgroundTask) => Promise<void>;

let override: BackgroundRunner | null = null;

/** Only for tests: capture the task instead of running it, to prove a caller did not wait. */
export function setBackgroundRunner(runner: BackgroundRunner | null): void {
  override = runner;
}

/** Never throws: the task's own failures are its business, the caller has already succeeded. */
export async function runInBackground(task: BackgroundTask): Promise<void> {
  const guarded: BackgroundTask = async () => {
    try {
      await task();
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
      console.error(`Background task failed: ${reason?.slice(0, 300)}`);
    }
  };

  if (override) {
    await override(guarded);
    return;
  }

  try {
    after(guarded);
    return;
  } catch {
    // `after` outside a request scope throws; run in place instead
  }
  await guarded();
}
