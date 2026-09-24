import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { accounts, db } from "@/db";
import { syncAccount } from "@/server/sync";

const INTERVAL_MS = 30 * 60 * 1000;

type AutoSyncState = {
  timer?: ReturnType<typeof setInterval>;
  running?: boolean;
  started?: boolean;
};

const state = globalThis as typeof globalThis & {
  __tradeJournalAutoSync?: AutoSyncState;
};

const getState = () => {
  state.__tradeJournalAutoSync ??= {};
  return state.__tradeJournalAutoSync;
};

const runAutoSync = async () => {
  const autoSync = getState();

  if (autoSync.running) return;
  autoSync.running = true;

  try {
    const rows = db
      .select({
        id: accounts.id,
        name: accounts.name,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.kind, "sync"),
          eq(accounts.autoSync, true),
          isNotNull(accounts.credentialsEnc),
          isNull(accounts.archivedAt),
        ),
      )
      .all();

    for (const account of rows) {
      try {
        await syncAccount(account.id);
        console.info(`[auto-sync] ${account.name}: completed`);
      } catch (error) {
        console.error(
          `[auto-sync] ${account.name}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    autoSync.running = false;
  }
};

export const startAutoSync = () => {
  const autoSync = getState();

  if (autoSync.started) return;

  autoSync.started = true;

  void runAutoSync();

  autoSync.timer = setInterval(() => {
    void runAutoSync();
  }, INTERVAL_MS);

  console.info("[auto-sync] started: every 30 minutes");
};