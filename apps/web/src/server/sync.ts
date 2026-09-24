import { connect, listBrokers, type BrokerId } from "@luxalgo/broker-sdk";
import { eq } from "drizzle-orm";
import type { ImportedExecution } from "@luxalgo/journal-importers";
import { accounts, db } from "@/db";
import { decryptJson, encryptJson } from "./crypto";
import { nowIso } from "./ids";
import { insertExecutions, type InsertResult } from "./executions";

/** All broker connectivity goes through @luxalgo/broker-sdk, never direct API code. */
export { listBrokers };

export interface SyncOptions {
  startDate?: string;
  endDate?: string;
}

export interface SyncOutcome extends InsertResult {
  accountId: string;
  equity: number | null;
  positions: number;
  syncedAt: string;
}

const dateRange = (options: SyncOptions) => {
  if (!options.startDate && !options.endDate) return null;

  const start = options.startDate ? new Date(`${options.startDate}T00:00:00.000Z`) : null;
  const end = options.endDate ? new Date(`${options.endDate}T23:59:59.999Z`) : null;

  if (start && Number.isNaN(start.getTime())) {
    throw new Error("Invalid sync start date");
  }

  if (end && Number.isNaN(end.getTime())) {
    throw new Error("Invalid sync end date");
  }

  if (start && end && start > end) {
    throw new Error("Start date must not be after end date");
  }

  return {
    startMs: start?.getTime() ?? Number.NEGATIVE_INFINITY,
    endMs: end?.getTime() ?? Number.POSITIVE_INFINITY,
  };
};

export const syncAccount = async (
  accountId: string,
  options: SyncOptions = {},
): Promise<SyncOutcome> => {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();

  if (!account) throw new Error("Account not found");

  if (account.kind !== "sync" || !account.credentialsEnc) {
    throw new Error("Account is not broker-connected");
  }

  const range = dateRange(options);
  const credentials = decryptJson<Record<string, string>>(account.credentialsEnc);

  const connection = connect({
    broker: account.broker as BrokerId,
    credentials,
    onCredentialsRotated: (next: Record<string, string>) => {
      db.update(accounts)
        .set({ credentialsEnc: encryptJson(next) })
        .where(eq(accounts.id, accountId))
        .run();
    },
  } as Parameters<typeof connect>[0]);

  const snapshot = await connection.fetchSnapshot();
  const syncedAt = nowIso();

  const rows: ImportedExecution[] = snapshot.accounts.flatMap((brokerAccount) =>
    brokerAccount.trades
      .map((trade) => ({
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        fee: trade.fee ?? 0,
        executedAt: trade.executedAt ?? "",
      }))
      .filter((row) => {
        if (!range) return true;

        const executedAtMs = new Date(row.executedAt).getTime();
        return (
          Number.isFinite(executedAtMs) &&
          executedAtMs >= range.startMs &&
          executedAtMs <= range.endMs
        );
      }),
  );

  const timed = rows.filter((row) => row.executedAt !== "");
  const untimed = rows.length - timed.length;

  const result = insertExecutions(accountId, timed, "sync");

  if (untimed > 0) {
    result.skipped += untimed;

    if (result.skippedReasons.length < 5) {
      result.skippedReasons.push(`${untimed} fill(s) had no usable timestamp.`);
    }
  }

  const equity = snapshot.accounts.reduce((total, brokerAccount) => {
    return total + brokerAccount.equity;
  }, 0);

  const positions = snapshot.accounts.flatMap((brokerAccount) => {
    return brokerAccount.positions;
  });

  db.update(accounts)
    .set({
      lastSyncAt: syncedAt,
      snapshotJson: JSON.stringify({
        equity,
        positions,
        fetchedAt: snapshot.fetchedAt,
      }),
    })
    .where(eq(accounts.id, accountId))
    .run();

  return {
    accountId,
    ...result,
    equity,
    positions: positions.length,
    syncedAt,
  };
};